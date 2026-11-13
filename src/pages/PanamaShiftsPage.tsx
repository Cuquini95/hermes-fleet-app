import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { mexicoDateInput } from '../lib/date-utils';
import { downloadBlob } from '../lib/download-blob';
import { shiftHandoffCsv } from '../lib/finance-handoff';
import { useAuthStore } from '../stores/auth-store';

type ShiftFields = Record<'unit' | 'date' | 'shift' | 'initialHours' | 'finalHours' | 'equipmentStatus' | 'support' | 'trips' | 'tonnes' | 'stops' | 'client', string>;
type Actor = { id: string; name: string };
type ShiftAction = 'deliver' | 'correct' | 'accept' | 'return';
type ShiftPart = Omit<ShiftFields, 'initialHours' | 'finalHours' | 'trips' | 'tonnes'> & {
  id: string; version: number; hours: number; initialHours: number; finalHours: number; trips: number; tonnes: number;
  status: 'Pendiente de revisión' | 'Aceptado por Supervisión' | 'Devuelto';
  officialStatus: string; officialReference?: string; createdBy: Actor; createdAt: string; reviewedBy: Actor | null; reviewedAt: string | null; comment: string;
  history: { action: ShiftAction; actor: Actor; at: string; comment: string }[];
};
type Mutation = { endpoint: 'entregar' | 'revisar'; data: Record<string, unknown> };
type DispatchFields = Record<'unit' | 'date' | 'shift' | 'site' | 'operatorId', string>;
type DispatchOperator = { userId: string; userName: string; allUnits: boolean; assignedUnits: string[] };
type DispatchAssignment = { id: string; unit: string; date: string; shift: string; site: string; operator: Actor; assignedBy: Actor; assignedAt: string;
  readiness: { level: 'ok' | 'restricted' | 'blocked'; reason: string } };

const inputClass = 'w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base font-normal';
const labelClass = 'flex min-w-0 flex-col gap-1 text-sm font-semibold';
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-[#162252] disabled:opacity-50';
const primaryClass = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const localTime = new Intl.DateTimeFormat('es-PA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Panama' });
const actionLabels: Record<ShiftAction, string> = { deliver: 'Entregó', correct: 'Corrigió', accept: 'Aceptó', return: 'Devolvió' };

function emptyFields(): ShiftFields {
  return { unit: '', date: mexicoDateInput(), shift: '', initialHours: '', finalHours: '', equipmentStatus: '',
    support: '', trips: '', tonnes: '', stops: '', client: '' };
}

class ShiftRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestShifts<T>(mutation?: Mutation, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/hermes-api/api/panama/turnos${mutation ? '/' + mutation.endpoint : ''}`, {
    method: mutation ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: mutation ? { 'Content-Type': 'application/json' } : undefined,
    body: mutation ? JSON.stringify(mutation.data) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ShiftRequestError(result?.error ?? 'No se pudo consultar el relevo.', response.status);
  if (mutation ? !result?.record?.id : !Array.isArray(result?.records)) throw new Error('El servidor no confirmó la operación.');
  return result;
}

async function requestDispatch(data?: DispatchFields & { mutationId: string; expectedUserId: string }, signal?: AbortSignal) {
  const response = await fetch('/hermes-api/api/panama/turnos/despacho', {
    method: data ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ShiftRequestError(result?.error ?? 'No se pudo confirmar el despacho.', response.status);
  if (data ? !result?.assignment?.id : !Array.isArray(result?.assignments) || !Array.isArray(result?.operators)) {
    throw new Error('El servidor no confirmó el despacho.');
  }
  return result as { assignment: DispatchAssignment; assignments: DispatchAssignment[]; operators: DispatchOperator[] };
}

function DispatchPanel({ userId, canAssign, units }: { userId: string; canAssign: boolean; units: { unit_id: string; model: string }[] }) {
  const [assignments, setAssignments] = useState<DispatchAssignment[]>([]);
  const [operators, setOperators] = useState<DispatchOperator[]>([]);
  const [fields, setFields] = useState<DispatchFields>({ unit: '', date: mexicoDateInput(), shift: '', site: '', operatorId: '' });
  const [retry, setRetry] = useState<Parameters<typeof requestDispatch>[0]>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const writeLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    requestDispatch(undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setAssignments(result.assignments); setOperators(result.operators); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function bind(key: keyof DispatchFields) {
    return { value: fields[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFields(current => ({ ...current, [key]: value, ...(key === 'unit' ? { operatorId: '' } : {}) }));
    } };
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writeLock.current) return;
    writeLock.current = true;
    const data = retry ?? { ...fields, mutationId: crypto.randomUUID(), expectedUserId: userId };
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { assignment } = await requestDispatch(data);
      setAssignments(current => [assignment, ...current.filter(item => item.id !== assignment.id)]);
      setMessage(assignment.readiness.level === 'ok'
        ? `Asignación ${assignment.id} confirmada para ${assignment.operator.name}.`
        : `Asignación ${assignment.id} guardada. El equipo tiene una restricción vigente.`);
      setRetry(undefined);
      setFields(current => ({ ...current, operatorId: '', unit: '' }));
    } catch (cause) {
      const mayRetry = !(cause instanceof ShiftRequestError) || cause.status >= 500 || [408, 429].includes(cause.status);
      setRetry(mayRetry ? data : undefined);
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el despacho.');
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  const eligible = operators.filter(person => person.allUnits || person.assignedUnits.includes(fields.unit));
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="dispatch-heading">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="dispatch-heading" className="text-lg font-bold">Asignaciones de despacho</h2>
      <button type="button" className={buttonClass} disabled={loading || saving || !!retry}
        onClick={() => { setLoading(true); setError(''); setReload(value => value + 1); }}>Actualizar asignaciones</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-900">{message}</p>}
    {canAssign && <form className="space-y-3" onSubmit={assign}>
      <fieldset disabled={loading || saving || !!retry} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className={labelClass}>Unidad para despacho<select className={inputClass} required {...bind('unit')}>
          <option value="">Selecciona una unidad</option>
          {units.map(item => <option key={item.unit_id} value={item.unit_id}>{item.unit_id} · {item.model}</option>)}
        </select></label>
        <label className={labelClass}>Operador para despacho<select className={inputClass} required {...bind('operatorId')}>
          <option value="">Selecciona un operador habilitado</option>
          {eligible.map(person => <option key={person.userId} value={person.userId}>{person.userName}</option>)}
        </select></label>
        <label className={labelClass}>Fecha de despacho<input className={inputClass} type="date" required {...bind('date')} /></label>
        <label className={labelClass}>Turno de despacho<input className={inputClass} required maxLength={32} {...bind('shift')} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Sitio o frente<input className={inputClass} required maxLength={160} {...bind('site')} /></label>
      </fieldset>
      <button type="submit" className={primaryClass} disabled={saving || loading || (!retry && !eligible.length)}>
        {saving ? 'Confirmando despacho…' : retry ? 'Reintentar la misma asignación' : 'Confirmar asignación'}
      </button>
    </form>}
    {loading ? <p role="status" className="text-sm text-slate-600">Consultando asignaciones…</p>
      : !assignments.length && !error && <p className="text-sm text-slate-600">Sin asignaciones en tu alcance.</p>}
    {assignments.map(item => <article key={item.id} className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
      <h3 className="font-semibold">{item.unit} · {item.date} · {item.shift}</h3>
      <p className="break-words">{item.id} · {item.site} · {item.operator.name}</p>
      <p className="text-slate-700">Asignó {item.assignedBy.name} · {localTime.format(new Date(item.assignedAt))}</p>
      {item.readiness.level !== 'ok' && <p className="font-semibold text-red-800">No despachar. {item.readiness.reason}</p>}
    </article>)}
  </section>;
}

export default function PanamaShiftsPage() {
  const project = useAuthStore(state => state.project);
  const userId = useAuthStore(state => state.userId);
  if (project !== 'tmf-panama') return <Navigate to="/" replace />;
  return <ShiftQueue key={userId} userId={userId} />;
}

function ShiftQueue({ userId }: { userId: string }) {
  const role = useAuthStore(state => state.role);
  const equipment = useEquipmentList();
  const [records, setRecords] = useState<ShiftPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [fields, setFields] = useState(emptyFields);
  const [correction, setCorrection] = useState<ShiftPart>();
  const [returnPart, setReturnPart] = useState<string>();
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState<Mutation>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const writeLock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const allowDelivery = role === 'operador' || role === 'supervisor';
  const hours = Number(fields.finalHours) - Number(fields.initialHours);
  const invalidReading = fields.initialHours !== '' && fields.finalHours !== '' && (hours < 0 || hours > 24);

  useEffect(() => {
    const controller = new AbortController();
    requestShifts<{ records: ShiftPart[] }>(undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setRecords(result.records); })
      .catch(() => { if (!controller.signal.aborted) setLoadError('No se pudieron consultar los partes de turno.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function refresh() {
    setLoading(true);
    setLoadError('');
    setReload(value => value + 1);
  }

  async function send(mutation: Mutation) {
    if (writeLock.current) return;
    writeLock.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { record } = await requestShifts<{ record: ShiftPart }>(mutation);
      setRetry(undefined);
      setRecords(items => [record, ...items.filter(item => item.id !== record.id)]);
      setMessage(`${record.id} · ${record.status}.`);
      if (mutation.endpoint === 'entregar') {
        setFields(emptyFields());
        setCorrection(undefined);
      } else {
        setReturnPart(undefined);
        setComment('');
      }
    } catch (cause) {
      if (cause instanceof ShiftRequestError && cause.status < 500 && ![408, 429].includes(cause.status)) {
        setRetry(undefined);
        setError(cause.message);
        if (cause.status === 409) refresh();
      } else {
        setRetry(mutation);
        setError('El servidor no confirmó la operación. Reintenta el mismo envío para recuperar su comprobante.');
      }
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  function deliver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidReading || retry) return;
    void send({ endpoint: 'entregar', data: { ...fields, mutationId: crypto.randomUUID(), expectedUserId: userId,
      ...(correction ? { id: correction.id, version: correction.version } : {}) } });
  }

  function review(record: ShiftPart, action: 'accept' | 'return') {
    void send({ endpoint: 'revisar', data: { id: record.id, version: record.version, action, comment: action === 'return' ? comment : '',
      mutationId: crypto.randomUUID(), expectedUserId: userId } });
  }

  function edit(record: ShiftPart) {
    setCorrection(record);
    setFields({ unit: record.unit, date: record.date, shift: record.shift, initialHours: String(record.initialHours), finalHours: String(record.finalHours),
      equipmentStatus: record.equipmentStatus, support: record.support, trips: String(record.trips), tonnes: String(record.tonnes), stops: record.stops, client: record.client });
    setError('');
    form.current?.scrollIntoView({ block: 'start' });
  }

  function bind(key: keyof ShiftFields) {
    return { value: fields[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFields(value => ({ ...value, [key]: event.target.value }));
    } };
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl bg-[#162252] p-4 text-white">
          <Link to="/panama" className="inline-flex min-h-11 items-center text-sm text-slate-200 underline underline-offset-4">Volver a Maestros TMF</Link>
          <h1 className="text-xl font-bold">Relevo de turno</h1>
          <p className="mt-1 text-sm text-slate-200">TMF Minera Panamá · Parte de producción F07</p>
        </header>

        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Supervisión revisa la entrega en Hermes. El controlador verifica una sola captura en REGISTRO TMF y conserva la referencia del parte.</p>
        <DispatchPanel userId={userId} canAssign={role === 'supervisor' || role === 'coordinador'} units={equipment} />
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <p role="alert">{error}</p>
          {retry && <button type="button" className={`${buttonClass} mt-2`} disabled={saving} onClick={() => void send(retry)}>Reintentar el mismo envío</button>}
        </div>}

        {allowDelivery && <form ref={form} onSubmit={deliver} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">{correction ? `Corregir ${correction.id}` : 'Entregar parte'}</h2>
          <fieldset disabled={saving || !!retry} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className={labelClass}>
              <label htmlFor="shift-unit">Unidad</label>
              <select id="shift-unit" className={inputClass} required disabled={!!correction} {...bind('unit')}>
                <option value="">Selecciona una unidad</option>
                {equipment.map(item => <option key={item.unit_id} value={item.unit_id}>{item.unit_id} · {item.model}</option>)}
              </select>
            </div>
            <label className={labelClass}>Fecha del turno<input className={inputClass} type="date" required readOnly={!!correction} {...bind('date')} /></label>
            <label className={labelClass}>Turno<input className={inputClass} required maxLength={32} placeholder="Como figura en REGISTRO TMF" readOnly={!!correction} {...bind('shift')} /></label>
            <label className={labelClass}>Estado del equipo<input className={inputClass} required maxLength={100} {...bind('equipmentStatus')} /></label>
            <label className={labelClass}>Horómetro inicial (h)<input className={inputClass} type="number" inputMode="decimal" required min="0" max="99999999.999" step="0.001" {...bind('initialHours')} /></label>
            <label className={labelClass}>Horómetro final (h)<input className={inputClass} type="number" inputMode="decimal" required min="0" max="99999999.999" step="0.001" {...bind('finalHours')} /></label>
            {invalidReading && <p role="alert" className="text-sm font-semibold text-red-800 sm:col-span-2">
              {hours < 0 ? 'El horómetro final es inferior al inicial.' : 'La diferencia del horómetro supera 24 horas.'} Verifica la lectura en su origen.
            </p>}
            <label className={labelClass}>Viajes<input className={inputClass} type="number" inputMode="numeric" required min="0" max="99999999" step="1" {...bind('trips')} /></label>
            <label className={labelClass}>Toneladas<input className={inputClass} type="number" inputMode="decimal" required min="0" max="99999999.999" step="0.001" {...bind('tonnes')} /></label>
            <label className={labelClass}>Cliente<input className={inputClass} required maxLength={120} {...bind('client')} /></label>
            <label className={labelClass}>Referencia del soporte<input className={inputClass} required maxLength={250} {...bind('support')} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Paradas o episodio de avería
              <textarea className={inputClass} required rows={2} maxLength={500} placeholder="Ej. Sin paradas o referencia de AVERIAS" {...bind('stops')} />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className={primaryClass} disabled={loading || invalidReading || !equipment.length}>{saving ? 'Confirmando…' : 'Entregar a Supervisión'}</button>
              {correction && <button type="button" className={buttonClass} onClick={() => { setCorrection(undefined); setFields(emptyFields()); }}>Cancelar corrección</button>}
            </div>
          </fieldset>
        </form>}

        <section className="space-y-3" aria-labelledby="turnos-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="turnos-heading" className="text-lg font-bold">Partes de turno</h2>
            <button type="button" className={buttonClass} onClick={refresh} disabled={loading || saving || !!retry}>Actualizar</button>
          </div>
          {loading && <p role="status" className="text-sm text-slate-600">Consultando partes…</p>}
          {loadError && <p role="alert" className="text-sm text-red-800">{loadError}</p>}
          {!loading && !loadError && records.length === 0 && <p className="text-sm text-slate-600">Sin partes de turno en tu alcance.</p>}
          {records.map(record => (
            <article key={record.id} className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-bold text-[#162252]">{record.unit} · {record.date} · {record.shift}</h3>
              <p className="break-words text-sm font-semibold">{record.id} · {record.status}</p>
              <p className="text-sm text-slate-700">{record.initialHours} → {record.finalHours} h · {record.hours} h del turno · {record.trips} viajes · {record.tonnes} t</p>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold">Estado del equipo</dt><dd className="break-words">{record.equipmentStatus}</dd></div>
                <div><dt className="font-semibold">Cliente</dt><dd className="break-words">{record.client}</dd></div>
                <div><dt className="font-semibold">Soporte</dt><dd className="break-words">{record.support}</dd></div>
                <div><dt className="font-semibold">Paradas</dt><dd className="break-words">{record.stops}</dd></div>
              </dl>
              <p className="text-sm text-slate-700">Entregó {record.createdBy.name} · {localTime.format(new Date(record.createdAt))}</p>
              {record.reviewedBy && record.reviewedAt && <p className="break-words text-sm text-slate-700">Revisó {record.reviewedBy.name} · {localTime.format(new Date(record.reviewedAt))}{record.comment ? ` · ${record.comment}` : ''}</p>}
              <p className="break-words text-sm font-semibold text-amber-900">{record.officialStatus}{record.officialReference && ` · ${record.officialReference}`}</p>
              {(role === 'gerencia' || role === 'coordinador') && record.status === 'Aceptado por Supervisión' && record.reviewedAt && record.reviewedBy && (
                <button type="button" className={buttonClass} onClick={() => downloadBlob(
                  new Blob([shiftHandoffCsv(record)], { type: 'text/csv;charset=utf-8' }),
                  `Hermes-valorizacion-${record.id}.csv`,
                )}>Descargar parte para conciliación</button>
              )}
              {record.history.length > 1 && <details className="text-sm text-slate-700">
                <summary>Actividad del parte</summary>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  {record.history.map((entry, index) => <li key={index} className="break-words">{actionLabels[entry.action]} {entry.actor.name} · {localTime.format(new Date(entry.at))}{entry.comment ? ` · ${entry.comment}` : ''}</li>)}
                </ol>
              </details>}
              {allowDelivery && record.createdBy.id === userId && record.status === 'Devuelto' && <button type="button" className={buttonClass} disabled={loading || saving || !!retry} onClick={() => edit(record)}>Corregir parte</button>}
              {role === 'supervisor' && record.createdBy.id !== userId && record.status === 'Pendiente de revisión' && (
                returnPart === record.id ? <form className="space-y-2" onSubmit={event => { event.preventDefault(); review(record, 'return'); }}>
                  <label className={labelClass}>Motivo de devolución<textarea className={inputClass} rows={2} required maxLength={500} value={comment} onChange={event => setComment(event.target.value)} /></label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={primaryClass} disabled={loading || saving || !!retry || !comment.trim()}>Confirmar devolución</button>
                    <button type="button" className={buttonClass} disabled={saving || !!retry} onClick={() => { setReturnPart(undefined); setComment(''); }}>Cancelar</button>
                  </div>
                </form> : <div className="flex flex-wrap gap-2">
                  <button type="button" className={primaryClass} disabled={loading || saving || !!retry} onClick={() => review(record, 'accept')}>Aceptar parte</button>
                  <button type="button" className={buttonClass} disabled={loading || saving || !!retry} onClick={() => { setReturnPart(record.id); setComment(''); }}>Devolver para corrección</button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
