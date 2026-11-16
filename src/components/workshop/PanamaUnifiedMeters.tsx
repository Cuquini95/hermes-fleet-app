import { useRef, useState, type FormEvent } from 'react';
import { mexicoDateInput, mexicoTimeInput } from '../../lib/date-utils';

type Measure = 'h' | 'km';
type MeterOrigin = 'telematics' | 'manual' | 'register';
interface Reading {
  origin: MeterOrigin;
  source: string;
  measure: Measure;
  value: number;
  measuredAt?: string;
  date?: string;
  kind?: 'inicio' | 'final' | 'cambio';
  shift?: string;
  reference?: string;
  freshness: 'current' | 'stale' | 'manual' | 'register';
  originalMeasure?: 'h' | 'min' | 'km' | 'mi';
  originalValue?: number;
}

interface Stream {
  measure: Measure;
  primary: MeterOrigin | null;
  automaticConfigured: boolean;
  registerAmbiguous: boolean;
  automatic: Reading | null;
  manual: Reading | null;
  register: Reading | null;
}

export interface UnifiedMeters {
  status: 'available' | 'unavailable' | 'not_configured';
  capturedAt: string | null;
  conflicts: number;
  period: string;
  streams: Stream[];
  readings: Reading[];
  totalReadings: number;
  canCaptureDistance: boolean;
  manualHoursAvailable: boolean;
  manualDistanceAvailable: boolean | null;
}

const numbers = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 3 });
const panamaDate = new Intl.DateTimeFormat('es-PA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Panama' });
const formatTime = (iso: string) => panamaDate.format(new Date(iso));
const statusText = {
  current: 'Vigente',
  stale: 'Vencida',
  manual: 'Respaldo manual',
  register: 'Maestro oficial',
};
const kindText = { inicio: 'Inicio', final: 'Final', cambio: 'Cambio de medidor' };
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border p-2 text-base text-text';
const emptyForm = () => ({ date: mexicoDateInput(), time: mexicoTimeInput(), value: '', reference: '' });

function ReadingCard({ reading, showStatus = true }: { reading: Reading; showStatus?: boolean }) {
  return <div className="min-w-0 break-words text-sm">
    <p><strong>{numbers.format(reading.value)} {reading.measure}</strong> · {reading.source}{showStatus ? ' · ' + statusText[reading.freshness] : ''}</p>
    <p className="text-text-secondary">{reading.measuredAt ? formatTime(reading.measuredAt) : reading.date}
      {reading.shift ? ' · ' + reading.shift : ''}{reading.kind ? ' · ' + kindText[reading.kind] : ''}
      {reading.reference ? ' · ' + reading.reference : ''}</p>
    {reading.originalMeasure && reading.originalMeasure !== reading.measure && reading.originalValue !== undefined
      && <p className="text-text-secondary">Lectura de origen {numbers.format(reading.originalValue)} {reading.originalMeasure}</p>}
  </div>;
}

function DistanceCapture({ endpoint, unit, actorId, onSaved }: {
  endpoint: string; unit: string; actorId: string; onSaved: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    const payload = JSON.stringify(form);
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ ...form, action: 'odometer', unit, mutationId: attempt.current.id, expectedUserId: actorId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo confirmar la lectura. Reintenta con los mismos datos.');
      setVisible(false);
      setForm(emptyForm());
      setMessage('Lectura en km registrada.');
      attempt.current = null;
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar la lectura.');
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  return <div className="space-y-2">
    {visible
      ? <form aria-label="Respaldo manual del odómetro" onSubmit={save}>
        <fieldset disabled={saving} className="grid min-w-0 gap-2 sm:grid-cols-2">
          <label className="min-w-0">Fecha<input required type="date" max={mexicoDateInput()} className={field} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label className="min-w-0">Hora en Panamá<input required type="time" className={field} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></label>
          <label className="min-w-0">Lectura (km)<input required type="number" inputMode="decimal" min="0" max="99999999.999" step="0.001" className={field} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></label>
          <label className="min-w-0">Referencia del respaldo<input required maxLength={160} className={field} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label>
          <button type="button" className="min-h-11 rounded-lg border border-border px-3" onClick={() => { setVisible(false); setError(''); }}>Cancelar lectura</button>
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-3 font-semibold text-white">{saving ? 'Guardando…' : 'Guardar lectura en km'}</button>
        </fieldset>
      </form>
      : <button type="button" className="min-h-11 rounded-lg border border-border px-3 font-semibold" onClick={() => { setVisible(true); setMessage(''); }}>Registrar lectura en km</button>}
    {message && <p role="status" className="font-medium text-success">{message}</p>}
    {error && <p role="alert" className="text-critical">{error}</p>}
  </div>;
}

export default function PanamaUnifiedMeters({ data, endpoint, unit, actorId, period, onPeriod, onSaved }: {
  data: UnifiedMeters; endpoint: string; unit: string; actorId: string; period: string; onPeriod: (value: string) => void; onSaved: () => void;
}) {
  return <section aria-label="Lecturas por origen" className="min-w-0 space-y-2 border-t border-border pt-3">
    <h3 className="font-semibold">Lecturas por origen</h3>
    {data.status === 'not_configured' && <p className="text-text-secondary">Telemática sin fuente autorizada para esta unidad.</p>}
    {data.status === 'unavailable' && <p className="text-text-secondary">Corte telemático no disponible.</p>}
    {data.capturedAt && <p className="break-words text-text-secondary">Corte telemático {formatTime(data.capturedAt)} Panamá</p>}
    {data.conflicts > 0 && <p className="text-text-secondary">Hay lecturas de la fuente pendientes de conciliación.</p>}
    {!data.manualHoursAvailable && <p className="text-text-secondary">Registro manual en horas no disponible.</p>}
    {data.manualDistanceAvailable === false && <p className="text-text-secondary">Registro manual en kilómetros no disponible.</p>}
    {data.streams.map(({ measure, automatic, manual, register, primary, automaticConfigured, registerAmbiguous }) => {
      const main = primary === 'telematics' ? automatic : primary === 'manual' ? manual : primary === 'register' ? register : null;
      return <div key={measure} className="min-w-0 space-y-1 rounded-lg bg-surface p-2">
        <p className="font-medium">{measure === 'h' ? 'Horas de uso' : 'Kilómetros'}</p>
        {main ? <ReadingCard reading={main} /> : <p className="text-text-secondary">Sin lectura vigente ni respaldo.</p>}
        {automatic && main !== automatic && <ReadingCard reading={automatic} />}
        {automaticConfigured && data.status === 'available' && !automatic && <p className="text-text-secondary">Sin lectura telemática para esta medida.</p>}
        {registerAmbiguous && !primary && <p className="text-text-secondary">REGISTRO muestra varias lecturas finales sin hora de medición. Revisa el turno.</p>}
        {manual && main !== manual && <ReadingCard reading={manual} />}
      </div>;
    })}
    {data.canCaptureDistance && <DistanceCapture endpoint={endpoint} unit={unit} actorId={actorId} onSaved={onSaved} />}
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center underline">Ver historial por período</summary>
      <label className="mb-2 block min-w-0">Período
        <input type="month" value={period || data.period} max={mexicoDateInput().slice(0, 7)} onChange={e => onPeriod(e.target.value)} className={field} />
      </label>
      {data.period !== period && period ? <p role="status">Consultando período…</p> : <>
        {!data.readings.length && <p className="text-text-secondary">Sin lecturas en este período.</p>}
        {data.totalReadings > data.readings.length && <p className="text-text-secondary">Últimas {data.readings.length} de {data.totalReadings} lecturas.</p>}
        <ul className="space-y-1">{data.readings.map((reading, index) =>
          <li className="border-t border-border py-1.5" key={reading.source + ':' + (reading.measuredAt ?? reading.date) + ':' + index}>
            <ReadingCard reading={reading} showStatus={false} />
          </li>)}</ul>
      </>}
    </details>
  </section>;
}
