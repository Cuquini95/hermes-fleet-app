import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, LogOut, MoreVertical, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useCartStore } from '../../stores/cart-store';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { ROLE_LABELS } from '../../types/roles';
import { purchasingEntry, sessionHome } from '../../lib/purchasing-home';
import ApiHealthDot from '../ui/ApiHealthDot';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const isPanama = useAuthStore((s) => s.project === 'tmf-panama');
  const previewDemo = useAuthStore((s) => s.previewDemo);
  const accessLabel = useAuthStore((s) => purchasingEntry(s)?.accessLabel);
  const home = useAuthStore(sessionHome);
  const logout = useAuthStore((s) => s.logout);
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);

  // Show the back arrow on every page EXCEPT the role-home (where back would
  // either loop or take you to /login). The arrow uses navigate(-1) which
  // walks history back; if there's no history (deep-link), it falls back to
  // the role-home so the user is never stranded.
  const roleHome = home.split(/[?#]/, 1)[0];
  const isRoleHome = location.pathname === roleHome || location.pathname === '/';
  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(home, { replace: true });
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

  const handleLogout = async () => {
    setLeaving(true);
    setLogoutError(false);
    const success = await logout();
    setLeaving(false);
    if (success) window.location.replace('/login');
    else setLogoutError(true);
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex min-w-0 items-center justify-between gap-2 px-3 sm:px-4"
      style={{ height: 64, backgroundColor: '#162252' }}
    >
      {/* Left: back arrow (when not at role-home) + avatar + user info */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {!isRoleHome && (
          <button
            type="button"
            onClick={goBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-white/80 hover:text-white transition-colors -ml-2 rounded focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
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
          <span className="truncate text-white font-semibold text-sm">{userName}</span>
          {role && (
            <span className="truncate text-xs text-white/75">{accessLabel ?? ROLE_LABELS[role]}{previewDemo ? ' · Datos de prueba' : ''}</span>
          )}
        </div>
      </div>

      {/* Right: health + cart (JT only) + bell + logout */}
      <div className="flex shrink-0 items-center gap-1">
        <ApiHealthDot />
        {canSeeCart && !isPanama && (
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

        {canSeeAlerts && !isPanama && (
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

        {!isPanama && <button
          onClick={handleLogout}
          disabled={leaving}
          className="text-white/80 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded"
          aria-label="Cerrar sesión"
        >
          <LogOut size={22} />
        </button>}
        {isPanama && <div ref={menu} className="relative">
          <button ref={menuButton} type="button" aria-label="Opciones de la cuenta" aria-expanded={menuOpen}
            aria-controls="account-actions" onClick={() => setMenuOpen(value => !value)}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">
            <MoreVertical size={22} />
            {(canSeeAlerts && alertCount > 0) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </button>
          {menuOpen && <div id="account-actions" className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-white p-2 text-sm text-text shadow-xl">
            {canSeeCart && <button type="button" onClick={() => { setMenuOpen(false); navigate('/pedidos'); }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-slate-100">
              <ShoppingCart size={18} /> Pedidos{cartCount > 0 ? ` (${cartCount})` : ''}
            </button>}
            {canSeeAlerts && <button type="button" onClick={() => { setMenuOpen(false); navigate('/alerts'); }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-slate-100">
              <Bell size={18} /> Alertas{alertCount > 0 ? ` (${alertCount})` : ''}
            </button>}
            <button type="button" onClick={() => { setMenuOpen(false); void handleLogout(); }} disabled={leaving}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-slate-100 disabled:opacity-50">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>}
        </div>}
      </div>
      {logoutError && <p role="alert" className="absolute right-3 top-full rounded-b-lg bg-white p-3 text-sm text-red-700 shadow">No se pudo cerrar la sesión. Intenta de nuevo.</p>}
    </header>
  );
}
