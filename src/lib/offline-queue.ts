// Offline queue replays pending submissions through the fleet data API.
// appendRow calls the VPS gateway which routes to PocketBase (or Sheets
// in rollback mode) — no changes needed here when switching backends.
import { appendRow } from './sheets-api';
import { tryUploadPhotos } from './photo-upload-safe';

const DB_NAME = 'hermes-offline';
const STORE_NAME = 'pending-submissions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface PendingSubmission {
  id?: number;
  type: 'dvir' | 'falla' | 'fuel' | 'trip' | 'horometro' | 'sticker_inspection';
  data: Record<string, unknown>;
  timestamp: string;
}

/** Persist a new submission to IndexedDB for later replay. */
export async function queueSubmission(submission: Omit<PendingSubmission, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(submission);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Return all queued submissions that have not yet been successfully replayed. */
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Remove a successfully-replayed submission from IndexedDB by its auto-increment id. */
export async function clearSubmission(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Return the number of submissions waiting to be replayed. */
export async function getPendingCount(): Promise<number> {
  const submissions = await getPendingSubmissions();
  return submissions.length;
}

let flushing = false;

/**
 * Replay all pending submissions against the Sheets API.
 * Each entry must have been queued with data: { tab: string, values: string[] }.
 * Succeeded entries are removed from the queue. Failed entries are left for the next retry.
 * Returns { succeeded, failed } counts.
 */
export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  if (!navigator.onLine) return { succeeded: 0, failed: 0 };
  if (flushing) return { succeeded: 0, failed: 0 };
  flushing = true;
  try {
    const pending = await getPendingSubmissions();
    if (pending.length === 0) return { succeeded: 0, failed: 0 };

    let succeeded = 0;
    let failed = 0;

    for (const submission of pending) {
      const { tab, values, photoFiles, photoBucket, photoColumnIndex } = submission.data as {
        tab?: string;
        values?: string[];
        photoFiles?: File[];
        photoBucket?: string;
        photoColumnIndex?: number;
      };
      if (!tab || !Array.isArray(values)) {
        // Malformed entry — remove it rather than retry forever
        if (submission.id !== undefined) await clearSubmission(submission.id);
        continue;
      }
      try {
        const replayValues = [...values];
        if (
          Array.isArray(photoFiles) &&
          photoFiles.length > 0 &&
          typeof photoBucket === 'string' &&
          typeof photoColumnIndex === 'number'
        ) {
          const photoUrls = await tryUploadPhotos(photoFiles, photoBucket);
          replayValues[photoColumnIndex] = photoUrls.join(', ');
        }
        await appendRow(tab, replayValues);
        if (submission.id !== undefined) await clearSubmission(submission.id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    return { succeeded, failed };
  } finally {
    flushing = false;
  }
}
