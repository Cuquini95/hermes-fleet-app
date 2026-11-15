import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ScheduleResourcesFields from '../calendar/ScheduleResourcesFields';
import { mexicoDateInput } from '../../lib/date-utils';
import type { MaintenanceEntry } from '../../lib/panama-maintenance';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { mechanicCoversUnit, requestWorkshop, WorkshopApiError,
  type ScheduleResources, type WorkshopMechanic } from '../../lib/workshop-api';

type BatchRequest = ScheduleResources & {
  items: { unit: string; hours: string }[];
  scheduledDate: string;
  mechanicId: string;
};
type BatchSave = BatchRequest & { mutationId: string; confirmation: string };
type BatchItem = { unit: string; level: string; dueAt: number; hours: number; checklistReference: string };
type BatchReview = { items: BatchItem[]; warnings: { code: string; message: string }[]; confirmation: string; sourceCut?: string };
type BatchResult = { date: string; orders: (BatchItem & { otId: string; folio?: string })[] };

const meter = (value: number) => `${value.toLocaleString('es-PA')} h`;
const defaultResources: ScheduleResources = { shift: '', partsStatus: 'unknown', partsDetail: '' };
const field = 'mt-1 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-text';
const action = 'min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

function readPending(key: string): BatchSave | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as BatchSave | null;
    return value?.mutationId && value.confirmation && Array.isArray(value.items) ? value : null;
  } catch { return null; }
}

function rememberPending(key: string, body: BatchSave | null) {
  try {
    if (body) sessionStorage.setItem(key, JSON.stringify(body));
    else sessionStorage.removeItem(key);
  } catch { /* In the current page the same payload remains available for retry. */ }
}

export default function PanamaPmBatch({ entries, userId, onOpenChange }: {
  entries: MaintenanceEntry[] | null;
  userId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const storageKey = `hermes:panama:pm-batch:${userId}`;
  const [pending, setPending] = useState(() => readPending(storageKey));
  const [open, setOpen] = useState(() => !!pending);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [scheduledDate, setScheduledDate] = useState(mexicoDateInput);
  const [resources, setResources] = useState<ScheduleResources>(defaultResources);
  const [mechanicId, setMechanicId] = useState('');
  const [mechanics, setMechanics] = useState<WorkshopMechanic[]>([]);
  const [mechanicsError, setMechanicsError] = useState(false);
  const [review, setReview] = useState<{ data: BatchReview; body: BatchRequest } | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => { onOpenChange(open); }, [onOpenChange, open]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void requestWorkshop<{ mechanics: WorkshopMechanic[] }>('mechanics')
      .then(({ mechanics }) => { if (current) { setMechanics(mechanics); setMechanicsError(false); } })
      .catch(() => { if (current) setMechanicsError(true); });
    return () => { current = false; };
  }, [open]);

  const items = (entries ?? []).filter(entry => Object.hasOwn(selected, entry.unit));
  const eligible = mechanics.filter(mechanic => items.every(item => mechanicCoversUnit(mechanic, item.unit)));
  const canReview = items.length === Object.keys(selected).length && items.length >= 2 && items.length <= 25
    && !!scheduledDate && !!resources.shift
    && items.every(({ unit, batchBlock }) => !batchBlock && Number(selected[unit]) >= 0.25 && Number(selected[unit]) <= 240);

  function toggleUnit(unit: string) {
    const next = { ...selected };
    if (Object.hasOwn(next, unit)) delete next[unit];
    else next[unit] = '';
    if (mechanicId && !mechanics.some(person => person.userId === mechanicId && Object.keys(next).every(code => mechanicCoversUnit(person, code)))) {
      setMechanicId('');
    }
    setSelected(next);
  }

  async function reviewBatch() {
    if (!canReview || submitting.current) return;
    const body = { ...resources, partsDetail: resources.partsStatus === 'not_required' ? '' : resources.partsDetail,
      items: items.map(({ unit }) => ({ unit, hours: selected[unit] ?? '' })), scheduledDate, mechanicId };
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await requestWorkshop<BatchReview>('pmbatchcheck', body);
      setReview({ data, body });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo revisar el lote.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function saveBatch() {
    const body = pending ?? (review && { ...review.body, confirmation: review.data.confirmation, mutationId: crypto.randomUUID() });
    if (submitting.current || !body) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setPending(body);
    rememberPending(storageKey, body);
    try {
      const saved = await requestWorkshop<BatchResult>('pmbatch', { ...body });
      void useWorkOrderStore.getState().fetchWorkOrders();
      setResult(saved);
      setReview(null);
      setPending(null);
      rememberPending(storageKey, null);
    } catch (cause) {
      if (cause instanceof WorkshopApiError && [400, 403, 404, 409].includes(cause.status)) {
        setSelected(Object.fromEntries(body.items.map(item => [item.unit, item.hours])));
        setScheduledDate(body.scheduledDate);
        setResources({ shift: body.shift, partsStatus: body.partsStatus, partsDetail: body.partsDetail });
        setMechanicId(body.mechanicId);
        setPending(null);
        setReview(null);
        rememberPending(storageKey, null);
      }
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el lote.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setResult(null);
    setReview(null);
    setError('');
    setSelected({});
    setMechanicId('');
  }

  if (!open) return <button type="button" className={action} onClick={() => setOpen(true)} disabled={!entries?.length}>Programar por lote</button>;
  return <section className="mb-4 space-y-3 rounded-xl border border-border bg-white p-4" aria-label="Programación PM por lote">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold text-text">Programar PM por lote</h2>
      {!pending && <button type="button" disabled={busy} onClick={close} className="min-h-11 text-sm font-semibold underline">Volver al programa</button>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result ? <>
      <h3 role="status" className="font-semibold text-success">{result.orders.length} órdenes programadas</h3>
      <ul className="divide-y divide-border text-sm">
        {result.orders.map(row => <li key={row.otId} className="py-2">
          <Link className="font-semibold underline" to={`/workorders/${encodeURIComponent(row.otId)}`}>{row.folio ?? row.otId}</Link>
          <span> · {row.unit} · {row.level} · {meter(row.dueAt)}</span>
        </li>)}
      </ul>
      <div className="flex justify-end">
        <Link to={`/calendar?fecha=${encodeURIComponent(result.date)}`} className="inline-flex min-h-11 items-center font-semibold underline">Abrir calendario</Link>
      </div>
    </> : pending ? <>
      <p className="text-sm text-text-secondary">Lote por confirmar · {pending.items.map(item => item.unit).join(', ')}</p>
      <button type="button" className={action} disabled={busy} onClick={() => void saveBatch()}>
        {busy ? 'Confirmando lote…' : 'Reintentar el mismo lote'}
      </button>
    </> : review ? <>
      <h3 className="font-semibold text-text">{review.body.scheduledDate} · Turno {review.body.shift}</h3>
      <p className="text-xs text-text-secondary">{review.data.sourceCut
        ? `Corte PM FLOTA · ${new Date(review.data.sourceCut).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })}`
        : 'Fuente: PM FLOTA'}</p>
      <ul className="divide-y divide-border text-sm">
        {review.data.items.map(row => <li key={row.unit} className="py-2">
          <p className="font-semibold">{row.unit} · {row.level} · Vence a {meter(row.dueAt)}</p>
          <p className="break-words">{row.checklistReference}</p>
          <p className="text-text-secondary">{meter(row.hours)} de trabajo</p>
        </li>)}
      </ul>
      {review.data.warnings.length > 0 && <ul className="rounded-lg bg-amber-50 p-3 text-sm">
        {review.data.warnings.map(({ code, message }) => <li key={code}>{message}</li>)}
      </ul>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setReview(null)} className="min-h-11 text-sm font-semibold underline">Editar lote</button>
        <button type="button" className={action} disabled={busy} onClick={() => void saveBatch()}>
          Confirmar {review.data.items.length} órdenes
        </button>
      </div>
    </> : <fieldset disabled={busy} className="min-w-0 space-y-3">
      <legend className="text-sm text-text-secondary">Selecciona entre 2 y 25 equipos</legend>
      <div className="max-h-80 divide-y divide-border overflow-y-auto">
        {(entries ?? []).map(entry => {
          const checked = Object.hasOwn(selected, entry.unit);
          const { dueAt } = entry;
          const available = dueAt !== null && !entry.batchBlock;
          return <div key={entry.unit} className="py-2">
            <label className="flex min-h-11 items-center gap-2 break-words text-sm">
              <input type="checkbox" aria-label={`Seleccionar ${entry.unit}`} checked={checked} disabled={!available && !checked}
                onChange={() => toggleUnit(entry.unit)} />
              <span>{entry.unit} · {available ? `${entry.level} · ${meter(dueAt)}` : entry.batchBlock}</span>
            </label>
            {checked && available && <label className="block text-sm text-text-secondary">
              Horas estimadas de {entry.unit}
              <input className={field} type="number" inputMode="decimal" min="0.25" max="240" step="0.25" value={selected[entry.unit]}
                onChange={event => setSelected({ ...selected, [entry.unit]: event.target.value })} />
            </label>}
          </div>;
        })}
      </div>
      <label className="block text-sm text-text-secondary">
        Fecha programada
        <input type="date" className={field} value={scheduledDate} onChange={event => setScheduledDate(event.target.value)} />
      </label>
      <label className="block text-sm text-text-secondary">
        Mecánico (opcional)
        <select className={field} value={mechanicId} onChange={event => setMechanicId(event.target.value)}>
          <option value="">Sin asignar</option>
          {eligible.map(person => <option key={person.userId} value={person.userId}>{person.userName}</option>)}
        </select>
      </label>
      {mechanicsError && <p className="text-sm text-text-secondary">Padrón de mecánicos no disponible.</p>}
      <ScheduleResourcesFields value={resources} onChange={setResources} />
      <button type="button" className={action} disabled={!canReview || busy} onClick={() => void reviewBatch()}>
        {busy ? 'Revisando…' : 'Revisar lote'}
      </button>
    </fieldset>}
  </section>;
}
