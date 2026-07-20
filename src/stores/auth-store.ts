import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '../types/roles';

interface AuthSession {
  token: string;
  role: AppRole;
  user_name: string;
  assigned_units?: string[];
  expires_at?: string;
}

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  token: string | null;
  expiresAt: string | null;
  login: (role: AppRole, password: string) => Promise<boolean>;
  setSession: (session: AuthSession) => boolean;
  logout: () => void;
}

const AUTH_ENDPOINT = '/api/auth/login';
const ROLES = new Set<AppRole>(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

function isValidSession(session: Partial<AuthSession>): session is AuthSession {
  return (
    typeof session.token === 'string' &&
    session.token.length > 20 &&
    typeof session.role === 'string' &&
    ROLES.has(session.role as AppRole) &&
    typeof session.user_name === 'string' &&
    typeof session.expires_at === 'string' &&
    Date.parse(session.expires_at) > Date.now() &&
    (session.assigned_units === undefined || Array.isArray(session.assigned_units))
  );
}

function stateFromSession(session: AuthSession) {
  return {
    role: session.role,
    userName: session.user_name,
    assignedUnits: session.assigned_units ?? [],
    isAuthenticated: true,
    token: session.token,
    expiresAt: session.expires_at,
  };
}

export function sanitizePersistedAuth(persisted: unknown, current: AuthState): AuthState {
  if (!persisted || typeof persisted !== 'object') return current;
  const state = persisted as Partial<AuthState> & { expires_at?: string };
  if (
    typeof state.token !== 'string' ||
    state.token.startsWith('mock-') ||
    typeof state.role !== 'string' ||
    !ROLES.has(state.role as AppRole) ||
    typeof state.expiresAt !== 'string' ||
    Date.parse(state.expiresAt) <= Date.now()
  ) {
    return current;
  }
  return {
    ...current,
    role: state.role as AppRole,
    userName: typeof state.userName === 'string' ? state.userName : '',
    assignedUnits: Array.isArray(state.assignedUnits) ? state.assignedUnits : [],
    isAuthenticated: true,
    token: state.token,
    expiresAt: state.expiresAt,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      userName: '',
      assignedUnits: [],
      isAuthenticated: false,
      token: null,
      expiresAt: null,

      login: async (role, password) => {
        if (!ROLES.has(role) || !password.trim()) return false;
        const res = await fetch(AUTH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: role, role, password }),
        });
        if (!res.ok) return false;
        const session = (await res.json()) as Partial<AuthSession>;
        if (!isValidSession(session)) return false;
        set(stateFromSession(session));
        return true;
      },

      setSession: (session) => {
        if (!isValidSession(session)) return false;
        set(stateFromSession(session));
        return true;
      },

      logout: () => {
        set({
          role: null,
          userName: '',
          assignedUnits: [],
          isAuthenticated: false,
          token: null,
          expiresAt: null,
        });
      },
    }),
    {
      name: 'hermes-auth',
      partialize: (state) => ({
        role: state.role,
        userName: state.userName,
        assignedUnits: state.assignedUnits,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        expiresAt: state.expiresAt,
      }),
      merge: sanitizePersistedAuth,
    }
  )
);
