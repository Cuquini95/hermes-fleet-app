import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { NavItem } from '../../types/roles';

function LucideIcon({ name, ...props }: { name: string } & Icons.LucideProps) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[name];
  return Icon ? <Icon {...props} /> : null;
}

interface MoreTrayProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}

export default function MoreTray({ open, onClose, items }: MoreTrayProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const handleItemClick = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex flex-col justify-end" style={{ zIndex: 9999 }}>
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Tray */}
      <div
        className="relative rounded-t-2xl w-full pt-4 flex flex-col"
        style={{ backgroundColor: '#FFFFFF', zIndex: 1, maxHeight: '70vh' }}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-3 flex-shrink-0"
          style={{ backgroundColor: '#E5E7EB' }}
        />
        <div className="overflow-y-auto px-4 pb-8 flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.path)}
              className="flex items-center gap-4 py-3 px-3 rounded-xl active:opacity-70 transition-opacity"
              style={{ backgroundColor: 'transparent' }}
            >
              <LucideIcon name={item.icon} size={22} color="#162252" />
              <span className="text-text text-base font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
