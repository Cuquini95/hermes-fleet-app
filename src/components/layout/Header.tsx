import { useNavigate } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { ROLE_LABELS } from '../../types/roles';

export default function Header() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBell = () => {
    navigate('/alerts');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{ height: 64, backgroundColor: '#162252' }}
    >
      {/* Left: avatar + user info */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 36, height: 36, backgroundColor: '#2563EB' }}
        >
          <span className="text-white font-bold text-base">GTP</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-white font-semibold text-sm">{userName}</span>
          {role && (
            <span className="text-white/60 text-xs">{ROLE_LABELS[role]}</span>
          )}
        </div>
      </div>

      {/* Right: bell + logout */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleBell}
          className="relative text-white/80 hover:text-white transition-colors"
          aria-label="Alertas"
        >
          <Bell size={22} />
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white"
            style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#DC2626' }}
          >
            2
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut size={22} />
        </button>
      </div>
    </header>
  );
}
