import { Wrench, Clock } from 'lucide-react';
import type { WorkOrder } from '../../types/workorder';
import { PRIORITY_CONFIG, ESTADO_CONFIG } from '../../types/workorder';
import { getEquipmentById } from '../../data/equipment-catalog';

interface OTCardProps {
  workorder: WorkOrder;
  onClick?: () => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  CRITICA: '#DC2626',
  ALTA: '#EA580C',
  MEDIA: '#F59E0B',
  BAJA: '#3B82F6',
};

function timeSince(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Hace menos de 1h';
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

export default function OTCard({ workorder, onClick }: OTCardProps) {
  const equipment = getEquipmentById(workorder.unidad);
  const priorityConfig = PRIORITY_CONFIG[workorder.prioridad];
  const estadoConfig = ESTADO_CONFIG[workorder.estado];
  const borderColor = PRIORITY_BORDER[workorder.prioridad];

  return (
    <div
      className={`bg-card rounded-xl shadow-sm border border-border mb-3 overflow-hidden${onClick ? ' cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Row 1: OT ID + priority pill + estado pill */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono font-semibold text-amber text-sm">{workorder.ot_id}</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
          >
            {priorityConfig.label}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: estadoConfig.color, backgroundColor: estadoConfig.bg }}
          >
            {workorder.estado}
          </span>
        </div>

        {/* Row 2: unit_id + model */}
        <p className="text-sm font-bold text-text mb-1">
          {workorder.unidad}
          {equipment && (
            <span className="font-normal"> — {equipment.model}</span>
          )}
        </p>

        {/* Row 3: descripcion truncated */}
        <p className="text-sm text-text-secondary truncate mb-2">{workorder.descripcion}</p>

        {/* Row 4: mechanic + time */}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Wrench size={12} />
            {workorder.mecanico_asignado && workorder.mecanico_asignado !== 'Sin asignar' ? (
              <span>{workorder.mecanico_asignado}</span>
            ) : (
              <span className="italic">Sin asignar</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{timeSince(workorder.fecha)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
