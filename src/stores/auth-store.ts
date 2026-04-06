import { create } from 'zustand';
import type { AppRole } from '../types/roles';

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  login: (role: AppRole, pin: string) => boolean;
  logout: () => void;
}

const MOCK_USERS: Record<AppRole, { userName: string; assignedUnits: string[]; pin: string }> = {
  operador:    { userName: 'Operador',       assignedUnits: ['EPAK-09'], pin: '2026' },
  mecanico:    { userName: 'Mecánico',       assignedUnits: [], pin: '2015' },
  jefe_taller: { userName: 'Jefe de Taller', assignedUnits: [], pin: '1995' },
  coordinador: { userName: 'Coordinador',    assignedUnits: [], pin: '2001' },
  supervisor:  { userName: 'Supervisor',     assignedUnits: ['EPAK-09', 'EPTK-08', 'EPCF-08'], pin: '2008' },
  gerencia:    { userName: 'Gerencia',       assignedUnits: [], pin: '1963' },
};

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  userName: '',
  assignedUnits: [],
  isAuthenticated: false,

  login: (role: AppRole, pin: string): boolean => {
    if (pin.length !== 4) return false;
    const user = MOCK_USERS[role];
    if (pin !== user.pin) return false;
    set({
      role,
      userName: user.userName,
      assignedUnits: user.assignedUnits,
      isAuthenticated: true,
    });
    return true;
  },

  logout: () => {
    set({
      role: null,
      userName: '',
      assignedUnits: [],
      isAuthenticated: false,
    });
  },
}));
