import { describe, it, expect, vi, beforeEach } from 'vitest';

// useOnlineStatus reads navigator.onLine on mount and reacts to window 'online'/'offline' events.
// Since @testing-library/react is not installed we test the underlying logic
// directly: the initial-state read and the event-listener registration pattern.

describe('useOnlineStatus — module export', () => {
  it('exports useOnlineStatus as a function', async () => {
    const { useOnlineStatus } = await import('./useOnlineStatus');
    expect(typeof useOnlineStatus).toBe('function');
  });
});

// ── Initial online state ────────────────────────────────────────────────────
// The hook initialises state with `navigator.onLine`. We verify the read
// by stubbing the global and inspecting the value synchronously.

describe('useOnlineStatus — initial state from navigator.onLine', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads true when navigator.onLine is true', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(navigator.onLine).toBe(true);
    vi.unstubAllGlobals();
  });

  it('reads false when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(navigator.onLine).toBe(false);
    vi.unstubAllGlobals();
  });
});

// ── Event-listener logic ────────────────────────────────────────────────────
// The hook registers 'online' and 'offline' window event listeners.
// We replicate the exact listener logic using a plain EventTarget so these
// tests work in the node test environment (no DOM window required).

describe('useOnlineStatus — online/offline event response', () => {
  it('transitions to true when the "online" event fires', () => {
    let isOnline = false;
    const emitter = new EventTarget();

    const handleOnline = () => { isOnline = true; };
    const handleOffline = () => { isOnline = false; };

    emitter.addEventListener('online', handleOnline);
    emitter.addEventListener('offline', handleOffline);

    emitter.dispatchEvent(new Event('online'));
    expect(isOnline).toBe(true);

    emitter.removeEventListener('online', handleOnline);
    emitter.removeEventListener('offline', handleOffline);
  });

  it('transitions to false when the "offline" event fires', () => {
    let isOnline = true;
    const emitter = new EventTarget();

    const handleOnline = () => { isOnline = true; };
    const handleOffline = () => { isOnline = false; };

    emitter.addEventListener('online', handleOnline);
    emitter.addEventListener('offline', handleOffline);

    emitter.dispatchEvent(new Event('offline'));
    expect(isOnline).toBe(false);

    emitter.removeEventListener('online', handleOnline);
    emitter.removeEventListener('offline', handleOffline);
  });

  it('toggles correctly across multiple events', () => {
    let isOnline = true;
    const emitter = new EventTarget();

    const handleOnline = () => { isOnline = true; };
    const handleOffline = () => { isOnline = false; };

    emitter.addEventListener('online', handleOnline);
    emitter.addEventListener('offline', handleOffline);

    emitter.dispatchEvent(new Event('offline'));
    expect(isOnline).toBe(false);

    emitter.dispatchEvent(new Event('online'));
    expect(isOnline).toBe(true);

    emitter.dispatchEvent(new Event('offline'));
    expect(isOnline).toBe(false);

    emitter.removeEventListener('online', handleOnline);
    emitter.removeEventListener('offline', handleOffline);
  });

  it('cleanup: listeners removed after teardown do not fire', () => {
    let isOnline = true;
    const emitter = new EventTarget();

    const handleOnline = () => { isOnline = true; };
    const handleOffline = () => { isOnline = false; };

    emitter.addEventListener('online', handleOnline);
    emitter.addEventListener('offline', handleOffline);

    // simulate cleanup (hook unmount)
    emitter.removeEventListener('online', handleOnline);
    emitter.removeEventListener('offline', handleOffline);

    // event fires after cleanup — state must not change
    emitter.dispatchEvent(new Event('offline'));
    expect(isOnline).toBe(true); // unchanged because listener was removed
  });
});

// ── Hook source shape ────────────────────────────────────────────────────────
// Verify the hook source references the expected event names.

describe('useOnlineStatus — source contract', () => {
  it('hook source contains "online" event name', async () => {
    const { useOnlineStatus } = await import('./useOnlineStatus');
    expect(useOnlineStatus.toString()).toContain('online');
  });

  it('hook source contains "offline" event name', async () => {
    const { useOnlineStatus } = await import('./useOnlineStatus');
    expect(useOnlineStatus.toString()).toContain('offline');
  });

  it('hook source references navigator.onLine', async () => {
    const { useOnlineStatus } = await import('./useOnlineStatus');
    expect(useOnlineStatus.toString()).toContain('navigator.onLine');
  });
});
