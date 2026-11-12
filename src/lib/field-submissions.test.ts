import { describe, expect, it, vi } from 'vitest';
import { appendRow, SheetAppendError } from './sheets-api';
import { queueSubmission } from './offline-queue';
import { saveFieldRows } from './field-submissions';

vi.mock('./sheets-api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./sheets-api')>(), appendRow: vi.fn(),
}));
vi.mock('./offline-queue', () => ({ queueSubmission: vi.fn() }));

describe('field capture confirmation', () => {
  it('waits for the server before counting a fuel row as written', async () => {
    let confirm!: () => void;
    vi.mocked(appendRow).mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    const saved = saveFieldRows('fuel', 'Combustible', [['fuel-1']], true);
    const status = vi.fn();
    void saved.then(status);
    await Promise.resolve();
    expect(status).not.toHaveBeenCalled();
    confirm();
    await expect(saved).resolves.toEqual({ written: 1, pending: 0, failed: [] });
  });

  it('reports a mixed haul batch without retrying a confirmed or queued row', async () => {
    vi.mocked(appendRow).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Connection lost'))
      .mockRejectedValueOnce(new SheetAppendError(403, 'Unidad fuera de tu alcance.'));
    vi.mocked(queueSubmission).mockClear().mockResolvedValueOnce(undefined);
    const rows = [['first'], ['second'], ['third']];
    await expect(saveFieldRows('trip', 'Fletes', rows, true)).resolves.toEqual({
      written: 1, pending: 1, failed: [{ row: rows[2], reason: 'Unidad fuera de tu alcance.', retrySameRow: false }],
    });
    expect(queueSubmission).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      type: 'trip', data: { tab: 'Fletes', values: rows[1] },
    }));
  });

  it('keeps the original row for retry if a lost response cannot be queued', async () => {
    vi.mocked(appendRow).mockRejectedValueOnce(new Error('Connection lost'));
    vi.mocked(queueSubmission).mockRejectedValueOnce(new Error('Storage disabled'));
    const row = ['fuel-stable-id'];
    const result = await saveFieldRows('fuel', 'Combustible', [row], true);
    expect(result).toMatchObject({ written: 0, pending: 0, failed: [{ row, retrySameRow: true }] });
  });

  it('keeps an offline row pending only after the local write succeeds', async () => {
    vi.mocked(appendRow).mockClear();
    vi.mocked(queueSubmission).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Storage disabled'));
    const rows = [['offline-1'], ['offline-2']];
    const result = await saveFieldRows('trip', 'Fletes', rows, false);
    expect(result).toMatchObject({ written: 0, pending: 1, failed: [{ row: rows[1], retrySameRow: true }] });
    expect(appendRow).not.toHaveBeenCalled();
  });
});
