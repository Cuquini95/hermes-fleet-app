import { PARTS_STATUS_LABELS, type ScheduleResources } from '../../lib/workshop-api';

export default function ScheduleResourcesFields({ value, onChange }: {
  value: ScheduleResources;
  onChange: (value: ScheduleResources) => void;
}) {
  const field = 'min-w-0 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text';
  return (
    <div className="space-y-3">
      <label className="block text-sm text-text-secondary">
        Turno
        <select className={field} value={value.shift} onChange={event => onChange({ ...value, shift: event.target.value })}>
          <option value="">Selecciona un turno</option>
          <option value="Día">Día</option>
          <option value="Noche">Noche</option>
        </select>
      </label>
      <label className="block text-sm text-text-secondary">
        Disponibilidad de repuestos
        <select className={field} value={value.partsStatus} onChange={event => onChange({ ...value, partsStatus: event.target.value })}>
          {Object.entries(PARTS_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      {value.partsStatus !== 'not_required' && <label className="block text-sm text-text-secondary">
        Repuestos de la orden
        <input className={field} maxLength={500} value={value.partsDetail}
          onChange={event => onChange({ ...value, partsDetail: event.target.value })} />
      </label>}
    </div>
  );
}
