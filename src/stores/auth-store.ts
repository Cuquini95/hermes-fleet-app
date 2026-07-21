import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '../types/roles';

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  /** HMAC session from /api/auth/login when server users are configured. */
  sessionToken: string | null;
  login: (role: AppRole, pin: string) => boolean;
  logout: () => void;
}

/** Role PIN map (also used as server password when HERMES_AUTH_USERS_JSON matches). */
export const MOCK_USERS: Record<AppRole, { userName: string; assignedUnits: string[]; pin: string }> = {
  operador:    { userName: 'Operador',       assignedUnits: ['CA22'], pin: '2026' },
  mecanico:    { userName: 'Mecánico',       assignedUnits: [], pin: '2015' },
  jefe_taller: { userName: 'Jefe de Taller', assignedUnits: [], pin: '1995' },
  coordinador: { userName: 'Coordinador',    assignedUnits: [], pin: '2001' },
  supervisor:  { userName: 'Supervisor',     assignedUnits: ['CA22', 'CA26', 'EH45'], pin: '2008' },
  gerencia:    { userName: 'Gerencia',       assignedUnits: [], pin: '1963' },
};

/** Best-effort server session exchange; UI login still succeeds on PIN alone. */
export async function exchangeServerSession(
  role: AppRole,
  pin: string,
): Promise<{ token: string; user_name?: string; assigned_units?: string[] } | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: role, role, password: pin }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      user_name?: string;
      assigned_units?: string[];
    };
    if (!data.token) return null;
    return {
      token: data.token,
      user_name: data.user_name,
      assigned_units: data.assigned_units,
    };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      userName: '',
      assignedUnits: [],
      isAuthenticated: false,
      sessionToken: null,

      login: (role: AppRole, pin: string): boolean => {
        if (pin.length !== 4) return false;
        const user = MOCK_USERS[role];
        if (pin !== user.pin) return false;
        set({
          role,
          userName: user.userName,
          assignedUnits: user.assignedUnits,
          isAuthenticated: true,
          sessionToken: null,
        });
        // Non-blocking: attach server HMAC session when env users match PIN map
        void exchangeServerSession(role, pin).then((session) => {
          if (!session) return;
          set({
            sessionToken: session.token,
            userName: session.user_name || user.userName,
            assignedUnits: session.assigned_units ?? user.assignedUnits,
          });
        });
        return true;
      },

      logout: () => {
        set({
          role: null,
          userName: '',
          assignedUnits: [],
          isAuthenticated: false,
          sessionToken: null,
        });
      },
    }),
    {
      name: 'hermes-auth',
      // Only persist the session state, not the action functions
      partialize: (state) => ({
        role: state.role,
        userName: state.userName,
        assignedUnits: state.assignedUnits,
        isAuthenticated: state.isAuthenticated,
        sessionToken: state.sessionToken,
      }),
    }
  )
);
