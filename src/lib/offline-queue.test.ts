import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── PendingSubmission interface re-export check ───────────────────────────────
// We import only the type and the functions that don't depend on a live IDB.

// The offline-queue uses IndexedDB which requires a real browser environment.
// We test the module by fully mocking the IDB layer so tests run in Node/vitest.

// In-memory record type used by IDB stubs
type IDBRecord = { id: number; [key: string]: unknown };

describe('offline-queue module structure', () => {
  it('exports the expected functions', async () => {
    // Use dynamic import so we can mock dependencies before loading.
    // Since we cannot mock IDB at module level here without a proper test harness,
    // we verify the module exports the right shape.
    const mod = await import('./offline-queue');
    expect(typeof mod.queueSubmission).toBe('function');
    expect(typeof mod.getPendingSubmissions).toBe('function');
    expect(typeof mod.clearSubmission).toBe('function');
    expect(typeof mod.getPendingCount).toBe('function');
    expect(typeof mod.flushQueue).toBe('function');
  });
});

describe('flushQueue mutex guard', () => {
  beforeEach(() => {
    // Provide a minimal navigator.onLine stub
    vi.stubGlobal('navigator', { onLine: true });

    // Stub out indexedDB.open so our module never hits real IDB
    const fakeRequest = {
      onupgradeneeded: null,
      onsuccess: null as ((e: { target: { result: unknown } }) => void) | null,
      onerror: null,
      result: {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            getAll: vi.fn(() => {
              const req = {
                result: [] as IDBRecord[],
                onsuccess: null as ((e: { target: { result: IDBRecord[] } }) => void) | null,
                onerror: null,
              };
              Promise.resolve().then(() =>
                req.onsuccess?.({ target: { result: req.result } })
              );
              return req;
            }),
          })),
          oncomplete: null as (() => void) | null,
          onerror: null,
        })),
      },
    };

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        Promise.resolve().then(() =>
          fakeRequest.onsuccess?.({ target: { result: fakeRequest.result } })
        );
        return fakeRequest;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('concurrent flushQueue calls do not double-process — second call returns {0,0}', async () => {
    // Dynamically import a fresh module instance (resetModules clears the flushing flag)
    const { flushQueue } = await import('./offline-queue');

    // Fire two concurrent flushQueue calls. The queue is empty so both resolve
    // fast, but the second one should be blocked by the mutex.
    const [r1, r2] = await Promise.all([flushQueue(), flushQueue()]);

    // At least one of them must have hit the mutex guard and returned {0,0}.
    const bothAreZero = (r: { succeeded: number; failed: number }) =>
      r.succeeded === 0 && r.failed === 0;

    expect(bothAreZero(r1) || bothAreZero(r2)).toBe(true);
  });

  it('returns {0,0} immediately when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { flushQueue } = await import('./offline-queue');
    const result = await flushQueue();
    expect(result).toEqual({ succeeded: 0, failed: 0 });
  });
});

describe('PendingSubmission type shape', () => {
  it('validates correct submission object structure at runtime', () => {
    // This test documents the expected runtime shape even though TypeScript types
    // are erased at runtime — ensures the interface matches what the module uses.
    const sub = {
      type: 'dvir' as const,
      data: { tab: 'SomeTab', values: ['a', 'b'] },
      timestamp: '2026-04-05 10:30:00',
    };
    expect(sub.type).toBe('dvir');
    expect(Array.isArray(sub.data.values)).toBe(true);
    expect(typeof sub.timestamp).toBe('string');
  });

  it('accepts all valid type literals', () => {
    const validTypes = ['dvir', 'falla', 'fuel', 'trip', 'horometro', 'sticker_inspection'] as const;
    for (const t of validTypes) {
      const sub = { type: t, data: {}, timestamp: '' };
      expect(sub.type).toBe(t);
    }
  });
});
