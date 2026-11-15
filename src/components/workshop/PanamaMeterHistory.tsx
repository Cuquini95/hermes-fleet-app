import { useEffect, useRef, useState, type FormEvent } from 'react';
import { mexicoDateInput, mexicoTimeInput } from '../../lib/date-utils';

interface MeterEntry {
  date: string;
  time: string;
  kind: 'inicio' | 'final' | 'cambio';
  rawHours: number;
  totalHours: number;
  previousHours?: number;
  reference?: string;
  reconciliation: 'match' | 'review' | 'pending' | 'unavailable' | null;
  officialReference?: string;
}

interface MeterHistory {
  history: MeterEntry[];
  official: { available: boolean; capturedAt?: string; shifts: {
    date: string; shift: string; reference: string; start: number; end: number;
  }[] };
  canReplace: boolean;
}

const reconciliationLabel = {
  match: 'Coincide con REGISTRO para la fecha del parte',
  review: 'Revisar contra REGISTRO',
  pending: 'Sin coincidencia en el corte de REGISTRO',
  unavailable: 'REGISTRO no disponible para conciliar',
};
const displayHours = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 3 });
const cutFormat = new Intl.DateTimeFormat('es-PA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Panama' });
const field = 'mt-1 min-h-11 w-full rounded-lg border border-border p-2 text-base text-text';
const emptyForm = () => ({ date: mexicoDateInput(), time: mexicoTimeInput(), previousHours: '', newHours: '', reference: '' });

export default function PanamaMeterHistory({ unit, actorId, refresh }: { unit: string; actorId: string; refresh: number }) {
  const [data, setData] = useState<MeterHistory | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const endpoint = '/hermes-api/api/panama/horometros';

  useEffect(() => {
    const abort = new AbortController();
    void fetch(`${endpoint}?${new URLSearchParams({ unit })}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result) throw new Error(result?.error || 'No se pudo cargar el historial.');
        if (!abort.signal.aborted) { setData(result); setLoadError(''); }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) { setData(null); setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar el historial.'); }
      });
    return () => abort.abort();
  }, [unit, refresh, revision]);

  async function replace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    setSaved('');
    const payload = JSON.stringify(form);
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ unit, expectedUserId: actorId, mutationId: attempt.current.id, ...form }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo confirmar el cambio de medidor. Reintenta con los mismos datos.');
      setSaved(`Cambio registrado. Horas acumuladas: ${displayHours.format(result.totalHours)} h.`);
      setOpen(false);
      setForm(emptyForm());
      attempt.current = null;
      setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el cambio.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const current = data?.history[0];
  const official = data?.official;
  const cut = official?.capturedAt ? new Date(official.capturedAt) : null;
  const lastOfficial = official?.shifts[0]?.date;
  const shifts = official?.shifts.filter(row => row.date === lastOfficial) ?? [];
  return (
    <section aria-label="Historial de horómetro" className="mb-4 space-y-3 rounded-xl border border-border bg-white p-4 text-sm">
      <h2 className="font-semibold">Historial de horómetro</h2>
      {!data && !loadError && <p role="status">Cargando lecturas…</p>}
      {loadError && <div role="alert">{loadError} <button type="button" className="min-h-11 underline" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
      {data && <>
        {current
          ? <p><strong>{displayHours.format(current.totalHours)} h acumuladas</strong> · Hermes · {current.date} {current.time}</p>
          : <p>Sin lecturas registradas en Hermes.</p>}
        <div className="rounded-lg bg-surface p-2">
          <p className="font-medium">REGISTRO TMF{cut && Number.isFinite(+cut) ? ` · Corte ${cutFormat.format(cut)} Panamá` : ''}</p>
          {!official?.available && <p>Fuente no disponible.</p>}
          {official?.available && !shifts.length && <p>Sin lecturas de esta unidad en el corte.</p>}
          {shifts.map((row, index) => <p key={`${row.reference}-${index}`} className="break-words">
            {row.date} · {row.shift} · {displayHours.format(row.start)} → {displayHours.format(row.end)} h · {row.reference}
          </p>)}
        </div>
        {!!data.history.length && <details>
          <summary className="flex min-h-11 cursor-pointer items-center underline">Ver lecturas y cambios</summary>
          <ul className="space-y-1">
            {data.history.map((row, index) => <li key={`${row.date}-${row.time}-${index}`} className="break-words border-t border-border py-1.5">
              <p>{row.date} {row.time} · Hermes · {row.kind === 'cambio' ? 'Cambio de medidor' : row.kind === 'inicio' ? 'Inicio' : 'Final'}</p>
              <p>{row.kind === 'cambio' ? `${displayHours.format(row.previousHours ?? 0)} → ` : ''}{displayHours.format(row.rawHours)} h en medidor · {displayHours.format(row.totalHours)} h acumuladas</p>
              {row.reference && <p>{row.reference}</p>}
              {row.reconciliation && <p className="text-text-secondary">{reconciliationLabel[row.reconciliation]}{row.officialReference ? ` · ${row.officialReference}` : ''}</p>}
            </li>)}
          </ul>
        </details>}
        {data.canReplace && !open && <button type="button" className="min-h-11 rounded-lg border border-border px-3 font-semibold" onClick={() => setOpen(true)}>Registrar cambio de medidor</button>}
      </>}
      {open && <form onSubmit={replace}>
        <fieldset disabled={saving} className="grid min-w-0 grid-cols-2 gap-2">
          <label>Fecha del cambio<input required type="date" className={field} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label>Hora en Panamá<input required type="time" className={field} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></label>
          <label>Lectura final anterior<input required type="number" min="0" max="99999999" step="0.001" className={field} value={form.previousHours} onChange={e => setForm({ ...form, previousHours: e.target.value })} /></label>
          <label>Lectura inicial nueva<input required type="number" min="0" max="99999999" step="0.001" className={field} value={form.newHours} onChange={e => setForm({ ...form, newHours: e.target.value })} /></label>
          <label className="col-span-2">Referencia de Taller<input required maxLength={160} className={field} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label>
          <button type="button" className="min-h-11 rounded-lg border border-border" onClick={() => { setOpen(false); setError(''); }}>Cancelar</button>
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-2 font-semibold text-white">{saving ? 'Guardando…' : 'Confirmar cambio'}</button>
        </fieldset>
      </form>}
      {saved && <p role="status" className="font-medium text-success">{saved}</p>}
      {error && <p role="alert" className="text-critical">{error}</p>}
    </section>
  );
}
