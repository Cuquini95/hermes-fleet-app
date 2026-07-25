import { useState, useEffect, useCallback } from 'react';
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
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleKeyPress = useCallback((key: string) => {
    if (isAuthenticating) return;
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '') return;
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      return prev + key;
    });
  }, [isAuthenticating]);

  useEffect(() => {
    if (!selectedRole || pin.length !== 4) return;
    let resetTimer: number | undefined;
    let cancelled = false;
    const attempt = window.setTimeout(() => {
      setIsAuthenticating(true);
      setPinError(false);
      setPinErrorMessage('');
      void login(selectedRole, pin).then((result) => {
        if (cancelled) return;
        setIsAuthenticating(false);
        if (result.success) {
          window.setTimeout(() => navigate(ROLE_HOME[selectedRole]), 0);
          return;
        }
        setPinError(true);
        setPinErrorMessage(
          result.reason === 'server_unavailable'
            ? 'Servidor de autenticación no disponible.'
            : result.reason === 'server_rejected'
              ? 'PIN no válido para este rol.'
              : 'PIN incorrecto.',
        );
        resetTimer = window.setTimeout(() => {
          setPin('');
          setPinError(false);
          setPinErrorMessage('');
        }, 800);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(attempt);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    };
  }, [selectedRole, pin, login, navigate]);

  useEffect(() => {
    if (!selectedRole) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKeyPress(e.key);
      else if (e.key === 'Backspace') handleKeyPress('del');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRole, handleKeyPress]);

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
    setPin('');
    setPinError(false);
    setPinErrorMessage('');
  };

  const handleBack = () => {
    setSelectedRole(null);
    setPin('');
    setPinError(false);
    setPinErrorMessage('');
    setIsAuthenticating(false);
  };

  return (
    <main
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
            <h1 className="font-bold text-2xl tracking-widest" style={{ color: '#162252' }}>HERMES</h1>
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
            <p className="text-sm font-medium text-center" style={{ color: '#DC2626' }} role="alert">
              {pinErrorMessage}
            </p>
          )}
          {isAuthenticating && (
            <p className="text-sm font-medium" style={{ color: '#2563EB' }} aria-live="polite">
              Validando sesión…
            </p>
          )}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {PIN_KEYS.map((key, idx) => (
              <button
                key={idx}
                onClick={() => handleKeyPress(key)}
                disabled={key === '' || isAuthenticating}
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
    </main>
  );
}
