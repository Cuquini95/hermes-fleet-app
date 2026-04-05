import type { Equipment } from '../../types/equipment';
import StatusDot from '../ui/StatusDot';

interface FleetGridProps {
  equipment: Equipment[];
}

const STATUS_ORDER: Equipment['status'][] = ['operativo', 'alerta', 'taller', 'inactivo'];

export default function FleetGrid({ equipment }: FleetGridProps) {
  const sorted = [...equipment].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {sorted.map((unit) => (
        <div
          key={unit.unit_id}
          className="bg-card rounded-lg p-3 border border-border text-center hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex justify-center mb-1">
            <StatusDot status={unit.status} />
          </div>
          <p className="font-mono text-sm font-semibold text-text leading-tight">{unit.unit_id}</p>
          <p className="text-xs text-text-secondary truncate mt-0.5">{unit.model}</p>
        </div>
      ))}
    </div>
  );
}
