import { create } from 'zustand';
import { ROLE_HOME, type AppRole } from '../types/roles';
import { setSheetSession } from '../lib/sheets-api';
import { setOfflineQueueSession } from '../lib/offline-queue';
import { setCartSession } from './cart-store';
import { setPurchaseSession } from '../lib/purchasing-api';
import { setGastosSession } from './gastos-store';

interface SessionProfile {
  userId: string;
  userName: string;
  role: AppRole;
  project: string;
  projects: string[];
  assignedUnits: string[];
  unitScope: 'all' | 'assigned';
  allUnits: boolean;
  canApprovePurchases: boolean;
}

interface AuthState extends Omit<SessionProfile, 'role' | 'unitScope'> {
  role: AppRole | null;
  unitScope: SessionProfile['unitScope'] | null;
  isAuthenticated: boolean;
  sessionChecked: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  validateSession: () => Promise<void>;
  logout: () => Promise<boolean>;
}

const cleared = {
  userId: '', userName: '', role: null, project: '', projects: [], assignedUnits: [], unitScope: null,
  allUnits: false, canApprovePurchases: false, isAuthenticated: false,
};

function validProfile(value: unknown): value is SessionProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<SessionProfile>;
  return typeof profile.userId === 'string' && Boolean(profile.userId)
    && typeof profile.userName === 'string' && Boolean(profile.userName)
    && typeof profile.role === 'string' && Object.prototype.hasOwnProperty.call(ROLE_HOME, profile.role)
    && typeof profile.project === 'string' && Boolean(profile.project)
    && Array.isArray(profile.projects) && profile.projects.every((project) => typeof project === 'string')
    && profile.projects.includes(profile.project)
    && Array.isArray(profile.assignedUnits) && profile.assignedUnits.every((unit) => typeof unit === 'string')
    && (profile.unitScope === 'all' || profile.unitScope === 'assigned')
    && profile.allUnits === (profile.unitScope === 'all') && typeof profile.canApprovePurchases === 'boolean';
}

function removeLegacyProfile() {
  try { globalThis.localStorage?.removeItem('hermes-auth'); } catch { /* storage may be disabled */ }
}

function bindDataSession(userId: string) {
  setSheetSession(userId);
  setOfflineQueueSession(userId);
  setCartSession(userId);
  setPurchaseSession(userId);
  setGastosSession(userId);
}

let generation = 0;
export const useAuthStore = create<AuthState>()((set) => ({
  ...cleared,
  sessionChecked: false,

  login: async (email, password) => {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !password) return false;
    const requestGeneration = ++generation;
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password }),
      });
      if (!response.ok) return false;
      const profile: unknown = await response.json();
      if (requestGeneration !== generation || !validProfile(profile)) return false;
      bindDataSession(profile.userId);
      set({ ...profile, isAuthenticated: true, sessionChecked: true });
      return true;
    } catch { return false; }
  },

  validateSession: async () => {
    removeLegacyProfile();
    const requestGeneration = ++generation;
    let profile: unknown;
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin', headers: { Accept: 'application/json' },
      });
      if (response.ok) profile = await response.json();
    } catch { /* an unverifiable session never opens protected routes */ }
    if (requestGeneration !== generation) return;
    bindDataSession(validProfile(profile) ? profile.userId : '');
    set(validProfile(profile) ? { ...profile, isAuthenticated: true, sessionChecked: true } : { ...cleared, sessionChecked: true });
  },

  logout: async () => {
    const requestGeneration = ++generation;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok || requestGeneration !== generation) return false;
      removeLegacyProfile();
      bindDataSession('');
      set({ ...cleared, sessionChecked: true });
      return true;
    } catch { return false; }
  },
}));
