import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { requestWorkshop, WorkshopApiError } from '../../lib/workshop-api';
import { useAuthStore } from '../../stores/auth-store';
import { panamaTireLayout } from '../../lib/panama-tire-layouts';

const labels = { mount: 'Montar', move: 'Trasladar o rotar', inspect: 'Inspeccionar', remove: 'Desmontar', cost: 'Registrar costo' } as const;
const events = { mount: 'Montaje', move: 'Traslado o rotación', inspect: 'Inspección', remove: 'Desmontaje', cost: 'Costo de adquisición' } as const;
const number = (value: number) => value.toLocaleString('es-PA', { maximumFractionDigits: 4 });
const date = (value: string) => new Date(value).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Panama' });
const input = 'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm';
const primary = 'min-h-11 rounded-lg bg-[#162252] px-4 text-sm font-semibold text-white disabled:opacity-50';
type Action = keyof typeof labels;
type Basis = 'h' | 'km';
type Place = { unit: string; position: string };
const location = (value: Place) => `${value.unit} · ${value.position}`;
type Charge = { amount: number; currency: string; reference: string };
type TireEvent = { id: string; action: Action; at: string; actor: string; location?: Place; from?: Place; meter?: number;
  arrivalMeter?: number; depth?: number; pressure?: number; cost?: Charge };
type Report = { serial: string; current: Place | null; retired: boolean; latest: string | null; basis: Basis | null; incomplete: boolean;
  totals: { basis: Basis; usage: number; amount: number | null; currency: string | null; rate: number | null; reference: string | null } | null;
  history: TireEvent[]; legacy: { unit: string; position: string; meter: string; pressure: string; depth: string; date: string; note: string; status: string }[] };
type Pending = { serial: string; payload: Record<string, string> };
type UnitTireReport = {
  unit: string; source: string; legacyRecords: number;
  mounted: { serial: string; position: string; basis: Basis;
    inspection?: { at: string; meter: number; pressure: number; depth: number } }[];
};

function readPending(key: string): Pending | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null'); } catch { return null; }
}

function writePending(key: string, value: Pending | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* The form can still retry while open. */ }
}

export default function PanamaTireHistory() {
  const equipment = useEquipmentList();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedUnit = (searchParams.get('unit') ?? '').trim().toUpperCase();
  const unit = equipment.find(item => item.unit_id.toUpperCase() === requestedUnit && panamaTireLayout(item.type));
  const [unitBoard, setUnitBoard] = useState<UnitTireReport>();
  const [unitBoardError, setUnitBoardError] = useState('');
  const actor = useAuthStore(state => state.userId);
  const key = `hermes:neumaticos:${actor}`;
  const [pending, setPending] = useState(() => readPending(key));
  const [serial, setSerial] = useState(pending?.serial ?? '');
  const [lookup, setLookup] = useState(pending?.serial ?? '');
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report>();
  const [readError, setReadError] = useState('');
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<Action | ''>('');
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    if (!unit) { setUnitBoard(undefined); setUnitBoardError(''); return; }
    let active = true;
    setUnitBoardError('');
    requestWorkshop<UnitTireReport>(`tires?${new URLSearchParams({ unit: unit.unit_id })}`)
      .then(result => { if (active) { setUnitBoard(result); setUnitBoardError(''); } })
      .catch(error => { if (active) { setUnitBoard(undefined); setUnitBoardError(error instanceof Error ? error.message : 'Sin consulta de llantas.'); } });
    return () => { active = false; };
  }, [unit?.unit_id, revision]);

  useEffect(() => {
    if (!lookup) return;
    let active = true;
    requestWorkshop<Report>(`tires?${new URLSearchParams({ serial: lookup })}`).then(result => {
      if (active) { setReport(result); setReadError(''); }
    }).catch((error: unknown) => {
      if (active) setReadError(error instanceof Error ? error.message : 'Historial no disponible.');
    });
    return () => { active = false; };
  }, [lookup, revision]);

  function lookupTire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReport(undefined);
    setReadError('');
    setMessage('');
    setAction('');
    setLookup(serial.trim().toUpperCase());
    setRevision(value => value + 1);
  }

  async function save(attempt: Pending) {
    if (sending.current) return;
    sending.current = true;
    setSaving(true);
    setMessage('');
    setPending(attempt);
    writePending(key, attempt);
    try {
      await requestWorkshop('tires', attempt.payload);
      setPending(null);
      writePending(key, null);
      setAction('');
      setMessage('Registro guardado.');
      setRevision(value => value + 1);
    } catch (error) {
      if (error instanceof WorkshopApiError && error.status < 500) {
        setPending(null);
        writePending(key, null);
        setMessage(error.message);
        if (error.status === 409) { setAction(''); setRevision(value => value + 1); }
      } else setMessage('Confirmación pendiente. Reintenta el mismo registro.');
    } finally {
      setSaving(false);
      sending.current = false;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report || !action) return;
    const data = Object.fromEntries([...new FormData(event.currentTarget)].map(([name, value]) => [name, String(value)]));
    void save({ serial: report.serial, payload: { ...data, action, serial: report.serial, expected: report.latest ?? '', mutationId: crypto.randomUUID() } });
  }

  const totals = report?.totals;
  const available: Action[] = report?.current ? ['inspect', 'move', 'remove'] : report?.incomplete ? [] : ['mount'];
  if (totals && totals.amount === null) available.push('cost');
  return (
    <main className="min-w-0 space-y-4 py-4">
      <h1 className="text-xl font-bold text-text">Neumáticos · Unidad, posición y número de fuego</h1>
      <section aria-label="Llantas montadas por unidad" className="space-y-2 rounded-xl border border-border bg-white p-3">
        <h2 className="font-semibold">Posiciones del equipo</h2>
        <label className="block text-sm font-medium">Seleccionar unidad
          <select className={input} value={unit?.unit_id ?? ''}
            onChange={event => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set('unit', event.target.value);
              else next.delete('unit');
              setUnitBoard(undefined);
              setSearchParams(next);
            }}>
            <option value="">Seleccionar</option>
            {equipment.filter(item => panamaTireLayout(item.type)).map(item =>
              <option key={item.unit_id} value={item.unit_id}>{item.unit_id} · {item.model}</option>)}
          </select>
        </label>
        {requestedUnit && !unit && <p className="text-sm text-amber-800">Unidad no disponible para este usuario o sin layout de neumáticos.</p>}
        {unitBoardError && <p role="alert" className="text-sm text-red-700">{unitBoardError}</p>}
        {unit && !unitBoardError && unitBoard?.unit !== unit.unit_id && <p role="status" className="text-sm">Consultando posiciones…</p>}
        {unit && unitBoard?.unit === unit.unit_id && <>
          <p className="text-xs text-slate-600">Fuente: {unitBoard.source}. Posiciones ocupadas según eventos registrados; no sustituye verificación física.</p>
          {unitBoard.legacyRecords > 0 && <p className="text-xs text-amber-800">
            {unitBoard.legacyRecords} registro(s) de inspección histórica sin conciliar como montaje actual.
          </p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {panamaTireLayout(unit.type)?.positions.map(position => {
              const mounted = unitBoard.mounted.find(tire => tire.position === position);
              return <li key={position} className="min-w-0 rounded-lg border border-slate-200 p-2 text-sm">
                <p className="font-semibold">Posición {position}</p>
                {mounted ? <>
                  <button type="button" className="min-h-11 text-left font-semibold text-blue-800 underline"
                    onClick={() => {
                      setSerial(mounted.serial);
                      setLookup(mounted.serial);
                      setAction('');
                      setReport(undefined);
                      setRevision(value => value + 1);
                    }}>{mounted.serial} · Abrir historial</button>
                  {mounted.inspection ? <>
                    <p>Última inspección en esta posición: {date(mounted.inspection.at)}</p>
                    <p>Presión {number(mounted.inspection.pressure)} PSI · Profundidad {number(mounted.inspection.depth)} mm</p>
                  </> : <p className="text-amber-800">Sin inspección posterior al montaje o traslado registrado.</p>}
                </> : <p className="text-slate-600">Sin montaje verificado en el historial de Hermes.</p>}
              </li>;
            })}
          </ul>
        </>}
      </section>
      <form onSubmit={lookupTire} className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-3">
        <label className="min-w-0 flex-1 text-sm font-medium">Serie o número de fuego
          <input value={serial} required maxLength={80} disabled={!!pending} onChange={e => setSerial(e.target.value)} className={input} />
        </label>
        <button type="submit" disabled={!!pending} className={primary}>Consultar</button>
      </form>
      {readError && <p role="alert" className="text-sm text-red-700">{readError}</p>}
      {lookup && !report && !readError && <p role="status" className="text-sm text-text-secondary">Consultando…</p>}
      {pending && <button type="button" disabled={saving} onClick={() => void save(pending)} className={primary}>Reintentar guardado</button>}
      {message && <p role="status" className="text-sm text-text">{message}</p>}
      {report && (
        <section aria-label="Ficha de neumático" className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-3">
          <h2 className="break-words text-lg font-semibold">{report.serial}</h2>
          <p>{report.current ? location(report.current) : report.retired ? 'Desmontada' : 'Sin montaje visible'}</p>
          {report.incomplete && <p className="text-sm text-amber-900">Historial parcial según tu acceso.</p>}
          {totals && <div className="rounded-lg bg-slate-50 p-2 text-sm">
            <p>Uso desde el primer montaje en Hermes <strong>{number(totals.usage)} {totals.basis}</strong></p>
            <p>Costo de adquisición {totals.amount === null ? 'pendiente' : `${totals.currency} ${number(totals.amount)}`}</p>
            {totals.rate !== null && <p>Costo por uso <strong>{totals.currency} {number(totals.rate)}/{totals.basis}</strong></p>}
            {totals.reference && <p className="break-words">Comprobante {totals.reference}</p>}
          </div>}
          {!pending && <div className="flex flex-wrap gap-2">{available.map(next => <button type="button" key={next} onClick={() => setAction(next)}
            aria-pressed={action === next} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold aria-pressed:bg-slate-100">{labels[next]}</button>)}</div>}
          {action && (!pending || saving) && <EventForm key={action} action={action} basis={report.basis}
            confirmBaseline={!report.latest && report.legacy.length > 0} saving={saving} onSubmit={submit} />}
          {report.history.length > 0 && <ol aria-label="Historial del neumático" className="space-y-2">
            {report.history.map(event => <li key={event.id} className="break-words rounded-lg bg-slate-50 p-2 text-sm">
              <p className="font-semibold">{events[event.action]}</p>
              {event.from && <p>Origen {location(event.from)}</p>}
              {event.location && <p>{event.from ? 'Destino ' : ''}{location(event.location)}</p>}
              {event.meter !== undefined && <p>Lectura {number(event.meter)}{event.arrivalMeter !== undefined && ` · Destino ${number(event.arrivalMeter)}`}</p>}
              {event.pressure !== undefined && <p>Presión {number(event.pressure)} PSI · Profundidad {number(event.depth!)} mm</p>}
              <p className="text-xs text-text-secondary">{event.actor} · {date(event.at)}</p>
            </li>)}
          </ol>}
          {report.legacy.length > 0 && <details className="rounded-lg border border-slate-200 p-2 text-sm">
            <summary className="cursor-pointer font-medium">Inspecciones anteriores</summary>
            <ul className="mt-2 space-y-2">{report.legacy.map((row, index) => <li key={index} className="break-words">
              <p>{row.date} · {location(row)} · Presión {row.pressure === '' ? 'sin dato' : row.pressure} PSI · Profundidad {row.depth === '' ? 'sin dato' : row.depth} mm</p>
              {(row.meter || row.status) && <p>{row.meter && `Lectura ${row.meter}`} {row.status}</p>}
              {row.note && <p>{row.note}</p>}
            </li>)}</ul>
          </details>}
        </section>
      )}
    </main>
  );
}

function EventForm({ action, basis, confirmBaseline, saving, onSubmit }: { action: Action; basis: Basis | null; confirmBaseline: boolean;
  saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const equipment = useEquipmentList();
  const [unit, setUnit] = useState('');
  const layout = panamaTireLayout(equipment.find(item => item.unit_id === unit)?.type);
  const destination = action === 'mount' || action === 'move';
  const money = action === 'cost' || (action === 'mount' && !basis);
  const reading = { type: 'number', min: 0, step: '0.001', inputMode: 'decimal', required: true } as const;
  return (
    <form onSubmit={onSubmit} aria-label={labels[action]} className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
      {destination && <>
        <label className="min-w-0 text-sm">Unidad de destino
          <select name="unit" required className={input} value={unit} onChange={event => setUnit(event.target.value)}><option value="">Seleccionar</option>
            {equipment.filter(item => panamaTireLayout(item.type)).map(item => <option key={item.unit_id} value={item.unit_id}>{item.unit_id} · {item.model}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm">Posición de destino
          <select key={unit} name="position" required className={input} defaultValue=""><option value="">Seleccionar</option>
            {layout?.positions.map(position => <option key={position}>{position}</option>)}
          </select>
        </label>
      </>}
      {action === 'mount' && !basis && <label className="text-sm">Medida del equipo
        <select key={unit} name="basis" required className={input} defaultValue=""><option value="">Seleccionar</option>
          {layout?.bases.map(value => <option key={value} value={value}>{value === 'h' ? 'Horas' : 'Kilómetros'}</option>)}</select>
      </label>}
      {action !== 'cost' && <label className="text-sm">{action === 'move' ? 'Lectura acumulada de origen' : 'Lectura acumulada'}{basis && ` (${basis})`}
        <input name="meter" {...reading} className={input} />
      </label>}
      {action === 'move' && <>
        <label className="text-sm">Lectura acumulada de destino
          <input name="arrivalMeter" {...reading} className={input} />
        </label>
        <label className="text-sm">Medida del destino
          <select key={unit} name="arrivalBasis" required className={input} defaultValue=""><option value="">Seleccionar</option>
            {layout?.bases.map(value => <option key={value} value={value}>{value === 'h' ? 'Horas' : 'Kilómetros'}</option>)}</select>
        </label>
      </>}
      {action === 'inspect' && <>
        <label className="text-sm">Presión (PSI)<input name="pressure" {...reading} step="0.01" className={input} /></label>
        <label className="text-sm">Profundidad (mm)<input name="depth" {...reading} step="0.01" className={input} /></label>
      </>}
      {money && <>
        <label className="text-sm">Costo de adquisición{action === 'mount' && ' (opcional)'}
          <input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required={action === 'cost'} className={input} />
        </label>
        <label className="text-sm">Moneda<select name="currency" className={input} required={action === 'cost'} defaultValue=""><option value="">Seleccionar</option><option>USD</option><option>PAB</option></select></label>
        <label className="text-sm">Factura o comprobante<input name="reference" required={action === 'cost'} maxLength={180} className={input} /></label>
      </>}
      {action === 'mount' && confirmBaseline && <label className="flex items-center gap-2 text-sm">
        <input name="confirmBaseline" type="checkbox" value="yes" required /> Confirmé en campo la ubicación de la última inspección.
      </label>}
      <button type="submit" disabled={saving} className={`${primary} self-end`}>Guardar</button>
    </form>
  );
}
