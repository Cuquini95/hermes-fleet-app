import { ClipboardX, PackageX, Wrench, FileSearch, Inbox } from 'lucide-react';

type EmptyType = 'workorders' | 'inventory' | 'alerts' | 'reports' | 'search' | 'generic';

interface EmptyStateProps {
  type?: EmptyType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ICONS: Record<EmptyType, React.ReactNode> = {
  workorders: <Wrench size={48} strokeWidth={1.5} />,
  inventory: <PackageX size={48} strokeWidth={1.5} />,
  alerts: <Inbox size={48} strokeWidth={1.5} />,
  reports: <ClipboardX size={48} strokeWidth={1.5} />,
  search: <FileSearch size={48} strokeWidth={1.5} />,
  generic: <Inbox size={48} strokeWidth={1.5} />,
};

export default function EmptyState({ type = 'generic', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {ICONS[type]}
      </div>
      <h3 className="text-lg font-semibold text-text mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-xs mb-4">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-5 py-2.5 bg-amber text-white rounded-xl text-sm font-medium btn-press"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
