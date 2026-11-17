import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { LucideProps } from 'lucide-react';
import { NAV_ICONS } from '../../lib/nav-icons';
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

  if (!role) return null;

  const { visible, overflow } = NAV_CONFIG[role];

  const isActive = (item: NavItem) => {
    if (!item.path) return false;
    return location.pathname.startsWith(item.path);
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
        className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center justify-around bg-teal px-2 pb-[env(safe-area-inset-bottom)]"
      >
        {visible.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center gap-1 rounded px-0.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <LucideIcon
                name={item.icon}
                size={22}
                color={active ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
              />
              <span
                className="max-w-full text-center text-[11px] leading-tight sm:text-xs"
                style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}
              >
                {item.label}
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
        items={overflow}
      />
    </>
  );
}
