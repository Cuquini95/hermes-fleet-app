import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock zustand persist middleware so tests don't touch localStorage
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    ...actual,
    persist: (config: unknown) => config, // no-op persist in tests
  };
});

// Import AFTER mocks
const { useAuthStore } = await import('./auth-store');

function getStore() {
  return useAuthStore.getState();
}

function resetStore() {
  useAuthStore.setState({
    role: null,
    userName: '',
    assignedUnits: [],
    isAuthenticated: false,
  });
}

describe('auth-store — initial state', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with role=null', () => {
    expect(getStore().role).toBeNull();
  });

  it('starts with userName as empty string', () => {
    expect(getStore().userName).toBe('');
  });

  it('starts with assignedUnits as empty array', () => {
    expect(getStore().assignedUnits).toEqual([]);
  });

  it('starts with isAuthenticated=false', () => {
    expect(getStore().isAuthenticated).toBe(false);
  });
});

describe('auth-store — login success', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns true when pin is correct for operador', () => {
    const result = getStore().login('operador', '2026');
    expect(result).toBe(true);
  });

  it('sets isAuthenticated=true on successful login', () => {
    getStore().login('operador', '2026');
    expect(getStore().isAuthenticated).toBe(true);
  });

  it('sets role correctly after login', () => {
    getStore().login('operador', '2026');
    expect(getStore().role).toBe('operador');
  });

  it('sets userName correctly for operador', () => {
    getStore().login('operador', '2026');
    expect(getStore().userName).toBe('Operador');
  });

  it('sets assignedUnits correctly for operador', () => {
    getStore().login('operador', '2026');
    expect(getStore().assignedUnits).toEqual(['EPAK-09']);
  });

  it('returns true and sets state for mecanico with correct pin', () => {
    const result = getStore().login('mecanico', '2015');
    expect(result).toBe(true);
    expect(getStore().role).toBe('mecanico');
    expect(getStore().userName).toBe('Mecánico');
    expect(getStore().assignedUnits).toEqual([]);
  });

  it('returns true and sets state for supervisor with correct pin', () => {
    const result = getStore().login('supervisor', '2008');
    expect(result).toBe(true);
    expect(getStore().role).toBe('supervisor');
    expect(getStore().userName).toBe('Supervisor');
    expect(getStore().assignedUnits).toEqual(['EPAK-09', 'EPTK-08', 'EPCF-08']);
  });

  it('returns true and sets state for jefe_taller with correct pin', () => {
    const result = getStore().login('jefe_taller', '1995');
    expect(result).toBe(true);
    expect(getStore().role).toBe('jefe_taller');
    expect(getStore().userName).toBe('Jefe de Taller');
  });

  it('returns true for coordinador with correct pin', () => {
    const result = getStore().login('coordinador', '2001');
    expect(result).toBe(true);
    expect(getStore().role).toBe('coordinador');
  });

  it('returns true for gerencia with correct pin', () => {
    const result = getStore().login('gerencia', '1963');
    expect(result).toBe(true);
    expect(getStore().role).toBe('gerencia');
  });
});

describe('auth-store — login failure', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns false when pin is wrong', () => {
    const result = getStore().login('operador', '0000');
    expect(result).toBe(false);
  });

  it('does not change isAuthenticated when pin is wrong', () => {
    getStore().login('operador', '9999');
    expect(getStore().isAuthenticated).toBe(false);
  });

  it('does not set role when pin is wrong', () => {
    getStore().login('operador', '9999');
    expect(getStore().role).toBeNull();
  });

  it('returns false when pin length is not 4 (too short)', () => {
    const result = getStore().login('operador', '202');
    expect(result).toBe(false);
  });

  it('returns false when pin length is not 4 (too long)', () => {
    const result = getStore().login('operador', '20265');
    expect(result).toBe(false);
  });

  it('returns false when pin is empty string', () => {
    const result = getStore().login('operador', '');
    expect(result).toBe(false);
  });

  it('does not authenticate with the pin of a different role', () => {
    // mecanico pin used for operador role
    const result = getStore().login('operador', '2015');
    expect(result).toBe(false);
    expect(getStore().isAuthenticated).toBe(false);
  });
});

describe('auth-store — logout', () => {
  beforeEach(() => {
    resetStore();
  });

  it('clears role after logout', () => {
    getStore().login('operador', '2026');
    getStore().logout();
    expect(getStore().role).toBeNull();
  });

  it('clears userName after logout', () => {
    getStore().login('operador', '2026');
    getStore().logout();
    expect(getStore().userName).toBe('');
  });

  it('clears assignedUnits after logout', () => {
    getStore().login('operador', '2026');
    getStore().logout();
    expect(getStore().assignedUnits).toEqual([]);
  });

  it('sets isAuthenticated=false after logout', () => {
    getStore().login('operador', '2026');
    getStore().logout();
    expect(getStore().isAuthenticated).toBe(false);
  });

  it('logout is idempotent on an already-logged-out store', () => {
    getStore().logout();
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().role).toBeNull();
  });
});
