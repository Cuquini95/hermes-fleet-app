import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Truck,
  Wrench,
  Eye,
  Settings,
  BarChart3,
} from 'lucide-react';
import type { AppRole } from '../types/roles';
import { ROLE_HOME } from '../types/roles';
import { activeApp } from '../apps/active-app';
import { useAuthStore } from '../stores/auth-store';

interface RoleCard {
  role: AppRole;
  label: string;
  icon: React.ReactNode;
}

const ROLE_CARDS: RoleCard[] = [
  { role: 'operador', label: 'Operador', icon: <Truck size={28} className="text-white/80" /> },
  { role: 'mecanico', label: 'Mecánico', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'supervisor', label: 'Supervisor', icon: <Eye size={28} className="text-white/80" /> },
  { role: 'coordinador', label: 'Coordinador Mtto.', icon: <Settings size={28} className="text-white/80" /> },
  { role: 'jefe_taller', label: 'Jefe de Taller', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'gerencia', label: 'Gerencia', icon: <BarChart3 size={28} className="text-white/80" /> },
];

export default function LoginPage() {
  const [pendingRole, setPendingRole] = useState<AppRole | null>(null);
  const [loginError, setLoginError] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();
  const from: unknown = state?.from;
  const actions = activeApp?.actions;
  const appRoles = actions ? ROLE_CARDS.filter(({ role }) => actions.some((action) => action.roles.includes(role))) : ROLE_CARDS;
  const login = useAuthStore((s) => s.login);

  const handleRoleSelect = (role: AppRole) => {
    if (pendingRole) return;
    setPendingRole(role);
    setLoginError(false);
    void login(role).then((success) => {
      if (success) {
        const returnPath = typeof from === 'string' && from.startsWith('/') && !/^\/[\/\\]/.test(from) ? from : undefined;
        const nextPath = activeApp ? returnPath ?? '/' : returnPath === '/apps' ? '/apps' : ROLE_HOME[role];
        navigate(nextPath, { replace: true });
        return;
      }
      setLoginError(true);
    }).finally(() => setPendingRole(null));
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ background: '#FFFFFF' }}
    >
      <div className="flex flex-col items-center w-full max-w-sm gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <img
            src="/logo-transplus.svg"
            alt="Trans Plus"
            className="w-24 h-24"
          />
          <span className="font-bold text-2xl tracking-widest" style={{ color: '#162252' }}>{activeApp?.label ?? 'HERMES'}</span>
          <span className="text-sm" style={{ color: '#6B7280' }}>Grupo Trans Plus • Operaciones</span>
        </div>

        <p className="text-base text-center" style={{ color: '#162252' }}>
          Selecciona tu rol para ingresar
        </p>

        {/* Role cards grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {appRoles.map(({ role, label, icon }) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleSelect(role)}
              disabled={pendingRole !== null}
              className="flex flex-col items-center gap-2 rounded-xl py-5 px-3 transition-opacity active:opacity-70 disabled:opacity-60"
              style={{ backgroundColor: '#1E3A8A' }}
            >
              {icon}
              <span className="text-white text-sm font-medium text-center leading-tight">
                {pendingRole === role ? 'Entrando…' : label}
              </span>
            </button>
          ))}
        </div>

        {loginError && (
          <p role="alert" aria-live="assertive" className="text-sm font-medium" style={{ color: '#DC2626' }}>
            No se pudo ingresar. Intenta de nuevo.
          </p>
        )}

        <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 • GTP Hermes Fleet</p>
      </div>
    </div>
  );
}
