import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import type { NavItem } from '../../types/roles';
import { NAV_CONFIG } from '../../types/roles';
import MoreTray from './MoreTray';

function LucideIcon({ name, ...props }: { name: string } & Icons.LucideProps) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[name];
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
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
        style={{ height: 64, backgroundColor: '#1B4A4A' }}
      >
        {visible.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex flex-col items-center gap-1 flex-1 py-2"
              aria-label={item.label}
            >
              <LucideIcon
                name={item.icon}
                size={22}
                color={active ? '#E8961A' : 'rgba(255,255,255,0.6)'}
              />
              <span
                className="text-xs leading-none"
                style={{ color: active ? '#E8961A' : 'rgba(255,255,255,0.6)' }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#E8961A' }}
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
