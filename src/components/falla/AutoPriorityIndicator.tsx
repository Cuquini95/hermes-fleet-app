import type { OTPriority } from '../../types/workorder';
import { PRIORITY_CONFIG } from '../../types/workorder';

interface AutoPriorityIndicatorProps {
  priority: OTPriority;
}

export default function AutoPriorityIndicator({ priority }: AutoPriorityIndicatorProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <div className="flex flex-col gap-1">
      <span
        className="rounded-full px-4 py-2 font-semibold text-sm w-fit"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        {config.label}
      </span>
      <span className="text-sm text-text-secondary">
        Tiempo de respuesta: {config.time}
      </span>
    </div>
  );
}
