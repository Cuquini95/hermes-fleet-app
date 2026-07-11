import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractOTSequence,
  formatOTId,
  generateNextOTId,
  generateOTId,
  nextOTSequenceFromRows,
} from './ot-generator';
import { readRange, SHEET_TABS } from './sheets-api';

vi.mock('./sheets-api', () => ({
  SHEET_TABS: { ORDENES_TRABAJO: 'ORDENES_TRABAJO' },
  readRange: vi.fn(),
}));

function memoryStorage(seed?: string) {
  const values = new Map<string, string>();
  if (seed) values.set('hermes_ot_sequence', seed);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('OT sequence generator', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('formats work orders as short sequential IDs', () => {
    expect(formatOTId(1)).toBe('OT-0001');
    expect(formatOTId(12)).toBe('OT-0012');
    expect(formatOTId(1234)).toBe('OT-1234');
  });

  it('extracts only the new readable sequence format', () => {
    expect(extractOTSequence('OT-0008')).toBe(8);
    expect(extractOTSequence('ot-0100')).toBe(100);
    expect(extractOTSequence('OT-20260710-2212-e2a9')).toBeNull();
    expect(extractOTSequence('')).toBeNull();
  });

  it('finds the next sequence across sheet rows', () => {
    expect(nextOTSequenceFromRows([
      ['ROW_ID', 'OT_ID'],
      ['1', 'OT-0001'],
      ['2', 'OT-0007'],
      ['3', 'OT-20260710-2212-e2a9'],
    ])).toBe(8);
  });

  it('starts at OT-0001 when no sequential rows exist', () => {
    expect(generateOTId([['ROW_ID', 'OT_ID'], ['1', 'OT-20260710-2212-e2a9']], memoryStorage())).toBe('OT-0001');
  });

  it('never goes backward against the local offline sequence', () => {
    const storage = memoryStorage('12');

    expect(generateOTId([['1', 'OT-0003']], storage)).toBe('OT-0013');
    expect(storage.getItem('hermes_ot_sequence')).toBe('13');
  });

  it('reads existing work orders fresh before assigning the next online ID', async () => {
    vi.mocked(readRange).mockResolvedValueOnce([
      ['ROW_ID', 'OT_ID'],
      ['1', 'OT-0001'],
      ['2', 'OT-0002'],
    ]);

    await expect(generateNextOTId()).resolves.toBe('OT-0003');
    expect(readRange).toHaveBeenCalledWith(SHEET_TABS.ORDENES_TRABAJO, undefined, 5000, 0);
  });

  it('falls back to a local sequence if the remote read fails', async () => {
    vi.mocked(readRange).mockRejectedValueOnce(new Error('offline'));

    await expect(generateNextOTId()).resolves.toMatch(/^OT-\d{4,}$/);
  });
});
