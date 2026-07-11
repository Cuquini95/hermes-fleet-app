import { readRange, SHEET_TABS } from './sheets-api';

const OT_SEQUENCE_STORAGE_KEY = 'hermes_ot_sequence';
const OT_SEQUENCE_RE = /^OT-(\d+)$/i;
const DEFAULT_READ_LIMIT = 5000;

type SequenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

function resolveStorage(storage?: SequenceStorage): SequenceStorage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredSequence(storage?: SequenceStorage): number {
  const resolved = resolveStorage(storage);
  if (!resolved) return 0;
  const raw = resolved.getItem(OT_SEQUENCE_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function storeSequence(value: number, storage?: SequenceStorage): void {
  const resolved = resolveStorage(storage);
  if (!resolved) return;
  try {
    resolved.setItem(OT_SEQUENCE_STORAGE_KEY, String(value));
  } catch {
    // Offline local sequence is best-effort only; Sheets remains the source of truth.
  }
}

export function formatOTId(sequence: number): string {
  const safeSequence = Math.max(1, Math.floor(sequence));
  return `OT-${String(safeSequence).padStart(4, '0')}`;
}

export function extractOTSequence(value: string | null | undefined): number | null {
  const match = String(value ?? '').trim().match(OT_SEQUENCE_RE);
  if (!match) return null;
  const sequence = Number.parseInt(match[1]!, 10);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

export function nextOTSequenceFromRows(rows: string[][]): number {
  const maxSequence = rows.reduce((max, row) => {
    const rowMax = row.reduce((rowCurrent, value) => Math.max(rowCurrent, extractOTSequence(value) ?? 0), 0);
    return Math.max(max, rowMax);
  }, 0);
  return maxSequence + 1;
}

export function generateOTId(existingRows: string[][] = [], storage?: SequenceStorage): string {
  const nextSequence = Math.max(nextOTSequenceFromRows(existingRows), readStoredSequence(storage) + 1);
  storeSequence(nextSequence, storage);
  return formatOTId(nextSequence);
}

export async function generateNextOTId(): Promise<string> {
  try {
    const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO, undefined, DEFAULT_READ_LIMIT, 0);
    return generateOTId(rows);
  } catch {
    return generateOTId();
  }
}
