import { appendRow } from './sheets-api';

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
  type: 'dvir' | 'falla' | 'fuel' | 'trip' | 'horometro';
  data: Record<string, unknown>;
  timestamp: string;
}

export async function queueSubmission(submission: Omit<PendingSubmission, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(submission);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSubmission(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const submissions = await getPendingSubmissions();
  return submissions.length;
}

/**
 * Replay all pending submissions against the Sheets API.
 * Each entry must have been queued with data: { tab: string, values: string[] }.
 * Succeeded entries are removed from the queue. Failed entries are left for the next retry.
 * Returns { succeeded, failed } counts.
 */
export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const pending = await getPendingSubmissions();
  if (pending.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  for (const submission of pending) {
    const { tab, values } = submission.data as { tab?: string; values?: string[] };
    if (!tab || !Array.isArray(values)) {
      // Malformed entry — remove it rather than retry forever
      if (submission.id !== undefined) await clearSubmission(submission.id);
      continue;
    }
    try {
      await appendRow(tab, values);
      if (submission.id !== undefined) await clearSubmission(submission.id);
      succeeded++;
    } catch {
      failed++;
    }
  }

  return { succeeded, failed };
}
