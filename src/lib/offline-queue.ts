// Offline queue replays pending submissions through the fleet data API.
// appendRow calls the VPS gateway which routes to PocketBase (or Sheets
// in rollback mode) — no changes needed here when switching backends.
import { appendRow, handoffMeterReadings } from './sheets-api';
import { tryUploadPhotos } from './photo-upload-safe';
import { uploadFallaPhotos } from './falla-submit';
import { reportCmmsDamage, type CmmsDamageReport } from './cmms-events';
import { isCmmsMeterReading, type CmmsMeterReading } from './cmms-meter';
import { uploadPhoto } from './photo-upload';
import { uploadEvidence } from './evidence-upload';
import { isPrivateEvidenceUrl } from './evidence-link';
import { useAuthStore } from '../stores/auth-store';
import { requestWorkshop, workshopActorId, WorkshopApiError } from './workshop-api';

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
  ownerId?: string;
  type: 'dvir' | 'falla' | 'fuel' | 'trip' | 'horometro' | 'cmms_meter' | 'sticker_inspection' | 'cmms_damage' | 'workshop_capture';
  data: Record<string, unknown>;
  timestamp: string;
}

let queueOwner = '';

export function setOfflineQueueSession(owner: string) {
  queueOwner = owner;
}

/** Persist a new submission to IndexedDB for later replay. */
export async function queueSubmission(submission: Omit<PendingSubmission, 'id'>): Promise<void> {
  const ownerId = submission.ownerId || queueOwner || undefined;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add({ ...submission, ownerId });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export interface WorkshopCapture {
  endpoint: 'report' | 'dvir' | 'sticker';
  mutationId: string;
  input: Record<string, unknown>;
  photos: { file: File; itemId?: string; url?: string }[];
}

interface QueuedWorkshopCapture extends WorkshopCapture {
  actorId: string;
  receipt?: unknown;
}

const captureBuckets = { report: 'falla-photos', dvir: 'dvir-photos', sticker: 'sticker-inspection-photos' };
const capturesInFlight = new Map<string, Promise<unknown>>();

async function putWorkshopCapture(capture: QueuedWorkshopCapture, id?: number): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const record: PendingSubmission = { type: 'workshop_capture', ownerId: capture.actorId, data: { capture }, timestamp: new Date().toISOString() };
  if (id !== undefined) record.id = id;
  const request = tx.objectStore(STORE_NAME).put(record);
  return new Promise<number>((resolve, reject) => {
    tx.oncomplete = () => resolve(Number(request.result));
    tx.onabort = tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

async function replayWorkshopCapture(capture: QueuedWorkshopCapture, id: number): Promise<unknown> {
  const key = `${capture.actorId}:${capture.mutationId}`;
  const active = capturesInFlight.get(key);
  if (active) return active;
  const task = (async () => {
    if (workshopActorId() !== capture.actorId) throw new Error('Abre la sesión que creó el registro pendiente.');
    const panama = useAuthStore.getState().project === 'tmf-panama';
    const uploaded = (photo: QueuedWorkshopCapture['photos'][number]) => panama ? isPrivateEvidenceUrl(photo.url) : Boolean(photo.url);
    for (const [index, photo] of capture.photos.entries()) {
      if (uploaded(photo)) continue;
      if (workshopActorId() !== capture.actorId) throw new Error('Abre la sesión que creó el registro pendiente.');
      photo.url = panama ? await uploadEvidence(photo.file, {
        kind: capture.endpoint, units: [String(capture.input.unit ?? '')], slot: index,
        operationId: capture.mutationId, expectedUserId: capture.actorId,
      }) : await uploadPhoto(photo.file, captureBuckets[capture.endpoint]);
      await putWorkshopCapture(capture, id);
    }
    if (workshopActorId() !== capture.actorId) throw new Error('Abre la sesión que creó el registro pendiente.');
    const photos = capture.photos.map((photo) => photo.url);
    const input = { ...capture.input, mutationId: capture.mutationId, photos } as Record<string, unknown>;
    if (capture.endpoint === 'sticker' && Array.isArray(capture.input.checks)) {
      input.checks = capture.input.checks.map((check: { itemId: string }) => ({
        ...check, photos: capture.photos.filter((photo) => photo.itemId === check.itemId).map((photo) => photo.url),
      }));
    }
    const saved = await requestWorkshop(capture.endpoint, input);
    await putWorkshopCapture({ ...capture, input: {}, photos: [], receipt: saved }, id);
    return saved;
  })();
  capturesInFlight.set(key, task);
  try { return await task; } finally { capturesInFlight.delete(key); }
}

export async function saveWorkshopCapture<T>(input: WorkshopCapture): Promise<{ kind: 'saved'; result: T } | { kind: 'pending'; reason: string }> {
  const actorId = workshopActorId();
  if (!actorId) throw new Error('Abre una sesión individual para guardar el registro.');
  const pending = (await getPendingSubmissions()).find((entry) => {
    const capture = entry.data.capture as QueuedWorkshopCapture | undefined;
    return entry.type === 'workshop_capture' && capture?.actorId === actorId && capture.mutationId === input.mutationId;
  });
  const capture = pending ? pending.data.capture as QueuedWorkshopCapture : { ...input, actorId };
  if (capture.receipt) return { kind: 'saved', result: capture.receipt as T };
  const id = pending?.id ?? await putWorkshopCapture(capture);
  if (!navigator.onLine) return { kind: 'pending', reason: 'Sin conexión. El registro quedó pendiente en este dispositivo.' };
  try {
    return { kind: 'saved', result: await replayWorkshopCapture(capture, id) as T };
  } catch (error) {
    if (error instanceof WorkshopApiError && [400, 413, 415].includes(error.status)) {
      await clearSubmission(id);
      throw error;
    }
    return { kind: 'pending', reason: error instanceof Error ? error.message : 'El servidor no confirmó el guardado.' };
  }
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
  return submissions.filter((entry) => queueOwner && entry.ownerId === queueOwner && (
    entry.type !== 'workshop_capture' || !(entry.data.capture as QueuedWorkshopCapture | undefined)?.receipt
  )).length;
}

let flushing = false;

/**
 * Replay all pending submissions against the Sheets API.
 * Each entry must have been queued with data: { tab: string, values: string[] }.
 * Succeeded entries are removed from the queue. Failed entries are left for the next retry.
 * Returns { succeeded, failed } counts.
 */
export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const owner = queueOwner;
  if (!navigator.onLine || !owner) return { succeeded: 0, failed: 0 };
  if (flushing) return { succeeded: 0, failed: 0 };
  flushing = true;
  try {
    const pending = (await getPendingSubmissions()).filter(row => row.ownerId === owner);
    if (pending.length === 0) return { succeeded: 0, failed: 0 };

    let succeeded = 0;
    let failed = 0;

    for (const submission of pending) {
      if (queueOwner !== owner) break;
      if (submission.type === 'workshop_capture') {
        const capture = submission.data.capture as QueuedWorkshopCapture | undefined;
        if (!capture || capture.receipt || capture.actorId !== owner || submission.id === undefined) continue;
        try {
          await replayWorkshopCapture(capture, submission.id);
          succeeded++;
        } catch {
          failed++;
        }
        continue;
      }
      const { tab, values, photoFiles, photoBucket, photoColumnIndex } = submission.data as {
        tab?: string;
        values?: string[];
        photoFiles?: File[];
        photoBucket?: string;
        photoColumnIndex?: number;
      };
      const cmmsDamage = submission.data.cmmsDamage as CmmsDamageReport | undefined;
      const queuedMeterReadings = Array.isArray(submission.data.readings)
        ? submission.data.readings.filter(isCmmsMeterReading)
        : [];
      const queuedMeterReading = isCmmsMeterReading(submission.data.meterReading)
        ? submission.data.meterReading
        : null;

      if (submission.type === 'cmms_meter') {
        if (queuedMeterReadings.length === 0) {
          if (submission.id !== undefined) await clearSubmission(submission.id);
          continue;
        }
        try {
          await handoffMeterReadings(queuedMeterReadings);
          if (submission.id !== undefined) await clearSubmission(submission.id);
          succeeded++;
        } catch {
          failed++;
        }
        continue;
      }

      if (submission.type === 'cmms_damage') {
        if (!cmmsDamage) {
          if (submission.id !== undefined) await clearSubmission(submission.id);
          continue;
        }
        try {
          let replayDamage = cmmsDamage;
          if (
            Array.isArray(photoFiles) &&
            photoFiles.length > 0 &&
            typeof photoBucket === 'string' &&
            !cmmsDamage.photoUrl
          ) {
            const photoSummary = await uploadFallaPhotos(photoFiles);
            replayDamage = { ...cmmsDamage, photoUrl: photoSummary.urls[0] };
          }
          await reportCmmsDamage(replayDamage);
          if (submission.id !== undefined) await clearSubmission(submission.id);
          succeeded++;
        } catch {
          failed++;
        }
        continue;
      }
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
          const photoUrls = submission.type === 'falla'
            ? (await uploadFallaPhotos(photoFiles)).urls
            : await tryUploadPhotos(photoFiles, photoBucket);
          replayValues[photoColumnIndex] = photoUrls.join(', ');
        }
        if (queueOwner !== owner) break;
        await appendRow(tab, replayValues, owner);

        // A queued horometer has to reach the source sheet before its CMMS
        // handoff. If CMMS is temporarily unavailable after the sheet write,
        // split the retry into a meter-only entry so the sheet row is not
        // appended a second time.
        if (submission.type === 'horometro' && queuedMeterReading) {
          try {
            await handoffMeterReadings([queuedMeterReading]);
          } catch {
            await queueSubmission({
              type: 'cmms_meter',
              data: { readings: [queuedMeterReading] as CmmsMeterReading[] },
              timestamp: new Date().toISOString(),
            });
          }
        }
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
