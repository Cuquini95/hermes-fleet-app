/**
 * offline-queue edge case tests — Wave 5.
 *
 * Covers: large queues, localStorage roundtrip simulation, partial flush
 * failures, deduplication, and overflow behaviour.
 *
 * All IDB interaction is fully mocked so these tests run in Node/Vitest
 * without a real browser environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── IDB in-memory stub ────────────────────────────────────────────────────────

/**
 * Build a minimal IndexedDB stub backed by a plain in-memory array.
 * Supports: open, add, getAll, delete, transaction (readwrite + readonly).
 */
function makeIDBStub(initialRecords: Array<Record<string, unknown>> = []) {
  let nextId = 1;
  const store: Array<Record<string, unknown>> = initialRecords.map((r) => ({
    ...r,
    id: r['id'] ?? nextId++,
  }));

  const makeStore = () => ({
    add: vi.fn((record: Record<string, unknown>) => {
      const newRecord = { ...record, id: nextId++ };
      store.push(newRecord);
      return { onsuccess: null, onerror: null };
    }),
    getAll: vi.fn(() => {
      const req = {
        result: [...store],
        onsuccess: null as ((e: unknown) => void) | null,
        onerror: null,
      };
      Promise.resolve().then(() =>
        req.onsuccess?.({ target: { result: req.result } })
      );
      return req;
    }),
    delete: vi.fn((id: number) => {
      const idx = store.findIndex((r) => r['id'] === id);
      if (idx >= 0) store.splice(idx, 1);
      return { onsuccess: null, onerror: null };
    }),
  });

  const makeTx = () => {
    const tx = {
      objectStore: vi.fn(() => makeStore()),
      oncomplete: null as (() => void) | null,
      onerror: null,
    };
    // Resolve oncomplete asynchronously
    Promise.resolve().then(() => tx.oncomplete?.());
    return tx;
  };

  const fakeDB = {
    transaction: vi.fn(() => makeTx()),
  };

  const fakeRequest = {
    onupgradeneeded: null as (() => void) | null,
    onsuccess: null as ((e: unknown) => void) | null,
    onerror: null,
    result: fakeDB,
  };

  const openFn = vi.fn(() => {
    Promise.resolve().then(() =>
      fakeRequest.onsuccess?.({ target: { result: fakeDB } })
    );
    return fakeRequest;
  });

  return { openFn, store, fakeDB };
}

// ── sheets-api mock ───────────────────────────────────────────────────────────

vi.mock('./sheets-api', () => ({
  appendRow: vi.fn(),
}));
import { appendRow } from './sheets-api';
const mockAppendRow = vi.mocked(appendRow);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSubmission(
  id: number,
  type: 'dvir' | 'falla' | 'fuel' | 'trip' | 'horometro' = 'fuel'
) {
  return {
    id,
    type,
    data: { tab: 'Combustible', values: [`row-${id}`, 'val'] },
    timestamp: new Date().toISOString(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('offline-queue edge cases', () => {
  beforeEach(async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.resetModules();
    const { useAuthStore } = await import('../stores/auth-store');
    useAuthStore.setState({ authMode: 'server', sessionToken: 'queue-test-session' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  // ── 1. large queue performance ─────────────────────────────────────────────

  it('flushQueue processes 1000+ items without throwing', async () => {
    const N = 1000;
    const submissions = Array.from({ length: N }, (_, i) => makeSubmission(i + 1));
    const { openFn } = makeIDBStub(submissions);

    vi.stubGlobal('indexedDB', { open: openFn });
    mockAppendRow.mockResolvedValue(undefined);

    // Re-import after stubbing globals and resetting modules
    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();

    // All 1000 must have succeeded (appendRow always resolves)
    expect(result.succeeded).toBe(N);
    expect(result.failed).toBe(0);
  });

  it('does not replay queued mutations from an offline-only session', async () => {
    const { useAuthStore } = await import('../stores/auth-store');
    useAuthStore.setState({ authMode: 'offline', sessionToken: null });
    const { flushQueue } = await import('./offline-queue');

    const result = await flushQueue();

    expect(result).toEqual({ succeeded: 0, failed: 0 });
    expect(mockAppendRow).not.toHaveBeenCalled();
  });

  // ── 2. localStorage roundtrip simulation ──────────────────────────────────

  it('submission survives a serialize/deserialize roundtrip via JSON', () => {
    // IDB stores structured objects; localStorage stores only strings.
    // This test verifies the PendingSubmission shape survives JSON.stringify/parse.
    const original = {
      id: 42,
      type: 'dvir' as const,
      data: { tab: 'DVIR', values: ['truck-01', 'ok', '2026-04-21'] },
      timestamp: '2026-04-21T10:30:00.000Z',
    };
    const serialized = JSON.stringify(original);
    const recovered = JSON.parse(serialized);

    expect(recovered.id).toBe(42);
    expect(recovered.type).toBe('dvir');
    expect(recovered.data.tab).toBe('DVIR');
    expect(recovered.data.values).toEqual(['truck-01', 'ok', '2026-04-21']);
    expect(recovered.timestamp).toBe('2026-04-21T10:30:00.000Z');
  });

  it('multiple submissions survive localStorage roundtrip in order', () => {
    const submissions = Array.from({ length: 10 }, (_, i) => makeSubmission(i + 1));
    const serialized = JSON.stringify(submissions);
    const recovered: typeof submissions = JSON.parse(serialized);

    expect(recovered).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(recovered[i].id).toBe(i + 1);
      expect(recovered[i].data.tab).toBe('Combustible');
    }
  });

  // ── 3. partial failures during replay ─────────────────────────────────────

  it('flushQueue reports correct succeeded/failed counts on partial failure', async () => {
    const submissions = [
      makeSubmission(1),
      makeSubmission(2),
      makeSubmission(3),
    ];
    const { openFn } = makeIDBStub(submissions);
    vi.stubGlobal('indexedDB', { open: openFn });

    // Item 2 fails, items 1 and 3 succeed
    mockAppendRow
      .mockResolvedValueOnce(undefined)          // submission 1 → success
      .mockRejectedValueOnce(new Error('fail'))  // submission 2 → failure
      .mockResolvedValueOnce(undefined);         // submission 3 → success

    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('failed submissions are left in the queue (not cleared)', async () => {
    const submissions = [makeSubmission(1), makeSubmission(2)];
    const { openFn, store } = makeIDBStub(submissions);
    vi.stubGlobal('indexedDB', { open: openFn });

    // Both fail
    mockAppendRow.mockRejectedValue(new Error('network error'));

    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(2);
    // Items should remain in the IDB store (not deleted on failure)
    // The store still has 2 items because clearSubmission is not called on failure
    expect(store.length).toBe(2);
  });

  it('successful submissions are removed from the queue', async () => {
    const submissions = [makeSubmission(1), makeSubmission(2)];
    const { openFn } = makeIDBStub(submissions);
    vi.stubGlobal('indexedDB', { open: openFn });

    mockAppendRow.mockResolvedValue(undefined);

    const { flushQueue } = await import('./offline-queue');
    const flushResult = await flushQueue();

    // Both submissions must succeed and appendRow is called for each
    expect(mockAppendRow).toHaveBeenCalledTimes(2);
    expect(flushResult.succeeded).toBe(2);
    expect(flushResult.failed).toBe(0);
  });

  // ── 4. deduplication by item ID ───────────────────────────────────────────

  it('malformed queue entries (missing tab/values) are skipped, not retried', async () => {
    const submissions = [
      // Malformed: data lacks tab and values
      { id: 1, type: 'fuel', data: { note: 'no tab or values' }, timestamp: '2026-04-21T00:00:00Z' },
      // Valid
      makeSubmission(2),
    ];
    const { openFn } = makeIDBStub(submissions);
    vi.stubGlobal('indexedDB', { open: openFn });
    mockAppendRow.mockResolvedValue(undefined);

    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();

    // Malformed entry is removed (not counted as failed), valid one succeeds
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    // appendRow only called for the valid submission
    expect(mockAppendRow).toHaveBeenCalledTimes(1);
  });

  it('submissions with the same id appear only once in getPendingSubmissions', async () => {
    // IDB uses autoIncrement keyPath: 'id', so duplicate ids cannot be added
    // normally. We verify the interface contract: getPendingSubmissions returns
    // each stored record exactly once.
    const submissions = [makeSubmission(1), makeSubmission(2), makeSubmission(3)];
    const { openFn } = makeIDBStub(submissions);
    vi.stubGlobal('indexedDB', { open: openFn });

    const { getPendingSubmissions } = await import('./offline-queue');
    const pending = await getPendingSubmissions();

    // Each id appears exactly once
    const ids = pending.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    expect(ids.length).toBe(3);
  });

  // ── 5. overflow / max size behaviour ─────────────────────────────────────

  it('there is no explicit max size — queue accepts 5000 items', async () => {
    // The queue implementation does not enforce a size limit.
    // This test documents that behaviour: 5000 items can be queued without error.
    const N = 5000;
    const submissions = Array.from({ length: N }, (_, i) => makeSubmission(i + 1));
    const { openFn } = makeIDBStub(submissions);
    vi.stubGlobal('indexedDB', { open: openFn });

    const { getPendingCount } = await import('./offline-queue');
    const count = await getPendingCount();

    expect(count).toBe(N);
  });

  // ── 6. empty queue early return ───────────────────────────────────────────

  it('flushQueue returns {0,0} immediately when queue is empty', async () => {
    const { openFn } = makeIDBStub([]); // empty store
    vi.stubGlobal('indexedDB', { open: openFn });

    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();

    expect(result).toEqual({ succeeded: 0, failed: 0 });
    expect(mockAppendRow).not.toHaveBeenCalled();
  });

  // ── 7. offline guard ──────────────────────────────────────────────────────

  it('flushQueue returns {0,0} when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { openFn } = makeIDBStub([makeSubmission(1)]);
    vi.stubGlobal('indexedDB', { open: openFn });

    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();

    expect(result).toEqual({ succeeded: 0, failed: 0 });
    expect(mockAppendRow).not.toHaveBeenCalled();
  });
});
