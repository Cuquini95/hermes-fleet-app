import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    ...actual,
    persist: (config: unknown) => config,
  };
});

const { sanitizePersistedAuth, useAuthStore } = await import('./auth-store');

const TEST_SESSION = {
  token: 'session-token-from-server-123456',
  role: 'operador',
  user_name: 'Operador',
  assigned_units: ['EPAK-09'],
  expires_at: new Date(Date.now() + 60_000).toISOString(),
};

function getStore() {
  return useAuthStore.getState();
}

function resetStore() {
  useAuthStore.setState({
    role: null,
    userName: '',
    assignedUnits: [],
    isAuthenticated: false,
    token: null,
    expiresAt: null,
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => TEST_SESSION,
    }),
  );
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizePersistedAuth', () => {
  function currentState() {
    return {
      role: null,
      userName: '',
      assignedUnits: [],
      isAuthenticated: false,
      token: null,
      expiresAt: null,
      login: vi.fn(),
      setSession: vi.fn(),
      logout: vi.fn(),
    };
  }

  it('drops stale mock tokens from previous client-only auth', () => {
    const sanitized = sanitizePersistedAuth(
      {
        role: 'gerencia',
        userName: 'Gerencia',
        assignedUnits: [],
        isAuthenticated: true,
        token: 'mock-gerencia',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      currentState(),
    );

    expect(sanitized.isAuthenticated).toBe(false);
    expect(sanitized.token).toBeNull();
  });

  it('keeps server-issued sessions with a valid role', () => {
    const sanitized = sanitizePersistedAuth(
      {
        role: 'supervisor',
        userName: 'Supervisor',
        assignedUnits: ['EPAK-09'],
        isAuthenticated: true,
        token: 'session-token-from-server-abcdef',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      currentState(),
    );

    expect(sanitized.isAuthenticated).toBe(true);
    expect(sanitized.role).toBe('supervisor');
    expect(sanitized.assignedUnits).toEqual(['EPAK-09']);
  });

  it('drops persisted sessions whose expiry has passed', () => {
    const sanitized = sanitizePersistedAuth(
      {
        role: 'supervisor',
        userName: 'Supervisor',
        assignedUnits: [],
        isAuthenticated: true,
        token: 'session-token-from-server-abcdef',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      currentState(),
    );

    expect(sanitized.isAuthenticated).toBe(false);
    expect(sanitized.token).toBeNull();
  });
});

describe('auth-store initial state', () => {
  it('starts without an authenticated session', () => {
    expect(getStore().role).toBeNull();
    expect(getStore().userName).toBe('');
    expect(getStore().assignedUnits).toEqual([]);
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().token).toBeNull();
    expect(getStore().expiresAt).toBeNull();
  });
});

describe('auth-store login', () => {
  it('posts the selected role and password to the server auth endpoint', async () => {
    const result = await getStore().login('operador', 'test-password');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'operador',
          role: 'operador',
          password: 'test-password',
        }),
      }),
    );
  });

  it('sets the server-returned session on successful login', async () => {
    await getStore().login('operador', 'test-password');

    expect(getStore().isAuthenticated).toBe(true);
    expect(getStore().role).toBe('operador');
    expect(getStore().userName).toBe('Operador');
    expect(getStore().assignedUnits).toEqual(['EPAK-09']);
    expect(getStore().token).toBe(TEST_SESSION.token);
    expect(getStore().expiresAt).toBe(TEST_SESSION.expires_at);
  });

  it('does not call the server when password is blank', async () => {
    const result = await getStore().login('operador', ' ');

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false and keeps state clear when the server rejects credentials', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const result = await getStore().login('operador', 'bad-password');

    expect(result).toBe(false);
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().role).toBeNull();
    expect(getStore().token).toBeNull();
    expect(getStore().expiresAt).toBeNull();
  });

  it('returns false when the server response is missing a session token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ role: 'operador', user_name: 'Operador' }),
    } as Response);

    const result = await getStore().login('operador', 'test-password');

    expect(result).toBe(false);
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().expiresAt).toBeNull();
  });
});

describe('auth-store setSession', () => {
  it('accepts a valid server session', () => {
    const result = getStore().setSession(TEST_SESSION);

    expect(result).toBe(true);
    expect(getStore().isAuthenticated).toBe(true);
    expect(getStore().role).toBe('operador');
  });

  it('rejects invalid role sessions', () => {
    const result = getStore().setSession({
      ...TEST_SESSION,
      role: 'unknown' as never,
    });

    expect(result).toBe(false);
    expect(getStore().isAuthenticated).toBe(false);
  });
});

describe('auth-store logout', () => {
  it('clears the server session', async () => {
    await getStore().login('operador', 'test-password');

    getStore().logout();

    expect(getStore().role).toBeNull();
    expect(getStore().userName).toBe('');
    expect(getStore().assignedUnits).toEqual([]);
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().token).toBeNull();
    expect(getStore().expiresAt).toBeNull();
  });
});
