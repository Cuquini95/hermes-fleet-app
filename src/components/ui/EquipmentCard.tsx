import type { Equipment } from '../../types/equipment';
import { getNextPM } from '../../data/pm-rules';
import StatusDot from './StatusDot';

interface EquipmentCardProps {
  equipment: Equipment;
}

const STATUS_BORDER_COLOR: Record<Equipment['status'], string> = {
  operativo: '#16A34A',
  alerta: '#F59E0B',
  taller: '#DC2626',
  inactivo: '#9CA3AF',
};

function getPMBadgeClass(hoursRemaining: number): string {
  if (hoursRemaining <= 0) return 'bg-critical text-white';
  if (hoursRemaining < 50) return 'bg-warning text-white';
  return 'bg-success text-white';
}

export default function EquipmentCard({ equipment }: EquipmentCardProps) {
  const pm = getNextPM(equipment.model, equipment.current_horometro);
  const borderColor = STATUS_BORDER_COLOR[equipment.status];

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-border overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="p-4 flex flex-col gap-2">
        {/* Row 1: status dot + unit_id + model */}
        <div className="flex items-center gap-2">
          <StatusDot status={equipment.status} />
          <span className="text-lg font-bold text-text leading-none">{equipment.unit_id}</span>
          <span className="text-sm text-text-secondary ml-1 leading-none">{equipment.model}</span>
        </div>

        {/* Row 2: horometro info */}
        <div className="flex flex-col gap-0.5 text-sm text-text-secondary">
          <span>Horómetro: <span className="text-text font-medium">{equipment.current_horometro} hrs</span></span>
          <span>Próximo: <span className="text-text font-medium">{equipment.next_pm_level}</span> a <span className="text-text font-medium">{equipment.next_pm_horometro} hrs</span></span>
        </div>

        {/* PM countdown badge */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getPMBadgeClass(pm.hours_remaining)}`}
          >
            {pm.hours_remaining <= 0
              ? `${pm.level} vencido`
              : `${pm.hours_remaining} hrs para ${pm.level}`}
          </span>
        </div>
      </div>
    </div>
  );
}
