import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Wrench,
  Eye,
  Settings,
  BarChart3,
  ArrowLeft,
  Delete,
} from 'lucide-react';
import type { AppRole } from '../types/roles';
import { ROLE_HOME, ROLE_LABELS } from '../types/roles';
import { useAuthStore } from '../stores/auth-store';

interface RoleCard {
  role: AppRole;
  label: string;
  icon: React.ReactNode;
}

const ROLE_CARDS: RoleCard[] = [
  { role: 'operador', label: 'Operador', icon: <Truck size={28} className="text-amber" /> },
  { role: 'mecanico', label: 'Mecánico', icon: <Wrench size={28} className="text-amber" /> },
  { role: 'supervisor', label: 'Supervisor', icon: <Eye size={28} className="text-amber" /> },
  { role: 'coordinador', label: 'Coordinador Mtto.', icon: <Settings size={28} className="text-amber" /> },
  { role: 'jefe_taller', label: 'Jefe de Taller', icon: <Wrench size={28} className="text-amber" /> },
  { role: 'gerencia', label: 'Gerencia', icon: <BarChart3 size={28} className="text-amber" /> },
];

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [pin, setPin] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
    setPin('');
  };

  const handleBack = () => {
    setSelectedRole(null);
    setPin('');
  };

  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '') return;
    if (pin.length >= 4) return;

    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === 4 && selectedRole) {
      const success = login(selectedRole, newPin);
      if (success) {
        navigate(ROLE_HOME[selectedRole]);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ background: 'linear-gradient(180deg, #162252 0%, #0D1535 100%)' }}
    >
      {selectedRole === null ? (
        /* Phase 1 - Role Selection */
        <div className="flex flex-col items-center w-full max-w-sm gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 64, height: 64, backgroundColor: '#2563EB' }}
            >
              <span className="text-white font-bold text-3xl">H</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-widest">HERMES</span>
            <span className="text-white/60 text-sm">Grupo Trans Plus • Operaciones</span>
          </div>

          <p className="text-white text-base text-center">
            Selecciona tu rol para ingresar
          </p>

          {/* Role cards grid */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {ROLE_CARDS.map(({ role, label, icon }) => (
              <button
                key={role}
                onClick={() => handleRoleSelect(role)}
                className="flex flex-col items-center gap-2 rounded-xl py-5 px-3 transition-opacity active:opacity-70"
                style={{ backgroundColor: '#1E3A8A' }}
              >
                {icon}
                <span className="text-white text-sm font-medium text-center leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-white/30 text-xs mt-4">v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      ) : (
        /* Phase 2 - PIN Entry */
        <div className="flex flex-col items-center w-full max-w-xs gap-6">
          {/* Header with back arrow */}
          <div className="flex items-center w-full gap-3">
            <button
              onClick={handleBack}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="text-white font-semibold text-lg">
              {ROLE_LABELS[selectedRole]}
            </span>
          </div>

          {/* PIN dots */}
          <div className="flex gap-4 my-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-colors duration-150"
                style={{
                  backgroundColor: i < pin.length ? '#2563EB' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {PIN_KEYS.map((key, idx) => (
              <button
                key={idx}
                onClick={() => handleKeyPress(key)}
                disabled={key === ''}
                className={[
                  'flex items-center justify-center rounded-xl transition-opacity active:opacity-60',
                  key === '' ? 'invisible' : '',
                ].join(' ')}
                style={{
                  minHeight: 64,
                  backgroundColor: key === '' ? 'transparent' : '#1E3A8A',
                }}
              >
                {key === 'del' ? (
                  <Delete size={22} className="text-white" />
                ) : (
                  <span className="text-white text-xl font-semibold">{key}</span>
                )}
              </button>
            ))}
          </div>

          <p className="text-white/30 text-xs mt-4">v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      )}
    </div>
  );
}
