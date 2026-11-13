import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

const { useAuthStore } = await import('./auth-store');

const operatorProfile = {
  userId: '00000000-0000-4000-8000-000000000001', userName: 'Operadora de prueba', role: 'operador',
  project: 'tcm', projects: ['tcm'], assignedUnits: ['CA22'], unitScope: 'assigned', allUnits: false,
  canApprovePurchases: false,
  canReceivePurchases: false,
  canReviewPanamaHse: false,
};

function resetStore() {
  useAuthStore.setState({
    role: null,
    userName: '',
    assignedUnits: [],
    isAuthenticated: false,
    sessionChecked: false,
    sessionUnavailable: false,
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

  it('rejects missing personal credentials without calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(useAuthStore.getState().login('operador', 'fixture-password')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the server response as the authenticated profile', async () => {
    const request = vi.fn().mockResolvedValue(response(200, { ...operatorProfile, role: 'mecanico' }));
    vi.stubGlobal('fetch', request);
    await expect(useAuthStore.getState().login('operadora@example.test', 'fixture-password')).resolves.toBe(true);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ email: 'operadora@example.test', password: 'fixture-password' });
    expect(useAuthStore.getState()).toMatchObject({
      role: 'mecanico', userName: 'Operadora de prueba', isAuthenticated: true, sessionChecked: true,
    });
  });

  it('fails closed on invalid credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { error: 'invalid' })));
    await expect(useAuthStore.getState().login('operadora@example.test', 'fixture-password')).resolves.toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('distinguishes a provider outage from a rejected sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503)));
    await expect(useAuthStore.getState().login('operadora@example.test', 'fixture-password')).resolves.toBe(false);
    expect(useAuthStore.getState().loginFailure).toBe('unavailable');
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
      ...operatorProfile, role: 'supervisor',
    })));
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState()).toMatchObject({
      role: 'supervisor', assignedUnits: ['CA22'], isAuthenticated: true, sessionChecked: true,
    });
  });

  it('keeps protected routes closed after a network error and revalidates on retry', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(response(200, operatorProfile)));
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false, sessionChecked: true, sessionUnavailable: true,
    });
    await useAuthStore.getState().validateSession();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true, sessionChecked: true, sessionUnavailable: false,
    });
  });

  it('logs out server-side and clears local state', async () => {
    useAuthStore.setState({ role: 'operador', userName: 'Operador', isAuthenticated: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(204)));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ role: null, isAuthenticated: false });
  });

  it('keeps the employee in control when logout cannot be confirmed', async () => {
    useAuthStore.setState({ role: 'operador', userName: 'Operadora de prueba', isAuthenticated: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503)));
    await expect(useAuthStore.getState().logout()).resolves.toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
