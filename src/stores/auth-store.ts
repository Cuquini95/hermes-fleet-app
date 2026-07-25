import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '../types/roles';

interface SessionProfile {
  role: AppRole;
  userName: string;
  assignedUnits: string[];
}

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  sessionChecked: boolean;
  login: (role: AppRole, pin: string) => Promise<boolean>;
  validateSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const cleared = {
  role: null,
  userName: '',
  assignedUnits: [],
  isAuthenticated: false,
};

function validProfile(value: unknown): value is SessionProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<SessionProfile>;
  return typeof profile.role === 'string'
    && typeof profile.userName === 'string'
    && Array.isArray(profile.assignedUnits)
    && profile.assignedUnits.every((unit) => typeof unit === 'string');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...cleared,
      sessionChecked: false,

      login: async (role: AppRole, pin: string): Promise<boolean> => {
        if (!/^\d{4,8}$/.test(pin)) return false;
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, pin }),
          });
          if (!response.ok) return false;
          const profile: unknown = await response.json();
          if (!validProfile(profile) || profile.role !== role) return false;
          set({ ...profile, isAuthenticated: true, sessionChecked: true });
          return true;
        } catch {
          return false;
        }
      },

      validateSession: async () => {
        try {
          const response = await fetch('/api/auth/session', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            set({ ...cleared, sessionChecked: true });
            return;
          }
          const profile: unknown = await response.json();
          if (!validProfile(profile)) {
            set({ ...cleared, sessionChecked: true });
            return;
          }
          set({ ...profile, isAuthenticated: true, sessionChecked: true });
        } catch {
          set({ ...cleared, sessionChecked: true });
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } finally {
          set({ ...cleared, sessionChecked: true });
        }
      },
    }),
    {
      name: 'hermes-auth',
      partialize: (state) => ({
        role: state.role,
        userName: state.userName,
        assignedUnits: state.assignedUnits,
      }),
    },
  ),
);
