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
      className="fixed inset-x-0 top-0 z-50 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between gap-2 bg-teal px-3 pt-[env(safe-area-inset-top)] sm:px-4"
    >
      {/* Left: back arrow (when not at role-home) + avatar + user info */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {!isRoleHome && (
          <button
            type="button"
            onClick={goBack}
            className="grid min-h-11 w-8 shrink-0 place-items-center rounded text-white/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:w-11"
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
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-white" title={userName}>{userName}</span>
          {role && (
            <span className="truncate text-xs text-white/60">{ROLE_LABELS[role]}</span>
          )}
        </div>
      </div>

      {/* Right: health + cart (JT only) + bell + logout */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <ApiHealthDot />
        {canSeeCart && (
          <button
            onClick={() => navigate('/pedidos')}
            className="relative grid h-11 w-9 place-items-center rounded text-white/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:w-11"
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
            className="relative grid h-11 w-9 place-items-center rounded text-white/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:w-11"
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
          className="grid h-11 w-9 place-items-center rounded text-white/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:w-11"
          aria-label="Cerrar sesión"
        >
          <LogOut size={22} />
        </button>
      </div>
    </header>
  );
}
