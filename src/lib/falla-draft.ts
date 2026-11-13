export interface FallaDraft {
  unidad: string;
  tipoFalla: string;
  descripcion: string;
  puedeMoverse: boolean | null;
  clienteAfectado: string;
  ubicacion: string;
  downtime: string;
  previousOtId: string;
  photos: File[];
  mutationId: string;
  pending: string;
}

const databaseName = 'hermes-field-drafts';
const storeName = 'falla';

async function withDraftStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

const checkpointKey = (scope: string) => 'hermes:falla-draft:' + scope;

function checkpoint(scope: string, value: string) {
  try { sessionStorage.setItem(checkpointKey(scope), value); } catch { /* IndexedDB may still be available. */ }
}

function releaseCheckpoint(scope: string, value: string) {
  try {
    if (sessionStorage.getItem(checkpointKey(scope)) === value) sessionStorage.removeItem(checkpointKey(scope));
  } catch { /* IndexedDB already confirmed this update. */ }
}

export async function loadFallaDraft(scope: string): Promise<FallaDraft | undefined> {
  let checkpointValue: string | null = null;
  try { checkpointValue = sessionStorage.getItem(checkpointKey(scope)); } catch { /* Read durable draft. */ }
  if (checkpointValue === 'null') return undefined;
  const stored = await withDraftStore<FallaDraft | undefined>('readonly', store => store.get(scope))
    .catch((error: unknown) => {
      if (checkpointValue) return undefined;
      throw error;
    });
  if (!checkpointValue) return stored;
  const snapshot = JSON.parse(checkpointValue) as Omit<FallaDraft, 'photos'>;
  return { ...snapshot, photos: stored?.photos ?? [] };
}

export function checkpointFallaDraft(scope: string, draft: FallaDraft): string {
  const value = JSON.stringify({ ...draft, photos: undefined });
  checkpoint(scope, value);
  return value;
}

export async function saveFallaDraft(scope: string, draft: FallaDraft, checkpointValue: string) {
  await withDraftStore('readwrite', store => store.put(draft, scope));
  releaseCheckpoint(scope, checkpointValue);
}

export function checkpointFallaClear(scope: string) {
  checkpoint(scope, 'null');
}

export async function clearFallaDraft(scope: string) {
  await withDraftStore('readwrite', store => store.delete(scope));
  releaseCheckpoint(scope, 'null');
}
