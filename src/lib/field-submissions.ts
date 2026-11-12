import { appendRow, SheetAppendError } from './sheets-api';
import { queueSubmission } from './offline-queue';

interface FieldWriteResult {
  written: number;
  pending: number;
  failed: { row: string[]; reason: string; retrySameRow: boolean }[];
}

/** Keep the same row on uncertain retries so the gateway can return its original receipt. */
export async function saveFieldRows(type: 'fuel' | 'trip', tab: string, rows: string[][], online: boolean, ownerId?: string): Promise<FieldWriteResult> {
  const result: FieldWriteResult = { written: 0, pending: 0, failed: [] };
  for (const row of rows) {
    if (online) {
      try {
        await appendRow(tab, row, ownerId);
        result.written++;
        continue;
      } catch (error) {
        if (error instanceof SheetAppendError && error.status < 500 && ![408, 429].includes(error.status)) {
          result.failed.push({ row, reason: error.reason, retrySameRow: false });
          continue;
        }
      }
    }
    try {
      await queueSubmission({ type, data: { tab, values: row }, timestamp: new Date().toISOString(), ...(ownerId ? { ownerId } : {}) });
      result.pending++;
    } catch {
      result.failed.push({ row, reason: 'No se pudo confirmar el registro ni guardarlo en este dispositivo.', retrySameRow: true });
    }
  }
  return result;
}
