import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, LogOut, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useCartStore } from '../../stores/cart-store';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { ROLE_HOME, ROLE_LABELS } from '../../types/roles';
import ApiHealthDot from '../ui/ApiHealthDot';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  // Show the back arrow on every page EXCEPT the role-home (where back would
  // either loop or take you to /login). The arrow uses navigate(-1) which
  // walks history back; if there's no history (deep-link), it falls back to
  // the role-home so the user is never stranded.
  const roleHome = role ? ROLE_HOME[role] : '/';
  const isRoleHome = location.pathname === roleHome || location.pathname === '/';
  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(roleHome, { replace: true });
    }
  }
  const cartCount = useCartStore((s) => s.items.length);
  const alertCount = useWorkOrderStore((s) =>
    s.workorders.filter(
      (w) => w.estado !== 'Resuelta' && w.estado !== 'Completado'
    ).length
  );

  const canSeeCart = role === 'jefe_taller' || role === 'gerencia';
  const canSeeAlerts = role === 'jefe_taller' || role === 'coordinador' || role === 'supervisor' || role === 'gerencia';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{ height: 64, backgroundColor: '#162252' }}
    >
      {/* Left: back arrow (when not at role-home) + avatar + user info */}
      <div className="flex items-center gap-3">
        {!isRoleHome && (
          <button
            type="button"
            onClick={goBack}
            className="text-white/80 hover:text-white transition-colors p-1 -ml-1 rounded focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            aria-label="Volver"
            title="Volver"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <img
          src="/logo-transplus.svg"
          alt="Trans Plus"
          className="shrink-0 rounded"
          style={{ width: 36, height: 36 }}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-white font-semibold text-sm">{userName}</span>
          {role && (
            <span className="text-white/60 text-xs">{ROLE_LABELS[role]}</span>
          )}
        </div>
      </div>

      {/* Right: health + cart (JT only) + bell + logout */}
      <div className="flex items-center gap-2">
        <ApiHealthDot />
        {canSeeCart && (
          <button
            onClick={() => navigate('/pedidos')}
            className="relative text-white/80 hover:text-white transition-colors ml-2 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
            aria-label="Pedidos"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#F59E0B' }}
              >
                <span aria-hidden="true">{cartCount > 9 ? '9+' : cartCount}</span>
                <span className="sr-only">{cartCount} pedidos en carrito</span>
              </span>
            )}
          </button>
        )}

        {canSeeAlerts && (
          <button
            onClick={() => navigate('/alerts')}
            className="relative text-white/80 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
            aria-label="Alertas"
          >
            <Bell size={22} />
            {alertCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white"
                style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#DC2626' }}
              >
                <span aria-hidden="true">{alertCount > 9 ? '9+' : alertCount}</span>
                <span className="sr-only">{alertCount} alertas nuevas</span>
              </span>
            )}
          </button>
        )}

        <button
          onClick={handleLogout}
          className="text-white/80 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
          aria-label="Cerrar sesión"
        >
          <LogOut size={22} />
        </button>
      </div>
    </header>
  );
}
