import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { LucideProps } from 'lucide-react';
import { NAV_ICONS } from '../../lib/nav-icons';
import { canOpenPanamaPayables, purchasingEntry } from '../../lib/purchasing-home';
import { useAuthStore } from '../../stores/auth-store';
import type { NavItem } from '../../types/roles';
import { NAV_CONFIG } from '../../types/roles';
import MoreTray from './MoreTray';

function LucideIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = NAV_ICONS[name];
  return Icon ? <Icon {...props} /> : null;
}

export default function BottomNav() {
  const [showMoreTray, setShowMoreTray] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.role);
  const project = useAuthStore((s) => s.project);
  const canOpenPayables = useAuthStore(canOpenPanamaPayables);
  const entry = useAuthStore(purchasingEntry);

  if (!role) return null;

  const { visible, overflow } = NAV_CONFIG[role];
  const isPanama = project === 'tmf-panama';
  const [generalHome, ...otherItems] = visible;
  const purchasing: NavItem[] = [];
  const receiving = entry?.id === 'recepciones';
  const start = receiving && generalHome ? { ...generalHome, path: entry.path } : entry;
  const visibleItems = start && entry?.id !== 'pedidos' ? [start, ...otherItems] : visible;
  const previousStart = generalHome && (receiving || (isPanama && generalHome.id === 'dashboard'))
    ? { ...generalHome, label: 'Inicio general' } : generalHome;
  if (receiving) purchasing.push(entry);
  if (role === 'gerencia' && isPanama) {
    purchasing.push({ id: 'ordenes-compra', label: 'Órdenes de compra', icon: 'FileText', path: '/admin/ordenes-compra' });
    if (canOpenPayables) {
      purchasing.push({ id: 'cuentas-por-pagar', label: 'Cuentas por pagar', icon: 'Receipt', path: '/panama/cuentas-por-pagar' });
    }
  }

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
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
        style={{ height: 64, backgroundColor: '#162252' }}
      >
        {visibleItems.map((item) => {
          const active = isActive(item);
          const label = isPanama && item.id === 'dashboard' ? 'Inicio' : item.label;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex flex-col items-center gap-1 flex-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <LucideIcon
                name={item.icon}
                size={22}
                color={active ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
              />
              <span
                className="text-xs leading-none"
                style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}
              >
                {label}
              </span>
              {active && (
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
          ...purchasing, ...(visibleItems !== visible && previousStart ? [previousStart] : []), ...overflow,
          { id: 'tmf', label: 'Maestros TMF', icon: 'Table2', path: '/panama' },
        ]}
      />
    </>
  );
}
