import { RefreshCw } from 'lucide-react';

interface PullIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
  isReady: boolean;
  style: React.CSSProperties;
}

export default function PullIndicator({ pullDistance, refreshing, isReady, style }: PullIndicatorProps) {
  if (pullDistance <= 0 && !refreshing) return null;

  return (
    <div
      className="flex items-center justify-center"
      style={style}
    >
      <RefreshCw
        size={20}
        className={`text-text-secondary transition-transform ${
          refreshing ? 'animate-spin' : ''
        }`}
        style={{
          transform: refreshing ? undefined : `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
          opacity: Math.min(pullDistance / 60, 1),
        }}
      />
      {isReady && !refreshing && (
        <span className="ml-2 text-xs text-text-secondary">Soltar para actualizar</span>
      )}
      {refreshing && (
        <span className="ml-2 text-xs text-text-secondary">Actualizando...</span>
      )}
    </div>
  );
}
