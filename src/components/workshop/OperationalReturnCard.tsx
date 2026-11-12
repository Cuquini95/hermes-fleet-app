import { useRef, useState } from 'react';
import { mexicoDate, mexicoDateInput, mexicoTime } from '../../lib/date-utils';
import { requestWorkshop, WorkshopApiError } from '../../lib/workshop-api';
import type { WorkOrder } from '../../types/workorder';

export default function OperationalReturnCard({ order, mayReview, onSave }: {
  order: WorkOrder;
  mayReview: boolean;
  onSave: () => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(new Map<string, string>());
  const sending = useRef(false);
  const receipt = order.operations;
  const needsReturn = order.estado === 'Completado' && receipt?.decision !== 'accepted';
  if (!needsReturn && !receipt) return null;

  async function save(decision: 'accepted' | 'returned') {
    if (sending.current) return;
    const data = { otId: order.ot_id, decision, notes, ...(decision === 'returned' && { dueDate }) };
    const key = JSON.stringify(data);
    const mutationId = pending.current.get(key) ?? crypto.randomUUID();
    pending.current.set(key, mutationId);
    sending.current = true;
    setSaving(true);
    setError('');
    try {
      await requestWorkshop('returns', { ...data, mutationId });
      pending.current.delete(key);
      await onSave();
      setNotes('');
      setDueDate('');
    } catch (err) {
      if (err instanceof WorkshopApiError && [400, 403, 404, 409].includes(err.status)) pending.current.delete(key);
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el retorno');
    } finally {
      setSaving(false);
      sending.current = false;
    }
  }

  const returnedAt = receipt?.returnedAt ? new Date(receipt.returnedAt) : null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm" aria-label="Retorno de Operaciones">
      <h2 className="text-sm font-semibold text-text">Retorno de Operaciones</h2>
      {needsReturn && <p className="text-sm text-text-secondary">Pendiente de recepción por Operaciones.</p>}
      {order.technical && <p className="text-sm text-text-secondary">Verificación técnica de {order.technical.userName}.</p>}
      {receipt?.decision === 'accepted' && returnedAt && <p className="text-sm text-text">Equipo recibido por {receipt.userName} el {mexicoDate(returnedAt)} a las {mexicoTime(returnedAt)}. {receipt.notes}</p>}
      {receipt?.decision === 'returned' && <p className="text-sm text-text">{receipt.userName} devolvió la OT a Taller. Corrección para {receipt.dueDate}. {receipt.notes}</p>}
      {needsReturn && mayReview && (
        <fieldset disabled={saving} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
            Observación de Operaciones
            <textarea className="rounded-xl border border-border p-2.5 text-sm text-text" rows={2} maxLength={1500}
              value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {order.technical ? (
            <button type="button" className="rounded-xl bg-amber px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              disabled={!notes.trim()} onClick={() => void save('accepted')}>Confirmar retorno ahora</button>
          ) : <p className="text-sm text-text-secondary">Devuelve la orden a Taller para registrar la verificación técnica.</p>}
          <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
            Fecha compromiso de corrección
            <input type="date" className="rounded-xl border border-border p-2.5 text-sm text-text" min={mexicoDateInput()}
              value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-text disabled:opacity-40"
            disabled={!dueDate || !notes.trim()} onClick={() => void save('returned')}>Devolver a Taller</button>
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
