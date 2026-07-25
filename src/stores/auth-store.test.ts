import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return { ...actual, persist: (config: unknown) => config };
});

const { useAuthStore } = await import('./auth-store');

function resetStore() {
  useAuthStore.setState({
    role: null,
    userName: '',
    assignedUnits: [],
    isAuthenticated: false,
    sessionChecked: false,
  });
}

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('auth-store — server-backed session', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it('never contains a client-side role PIN table', async () => {
    const source = await readFile(new URL('./auth-store.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('MOCK_USERS');
    expect(source).not.toMatch(/pin:\s*['"]\d{4}/);
  });

  it('rejects malformed PINs without calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(useAuthStore.getState().login('operador', '12')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the server response as the authenticated profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, {
      role: 'mecanico', userName: 'Mecánico', assignedUnits: [],
    })));
    await expect(useAuthStore.getState().login('mecanico', '4567')).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      role: 'mecanico', userName: 'Mecánico', isAuthenticated: true, sessionChecked: true,
    });
  });

  it('fails closed on invalid credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { error: 'invalid' })));
    await expect(useAuthStore.getState().login('operador', '4567')).resolves.toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('clears forged persisted state when the HttpOnly session is invalid', async () => {
    useAuthStore.setState({ role: 'gerencia', userName: 'Gerencia', isAuthenticated: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)));
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState()).toMatchObject({
      role: null, isAuthenticated: false, sessionChecked: true,
    });
  });

  it('restores only a profile validated by the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, {
      role: 'supervisor', userName: 'Supervisor', assignedUnits: ['CA22'],
    })));
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState()).toMatchObject({
      role: 'supervisor', assignedUnits: ['CA22'], isAuthenticated: true, sessionChecked: true,
    });
  });

  it('logs out server-side and clears local state', async () => {
    useAuthStore.setState({ role: 'operador', userName: 'Operador', isAuthenticated: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(204)));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ role: null, isAuthenticated: false });
  });
});
