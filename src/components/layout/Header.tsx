import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useCartStore } from '../../stores/cart-store';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { ROLE_LABELS } from '../../types/roles';
import ApiHealthDot from '../ui/ApiHealthDot';

export default function Header() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
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
      {/* Left: avatar + user info */}
      <div className="flex items-center gap-3">
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
