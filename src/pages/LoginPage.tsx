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
  { role: 'operador', label: 'Operador', icon: <Truck size={28} className="text-white/80" /> },
  { role: 'mecanico', label: 'Mecánico', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'supervisor', label: 'Supervisor', icon: <Eye size={28} className="text-white/80" /> },
  { role: 'coordinador', label: 'Coordinador Mtto.', icon: <Settings size={28} className="text-white/80" /> },
  { role: 'jefe_taller', label: 'Jefe de Taller', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'gerencia', label: 'Gerencia', icon: <BarChart3 size={28} className="text-white/80" /> },
];

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
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
      } else {
        setPinError(true);
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 800);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ background: '#FFFFFF' }}
    >
      {selectedRole === null ? (
        /* Phase 1 - Role Selection */
        <div className="flex flex-col items-center w-full max-w-sm gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <img
              src="/logo-transplus.svg"
              alt="Trans Plus"
              className="w-24 h-24"
            />
            <span className="font-bold text-2xl tracking-widest" style={{ color: '#162252' }}>HERMES</span>
            <span className="text-sm" style={{ color: '#6B7280' }}>Grupo Trans Plus • Operaciones</span>
          </div>

          <p className="text-base text-center" style={{ color: '#162252' }}>
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

          <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      ) : (
        /* Phase 2 - PIN Entry */
        <div className="flex flex-col items-center w-full max-w-xs gap-6">
          {/* Header with back arrow */}
          <div className="flex items-center w-full gap-3">
            <button
              onClick={handleBack}
              className="transition-colors"
              style={{ color: '#162252' }}
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-semibold text-lg" style={{ color: '#162252' }}>
              {ROLE_LABELS[selectedRole]}
            </span>
          </div>

          {/* PIN dots */}
          <div className={`flex gap-4 my-4 ${pinError ? 'animate-[shake_0.3s_ease]' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-colors duration-150"
                style={{
                  backgroundColor: pinError ? '#DC2626' : i < pin.length ? '#2563EB' : '#D1D5DB',
                }}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>PIN incorrecto</p>
          )}

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
                  backgroundColor: key === '' ? 'transparent' : '#162252',
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

          <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      )}
    </div>
  );
}
