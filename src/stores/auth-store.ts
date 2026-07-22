import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '../types/roles';

export type AuthMode = 'server' | 'offline';

export type LoginResult =
  | { success: true; mode: AuthMode }
  | { success: false; reason: 'invalid_pin' | 'server_rejected' | 'server_unavailable' };

interface ServerSession {
  token: string;
  role: AppRole;
  user_name?: string;
  assigned_units?: string[];
  expires_at?: string;
}

type ServerSessionExchange =
  | { ok: true; session: ServerSession }
  | { ok: false; reason: 'rejected' | 'unavailable' };

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  authMode: AuthMode | null;
  /** HMAC session from /api/auth/login; absent for an offline-only session. */
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  login: (role: AppRole, pin: string) => Promise<LoginResult>;
  logout: () => void;
}

/**
 * Local emergency access for an offline field shell. This is not a production
 * authentication boundary: all online access must pass through /api/auth/login.
 */
export const MOCK_USERS: Record<AppRole, { userName: string; assignedUnits: string[]; pin: string }> = {
  operador:    { userName: 'Operador',       assignedUnits: ['CA22'], pin: '2026' },
  mecanico:    { userName: 'Mecánico',       assignedUnits: [], pin: '2015' },
  jefe_taller: { userName: 'Jefe de Taller', assignedUnits: [], pin: '1995' },
  coordinador: { userName: 'Coordinador',    assignedUnits: [], pin: '2001' },
  supervisor:  { userName: 'Supervisor',     assignedUnits: ['CA22', 'CA26', 'EH45'], pin: '2008' },
  gerencia:    { userName: 'Gerencia',       assignedUnits: [], pin: '1963' },
};

export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === true;
}

export async function exchangeServerSession(
  role: AppRole,
  pin: string,
): Promise<ServerSessionExchange> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: role, role, password: pin }),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'rejected' };
    }
    if (!res.ok) return { ok: false, reason: 'unavailable' };

    const data = (await res.json()) as {
      token?: unknown;
      role?: unknown;
      user_name?: unknown;
      assigned_units?: unknown;
      expires_at?: unknown;
    };
    const expiresAt = typeof data.expires_at === 'string' ? data.expires_at : '';
    if (
      typeof data.token !== 'string'
      || data.token.length === 0
      || data.role !== role
      || !expiresAt
      || !Number.isFinite(Date.parse(expiresAt))
      || Date.parse(expiresAt) <= Date.now()
    ) {
      return { ok: false, reason: 'unavailable' };
    }

    return {
      ok: true,
      session: {
        token: data.token,
        role,
        user_name: typeof data.user_name === 'string' ? data.user_name : undefined,
        assigned_units: Array.isArray(data.assigned_units)
          ? data.assigned_units.filter((unit): unit is string => typeof unit === 'string')
          : undefined,
        expires_at: expiresAt,
      },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

const EMPTY_AUTH_STATE = {
  role: null,
  userName: '',
  assignedUnits: [],
  isAuthenticated: false,
  authMode: null,
  sessionToken: null,
  sessionExpiresAt: null,
} satisfies Omit<AuthState, 'login' | 'logout'>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...EMPTY_AUTH_STATE,

      login: async (role: AppRole, pin: string): Promise<LoginResult> => {
        set(EMPTY_AUTH_STATE);
        if (pin.length !== 4) return { success: false, reason: 'invalid_pin' };

        if (isBrowserOnline()) {
          const exchange = await exchangeServerSession(role, pin);
          if (!exchange.ok) {
            return {
              success: false,
              reason: exchange.reason === 'rejected' ? 'server_rejected' : 'server_unavailable',
            };
          }

          const session = exchange.session;
          set({
            role,
            userName: session.user_name || MOCK_USERS[role].userName,
            assignedUnits: session.assigned_units ?? MOCK_USERS[role].assignedUnits,
            isAuthenticated: true,
            authMode: 'server',
            sessionToken: session.token,
            sessionExpiresAt: session.expires_at ?? null,
          });
          return { success: true, mode: 'server' };
        }

        const user = MOCK_USERS[role];
        if (pin !== user.pin) return { success: false, reason: 'invalid_pin' };

        set({
          role,
          userName: user.userName,
          assignedUnits: user.assignedUnits,
          isAuthenticated: true,
          authMode: 'offline',
          sessionToken: null,
          sessionExpiresAt: null,
        });
        return { success: true, mode: 'offline' };
      },

      logout: () => {
        set(EMPTY_AUTH_STATE);
      },
    }),
    {
      name: 'hermes-auth',
      // Only persist session state, not the action functions.
      partialize: (state) => ({
        role: state.role,
        userName: state.userName,
        assignedUnits: state.assignedUnits,
        isAuthenticated: state.isAuthenticated,
        authMode: state.authMode,
        sessionToken: state.sessionToken,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
    },
  ),
);
