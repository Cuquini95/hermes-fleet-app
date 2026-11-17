import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestWorkshop, WorkshopApiError } from '../../lib/workshop-api';
import { useAuthStore } from '../../stores/auth-store';

const labels = { new: 'Instalación nueva', partial: 'Cambio parcial', rebuild: 'Reconstrucción' } as const;
type InterventionType = keyof typeof labels;
const hours = (value: number) => `${value.toLocaleString('es-PA', { maximumFractionDigits: 3 })} h`;

interface Intervention {
  id: string;
  folio: string;
  part: string;
  position: string;
  action: InterventionType;
  meter: number;
  priorHours: number | null;
  carriedHours: number;
  reference: string;
  details: string;
  reviewedBy: string;
  recordedAt: string;
  previous?: { id: string; folio: string };
}

export interface ComponentInterventionHistory {
  interventions: Intervention[];
  incomplete: boolean;
  catalog?: Record<string, { positions: string[]; numbered: boolean }>;
  confirmedRequests?: string[];
}

export function ComponentInterventionList({ history, linkOrders }: { history: ComponentInterventionHistory; linkOrders: boolean }) {
  return (
    <>
      {history.incomplete && <p role="status" className="text-sm text-amber-900">Parte del historial requiere revisión.</p>}
      {history.interventions.length === 0 && !history.incomplete && <p className="text-sm text-text-secondary">Sin intervenciones registradas en Hermes.</p>}
      <ul aria-label="Intervenciones de componentes" className="grid gap-2 md:grid-cols-2">
        {history.interventions.map(row => <li key={row.id} className="min-w-0 space-y-1 break-words rounded-lg border border-border bg-white p-3 text-sm">
          <p className="font-semibold">{row.part} · {row.position}</p>
          <p>{labels[row.action]} · Horómetro {hours(row.meter)}</p>
          <p>Uso anterior {row.priorHours === null ? 'sin dato' : hours(row.priorHours)} · <strong>Vida arrastrada {hours(row.carriedHours)}</strong></p>
          <p>{row.details}</p>
          <p className="text-text-secondary">Respaldo {row.reference}</p>
          <p className="text-text-secondary">{row.reviewedBy} · {new Date(row.recordedAt).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })}</p>
          {linkOrders && <p className="space-x-3">
            <Link className="font-medium text-blue-800 underline" to={`/workorders/${encodeURIComponent(row.folio)}`}>{row.folio}</Link>
            {row.previous && <Link className="text-blue-800 underline" to={`/workorders/${encodeURIComponent(row.previous.folio)}`}>Anterior {row.previous.folio}</Link>}
          </p>}
        </li>)}
      </ul>
    </>
  );
}

const initial = { action: '' as InterventionType | '', part: '', position: '', positionNumber: '', meter: '', priorHours: '', carriedHours: '', details: '', reference: '' };
const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-2 text-sm text-text';
const hourFields = { type: 'number', min: 0, max: 9_999_999.999, step: '0.001', inputMode: 'decimal' } as const;
type Attempt = { mutationId: string; input: Record<string, unknown>; fields: typeof initial };

function loadAttempt(key: string): Attempt | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null'); } catch { return null; }
}

function storeAttempt(key: string, attempt: Attempt | null) {
  try {
    if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt));
    else sessionStorage.removeItem(key);
  } catch { /* The currently open form can still retry. */ }
}

export default function OrderComponentInterventions({ otId, version, mayRegister, onSave }: {
  otId: string; version?: string; mayRegister: boolean; onSave: () => Promise<unknown>;
}) {
  const actorId = useAuthStore(state => state.userId);
  const inputId = useId();
  const key = `hermes:component-intervention:${JSON.stringify([actorId, otId])}`;
  const [restored] = useState(() => loadAttempt(key));
  const [open, setOpen] = useState(Boolean(restored));
  const [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<ComponentInterventionHistory>();
  const [readError, setReadError] = useState('');
  const [fields, setFields] = useState(restored?.fields ?? initial);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(Boolean(restored));
  const [message, setMessage] = useState(restored ? 'Confirmación pendiente. Reintenta el mismo registro.' : '');
  const attempt = useRef<Attempt | null>(restored);
  const sending = useRef(false);
  const specs = history?.catalog?.[fields.part];

  useEffect(() => {
    if (!open) return;
    let active = true;
    void requestWorkshop<ComponentInterventionHistory>(`componentinterventions?${new URLSearchParams({ otId })}`)
      .then(record => {
        if (!active) return;
        setHistory(record);
        setReadError('');
        if (attempt.current && record.confirmedRequests?.includes(attempt.current.mutationId)) {
          attempt.current = null;
          storeAttempt(key, null);
          setPending(false);
          setFields(initial);
          setMessage('Intervención guardada.');
        }
      })
      .catch((reason: unknown) => { if (active) setReadError(reason instanceof Error ? reason.message : 'Historial no disponible.'); });
    return () => { active = false; };
  }, [open, otId, revision, key]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !mayRegister || history?.incomplete) return;
    sending.current = true;
    setSaving(true);
    setMessage('');
    const { priorHours, carriedHours, action, position, positionNumber, ...required } = fields;
    attempt.current ??= { mutationId: crypto.randomUUID(), fields, input: { ...required, otId, expectedVersion: version, action,
      position: positionNumber ? `${position} ${positionNumber}` : position,
      ...(priorHours !== '' && { priorHours }), ...(action === 'rebuild' && { carriedHours }) } };
    storeAttempt(key, attempt.current);
    try {
      await requestWorkshop('componentinterventions', { ...attempt.current.input, mutationId: attempt.current.mutationId });
      attempt.current = null;
      storeAttempt(key, null);
      setPending(false);
      setFields(initial);
      setMessage('Intervención guardada.');
      setRevision(value => value + 1);
      void onSave();
    } catch (reason) {
      if (!attempt.current) return;
      const uncertain = !(reason instanceof WorkshopApiError) || reason.status >= 500;
      setPending(uncertain);
      if (!uncertain) {
        attempt.current = null;
        storeAttempt(key, null);
        if (reason instanceof WorkshopApiError && reason.status === 409) { setRevision(value => value + 1); void onSave(); }
      }
      setMessage(uncertain ? 'Confirmación pendiente. Reintenta el mismo registro.' : reason.message);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  return (
    <details open={open} className="min-w-0 rounded-xl border border-border bg-white p-4" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer py-1 text-sm font-semibold text-text">Intervenciones de componentes</summary>
      {open && <div className="mt-3 space-y-3">
        {readError && <p role="alert" className="text-sm text-amber-900">{readError}</p>}
        {!readError && !history && <p role="status" className="text-sm text-text-secondary">Consultando intervenciones…</p>}
        {history && <ComponentInterventionList history={history} linkOrders={false} />}
        {mayRegister && (pending || (history?.catalog && !history.incomplete)) && (
          <form className="space-y-3 border-t border-border pt-3" onSubmit={submit}>
            <fieldset disabled={pending || saving} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 text-sm font-medium">
                <label htmlFor={`${inputId}-action`}>Tipo de intervención</label>
                <select id={`${inputId}-action`} className={inputClass} required value={fields.action} onChange={e => setFields({ ...fields, action: e.target.value as typeof fields.action })}>
                  <option value="">Seleccionar</option>
                  {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="min-w-0 text-sm font-medium">
                <label htmlFor={`${inputId}-part`}>Componente</label>
                <select id={`${inputId}-part`} className={inputClass} value={fields.part} onChange={e => setFields({ ...fields, part: e.target.value, position: '', positionNumber: '' })} required>
                  <option value="">Seleccionar</option>
                  {Object.keys(history?.catalog ?? {}).map(part => <option key={part}>{part}</option>)}
                </select>
              </div>
              <div className="min-w-0 text-sm font-medium">
                <label htmlFor={`${inputId}-position`}>Posición</label>
                <select id={`${inputId}-position`} className={inputClass} value={fields.position} onChange={e => setFields({ ...fields, position: e.target.value, positionNumber: '' })} required>
                  <option value="">Seleccionar</option>
                  {specs?.positions.map(position => <option key={position}>{position}</option>)}
                </select>
              </div>
              {specs?.numbered && ['Izquierda', 'Derecha'].includes(fields.position) && <label className="text-sm font-medium">Número de posición (opcional)
                <input type="number" inputMode="numeric" min={1} max={99} step={1} className={inputClass} value={fields.positionNumber}
                  onChange={e => setFields({ ...fields, positionNumber: e.target.value })} />
              </label>}
              <label className="text-sm font-medium">Horómetro acumulado al intervenir
                <input {...hourFields} className={inputClass} value={fields.meter} onChange={e => setFields({ ...fields, meter: e.target.value })} required />
              </label>
              <label className="text-sm font-medium">Horas anteriores al trabajo
                <input {...hourFields} className={inputClass} value={fields.priorHours} onChange={e => setFields({ ...fields, priorHours: e.target.value })} />
                <span className="text-xs text-text-secondary">Hermes las calcula cuando ya existe historial para la posición.</span>
              </label>
              {fields.action === 'rebuild' && <label className="text-sm font-medium">Horas que conserva la reconstrucción
                <input {...hourFields} className={inputClass} value={fields.carriedHours} onChange={e => setFields({ ...fields, carriedHours: e.target.value })} required />
              </label>}
              <label className="text-sm font-medium">Trabajo realizado
                <textarea className={`${inputClass} py-2`} value={fields.details} onChange={e => setFields({ ...fields, details: e.target.value })} required maxLength={800} />
              </label>
              <label className="text-sm font-medium">Referencia del respaldo
                <input className={inputClass} value={fields.reference} onChange={e => setFields({ ...fields, reference: e.target.value })} required maxLength={180} />
              </label>
            </fieldset>
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : pending ? 'Reintentar registro' : 'Guardar intervención'}
            </button>
          </form>
        )}
        {message && <p role="status" className="text-sm text-text">{message}</p>}
      </div>}
    </details>
  );
}
