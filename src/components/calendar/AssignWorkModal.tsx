import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { mechanicCoversUnit, requestWorkshop, WorkshopApiError, type WorkshopMechanic } from '../../lib/workshop-api';
import type { WorkOrder } from '../../types/workorder';

interface AssignWorkModalProps {
  mechanic: string;
  date: string;
  mechanics: WorkshopMechanic[];
  workorders: WorkOrder[];
  onSave: (row: string[]) => void;
  onClose: () => void;
}

const ASSIGNABLE = new Set(['Abierta', 'En Espera de Asignación', 'En Reparación', 'Esperando Pieza']);
const fieldStyle = 'min-w-0 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';

export default function AssignWorkModal({ mechanic, date, mechanics, workorders, onSave, onClose }: AssignWorkModalProps) {
  const title = useId();
  const mutationId = useRef('');
  const expectedVersion = useRef<string | undefined>(undefined);
  const submitting = useRef(false);
  const [selectedOT, setSelectedOT] = useState('');
  const [mechanicId, setMechanicId] = useState<string | null>(mechanic || null);
  const [selectedDate, setSelectedDate] = useState(date);
  const [hours, setHours] = useState('2');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const assignable = workorders.filter((wo) => ASSIGNABLE.has(wo.estado));
  const selected = assignable.find((wo) => wo.ot_id === selectedOT);
  const available = selected ? mechanics.filter((item) => mechanicCoversUnit(item, selected.unidad)) : mechanics;
  const canSave = !!selected && !!selectedDate && Number(hours) >= 0.25 && Number(hours) <= 24;

  async function handleSave() {
    if (!canSave || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    if (!mutationId.current) {
      mutationId.current = crypto.randomUUID();
      expectedVersion.current = selected?.version;
    }
    try {
      const { schedule } = await requestWorkshop<{ schedule: string[] }>('schedule', {
        mutationId: mutationId.current, otId: selectedOT, date: selectedDate, hours, notes,
        ...(mechanicId === null ? {} : { mechanicId }),
        ...(expectedVersion.current && { expectedVersion: expectedVersion.current }),
      });
      onSave(schedule);
    } catch (err) {
      const definitive = err instanceof WorkshopApiError && [400, 403, 404, 409].includes(err.status);
      if (definitive) mutationId.current = '';
      setPending(!definitive);
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la programación');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40" onClick={() => { if (!saving) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        className="w-full sm:max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={title} className="text-base font-bold text-[#162252]">Asignar trabajo</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={saving} className="p-2.5 rounded-full text-slate-500">
            <X size={18} />
          </button>
        </div>

        <fieldset disabled={saving || pending} className="min-w-0 space-y-3">
          <label className="block text-xs font-medium text-slate-700">
            Orden de Trabajo
            <select
              className={fieldStyle}
              value={selectedOT}
              onChange={(e) => {
                const order = assignable.find((wo) => wo.ot_id === e.target.value);
                setSelectedOT(e.target.value);
                if (order && mechanicId && !mechanics.some((item) => item.userId === mechanicId && mechanicCoversUnit(item, order.unidad))) setMechanicId(null);
              }}
            >
              <option value="">Selecciona OT</option>
              {assignable.map((wo) => <option key={wo.ot_id} value={wo.ot_id}>{wo.ot_id} · {wo.unidad} · {wo.tipo_averia}</option>)}
            </select>
          </label>
          {assignable.length === 0 && <p className="text-xs text-slate-500">Sin órdenes disponibles para programar.</p>}
          <label className="block text-xs font-medium text-slate-700">
            Fecha programada
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={fieldStyle} />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Mecánico
            <select className={fieldStyle} value={mechanicId ?? '@actual'} onChange={(e) => setMechanicId(e.target.value === '@actual' ? null : e.target.value)}>
              <option value="@actual">Conservar asignación actual{selected?.mecanico_asignado ? ` · ${selected.mecanico_asignado}` : ''}</option>
              <option value="">Sin asignar</option>
              {available.map(({ userId, userName }) => <option key={userId} value={userId}>{userName}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Horas estimadas
            <input type="number" min="0.25" max="24" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} className={fieldStyle} />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Notas
            <input type="text" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldStyle} />
          </label>
        </fieldset>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-600">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave || saving} className="flex-1 py-2.5 rounded-xl bg-[#162252] text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Guardando…' : pending ? 'Reintentar' : 'Programar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
