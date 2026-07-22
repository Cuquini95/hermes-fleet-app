import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock zustand persist middleware so tests don't touch localStorage.
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    ...actual,
    persist: (config: unknown) => config,
  };
});

const { useAuthStore } = await import('./auth-store');

function getStore() {
  return useAuthStore.getState();
}

function setBrowserOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

function resetStore() {
  useAuthStore.setState({
    role: null,
    userName: '',
    assignedUnits: [],
    isAuthenticated: false,
    authMode: null,
    sessionToken: null,
    sessionExpiresAt: null,
  });
}

describe('auth-store', () => {
  beforeEach(() => {
    setBrowserOnline(false);
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts unauthenticated and without an auth mode', () => {
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().authMode).toBeNull();
    expect(getStore().role).toBeNull();
  });

  it('allows the local PIN only as an explicit offline session', async () => {
    const result = await getStore().login('operador', '2026');

    expect(result).toEqual({ success: true, mode: 'offline' });
    expect(getStore().isAuthenticated).toBe(true);
    expect(getStore().authMode).toBe('offline');
    expect(getStore().sessionToken).toBeNull();
    expect(getStore().role).toBe('operador');
    expect(getStore().assignedUnits).toEqual(['CA22']);
  });

  it('rejects an incorrect offline PIN without changing auth state', async () => {
    const result = await getStore().login('operador', '0000');

    expect(result).toEqual({ success: false, reason: 'invalid_pin' });
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().authMode).toBeNull();
  });

  it('requires the server session when the browser is online', async () => {
    setBrowserOnline(true);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Hermes auth is not configured.' }), { status: 503 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getStore().login('operador', '2026');

    expect(result).toEqual({ success: false, reason: 'server_unavailable' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().authMode).toBeNull();
    expect(getStore().sessionToken).toBeNull();
  });

  it('rejects online credentials rejected by the server', async () => {
    setBrowserOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    const result = await getStore().login('supervisor', '2008');

    expect(result).toEqual({ success: false, reason: 'server_rejected' });
    expect(getStore().isAuthenticated).toBe(false);
  });

  it('stores a role-matching server session and server identity', async () => {
    setBrowserOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        token: 'signed-session-token',
        role: 'supervisor',
        user_name: 'Supervisor QA',
        assigned_units: ['CA22'],
        expires_at: '2099-01-01T00:00:00.000Z',
      }), { status: 200 }),
    ));

    const result = await getStore().login('supervisor', '2008');

    expect(result).toEqual({ success: true, mode: 'server' });
    expect(getStore().isAuthenticated).toBe(true);
    expect(getStore().authMode).toBe('server');
    expect(getStore().sessionToken).toBe('signed-session-token');
    expect(getStore().sessionExpiresAt).toBe('2099-01-01T00:00:00.000Z');
    expect(getStore().userName).toBe('Supervisor QA');
    expect(getStore().assignedUnits).toEqual(['CA22']);
  });

  it('rejects a server response that claims a different role', async () => {
    setBrowserOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: 'token', role: 'gerencia' }), { status: 200 }),
    ));

    const result = await getStore().login('supervisor', '2008');

    expect(result).toEqual({ success: false, reason: 'server_unavailable' });
    expect(getStore().isAuthenticated).toBe(false);
  });

  it('rejects a server session that is already expired', async () => {
    setBrowserOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        token: 'expired-token',
        role: 'operador',
        expires_at: '2020-01-01T00:00:00.000Z',
      }), { status: 200 }),
    ));

    const result = await getStore().login('operador', '2026');

    expect(result).toEqual({ success: false, reason: 'server_unavailable' });
    expect(getStore().isAuthenticated).toBe(false);
  });

  it('logout clears offline and server session state', async () => {
    await getStore().login('operador', '2026');
    getStore().logout();

    expect(getStore().role).toBeNull();
    expect(getStore().userName).toBe('');
    expect(getStore().assignedUnits).toEqual([]);
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().authMode).toBeNull();
    expect(getStore().sessionToken).toBeNull();
    expect(getStore().sessionExpiresAt).toBeNull();
  });
});
