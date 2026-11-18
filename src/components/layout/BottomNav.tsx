import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { LucideProps } from 'lucide-react';
import { NAV_ICONS } from '../../lib/nav-icons';
import { canOpenPanamaPayables, purchasingEntry } from '../../lib/purchasing-home';
import { useAuthStore } from '../../stores/auth-store';
import type { NavItem } from '../../types/roles';
import { NAV_CONFIG } from '../../types/roles';
import { fuelTrackingEnabled } from '../../data/project-features.js';
import MoreTray from './MoreTray';

const commandTabs: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', path: '/dashboard', icon: 'Home' },
  { id: 'ordenes', label: 'Trabajos', path: '/workorders', icon: 'Wrench' },
  { id: 'dvir', label: 'Inspecciones', path: '/dvir', icon: 'ClipboardCheck' },
  { id: 'equipos', label: 'Equipos', path: '/fleet', icon: 'Truck' },
  { id: 'inventario', label: 'Repuestos', path: '/inventory', icon: 'Package' },
];

function LucideIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = NAV_ICONS[name];
  return Icon ? <Icon {...props} /> : null;
}

export default function BottomNav({ rescue = false, command = false }: { rescue?: boolean; command?: boolean }) {
  const [showMoreTray, setShowMoreTray] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.role);
  const project = useAuthStore((s) => s.project);
  const canOpenPayables = useAuthStore(canOpenPanamaPayables);
  const entry = useAuthStore(purchasingEntry);

  if (!role) return null;

  const config = NAV_CONFIG[role];
  const visible = fuelTrackingEnabled(project) ? config.visible : config.visible.filter(item => item.id !== 'diesel');
  const overflow = fuelTrackingEnabled(project) ? config.overflow : config.overflow.filter(item => item.id !== 'diesel');
  const isPanama = project === 'tmf-panama';
  const [generalHome, ...otherItems] = visible;
  const purchasing: NavItem[] = [];
  const receiving = entry?.id === 'recepciones';
  const start = receiving && generalHome ? { ...generalHome, path: entry.path } : entry;
  const roleItems = start && entry?.id !== 'pedidos' ? [start, ...otherItems] : visible;
  const visibleItems = rescue && command ? commandTabs : roleItems;
  const previousStart = generalHome && (receiving || (isPanama && generalHome.id === 'dashboard'))
    ? { ...generalHome, label: 'Inicio general' } : generalHome;
  if (receiving) purchasing.push(entry);
  if (role === 'gerencia' && isPanama) {
    purchasing.push({ id: 'ordenes-compra', label: 'Órdenes de compra', icon: 'FileText', path: '/admin/ordenes-compra' });
    if (canOpenPayables) {
      purchasing.push({ id: 'cuentas-por-pagar', label: 'Cuentas por pagar', icon: 'Receipt', path: '/panama/cuentas-por-pagar' });
    }
  }

  const panamaShortcuts: NavItem[] = [];
  if (isPanama && ['gerencia', 'jefe_taller', 'coordinador', 'supervisor'].includes(role)) {
    panamaShortcuts.push(
      { id: 'pm', label: 'Mantenimiento PM', icon: 'Clock', path: '/pm' },
      { id: 'inventario', label: 'Inventario', icon: 'Package', path: '/inventory' },
    );
  }
  if (isPanama && role === 'gerencia') {
    panamaShortcuts.push(
      { id: 'activos', label: 'Activos', icon: 'Package', path: '/admin/activos' },
      { id: 'proveedores', label: 'Proveedores', icon: 'FileText', path: '/admin/proveedores' },
    );
  }
  if (isPanama && role === 'supervisor') {
    panamaShortcuts.push(
      { id: 'ordenes', label: 'Órdenes de trabajo', icon: 'Wrench', path: '/workorders' },
      { id: 'pedidos', label: 'Pedidos', icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'datos', label: 'Datos', icon: 'Table2', path: '/data' },
    );
  }
  const shortcuts = panamaShortcuts.filter(item => ![...visibleItems, ...overflow].some(existing => existing.path === item.path));

  const isActive = (item: NavItem) => {
    if (!item.path) return false;
    const [beforeHash = ''] = item.path.split('#', 1);
    const [pathname = '', filter] = beforeHash.split('?', 2);
    return location.pathname.startsWith(pathname) && (!filter || location.search === '?' + filter);
  };

  const handleItemClick = (item: NavItem) => {
    if (item.id === 'mas') {
      setShowMoreTray(true);
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <nav
        aria-label="Navegación principal"
        data-mobile-toolbar
        className={rescue ? 'rescue-mobile-tabs' : 'fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe'}
        style={rescue ? undefined : { minHeight: 64, paddingBottom: 'env(safe-area-inset-bottom, 0px)', backgroundColor: '#162252' }}
      >
        {visibleItems.map((item) => {
          const active = isActive(item);
          const label = isPanama && item.id === 'dashboard' ? 'Inicio' : item.label;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 flex-1 px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <LucideIcon
                name={item.icon}
                size={22}
                color={rescue ? 'currentColor' : active ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
              />
              <span
                className="max-w-full break-words text-center text-xs leading-tight"
                style={rescue ? undefined : { color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}
              >
                {rescue && command && item.id === 'dvir' ? 'Inspección' : label}
              </span>
              {active && !rescue && (
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <MoreTray
        open={showMoreTray}
        onClose={() => setShowMoreTray(false)}
        items={[
          ...shortcuts, ...purchasing, ...(visibleItems !== visible && previousStart ? [previousStart] : []), ...overflow,
          { id: 'tmf', label: 'Maestros TMF', icon: 'Table2', path: '/panama' },
        ]}
      />
    </>
  );
}
