import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { requestWorkshop } from '../lib/workshop-api';
import { useAuthStore } from '../stores/auth-store';

interface StopInterval {
  id: string;
  unit: string;
  startedAt: string;
  endedAt: string | null;
  seconds: number;
  orders: { id: string; folio: string; cause: string; source: 'Taller' | 'Reporte' }[];
  segments: { date: string; shift: string; from: string; seconds: number }[];
}

interface DowntimeReport {
  from: string;
  through: string;
  checkedAt: string;
  seconds: number;
  intervals: StopInterval[];
  pending: { unit: string; folio: string; date: string | null; reason: string }[];
  shiftStarts: { day: string; night: string } | null;
  masterAvailable: boolean;
}

const timeZone = 'America/Panama';
const dateInput = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const timestamp = new Intl.DateTimeFormat('es-PA', { timeZone, dateStyle: 'short', timeStyle: 'short' });
const dateLabel = new Intl.DateTimeFormat('es-PA', { timeZone, day: 'numeric', month: 'short' });
const displayTime = (value: string) => timestamp.format(new Date(value));
const displayDate = (date: string) => dateLabel.format(new Date(`${date}T12:00:00-05:00`));

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes < 1 && seconds > 0 ? '<1 min' : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const inputClass = 'min-h-11 min-w-0 w-full rounded-lg border border-border bg-white px-2 text-sm text-text';

export default function PanamaDowntimePage() {
  const project = useAuthStore(state => state.project);
  const userId = useAuthStore(state => state.userId);
  return project === 'tmf-panama' ? <DowntimeView key={userId} /> : <Navigate to="/workorders" replace />;
}

function DowntimeView() {
  const today = dateInput.format(new Date());
  const [filters, setFilters] = useState(() => ({
    from: dateInput.format(new Date(Date.now() - 6 * 86_400_000)), through: today, unit: '',
  }));
  const [criteria, setCriteria] = useState(filters);
  const [data, setData] = useState<DowntimeReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ from: criteria.from, through: criteria.through });
    if (criteria.unit) query.set('unit', criteria.unit);
    void requestWorkshop<DowntimeReport>(`downtime?${query}`).then(result => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo consultar el tiempo caído.');
    });
    return () => { active = false; };
  }, [criteria]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setData(null);
    setError('');
    setCriteria({ ...filters, unit: filters.unit.trim().toUpperCase() });
  }

  return (
    <div className="space-y-4 py-4 text-text">
      <h1 className="text-xl font-bold">Tiempo caído por avería</h1>
      <form onSubmit={applyFilters} className="grid min-w-0 grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3">
        <label className="min-w-0 space-y-1 text-sm font-medium">Desde
          <input type="date" className={inputClass} value={filters.from} max={filters.through || today} required
            onChange={event => setFilters({ ...filters, from: event.target.value })} />
        </label>
        <label className="min-w-0 space-y-1 text-sm font-medium">Hasta
          <input type="date" className={inputClass} value={filters.through} min={filters.from} max={today} required
            onChange={event => setFilters({ ...filters, through: event.target.value })} />
        </label>
        <label className="min-w-0 space-y-1 text-sm font-medium">Unidad
          <input className={inputClass} value={filters.unit} placeholder="Todas" maxLength={24}
            onChange={event => setFilters({ ...filters, unit: event.target.value })} />
        </label>
        <button type="submit" className="min-h-11 self-end rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white">Consultar</button>
      </form>
      {error ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>
        : !data && <p role="status" className="text-sm text-text-secondary">Consultando paradas…</p>}
      {data && (
        <>
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Resumen de tiempo caído">
            <p className="text-2xl font-bold">{duration(data.seconds)}</p>
            <p className="mt-1 text-sm text-text-secondary">{data.intervals.length} {data.intervals.length === 1 ? 'parada medida' : 'paradas medidas'} · Hora de Panamá</p>
            <p className="mt-1 text-xs text-text-secondary">{data.from === data.through ? displayDate(data.from) : `${displayDate(data.from)} al ${displayDate(data.through)}`} · Consultado el {displayTime(data.checkedAt)}</p>
            {!data.shiftStarts && <p className="mt-2 text-sm text-text-secondary">Horario de turnos por confirmar.</p>}
            {!data.masterAvailable && <p className="mt-2 text-sm text-amber-900">Maestro de Taller sin consulta. Se muestran las paradas registradas en Hermes.</p>}
          </section>
          {data.intervals.map(interval => (
            <article key={`${interval.unit}:${interval.id}`} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold">{interval.unit}</h2>
                <strong>{duration(interval.seconds)}</strong>
              </div>
              <p className="text-sm text-text-secondary">{displayTime(interval.startedAt)} · {interval.endedAt ? displayTime(interval.endedAt) : 'Parada abierta'}</p>
              {interval.segments.length > 0 && <ul className="space-y-1 text-sm" aria-label="Horas por turno">
                {interval.segments.map(segment => <li key={segment.from} className="flex flex-wrap justify-between gap-x-2">
                  <span>{segment.shift} · {displayDate(segment.date)}</span>
                  <span>{duration(segment.seconds)}</span>
                </li>)}
              </ul>}
              <ul className="space-y-1 border-t border-border pt-2 text-sm" aria-label="Órdenes de la parada">
                {interval.orders.map(order => <li key={order.id} className="break-words">
                  <Link className="font-semibold text-blue-800 underline" to={`/workorders/${encodeURIComponent(order.folio)}`}>{order.folio}</Link>
                  <span className="ml-2 text-text-secondary">{order.source === 'Taller' ? 'Diagnóstico' : 'Reporte'} · {order.cause}</span>
                </li>)}
              </ul>
            </article>
          ))}
          {data.pending.length > 0 && (
            <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" aria-label="Paradas pendientes de confirmar">
              <h2 className="font-semibold">Pendientes de confirmar · {data.pending.length}</h2>
              <ul className="space-y-2">
                {data.pending.map(({ unit, folio, date, reason }, index) => <li key={`${unit}:${folio}:${index}`} className="break-words">
                  <strong>{unit}{folio && ` · ${folio}`}</strong>
                  {date && <span className="ml-2">{displayDate(date)}</span>}
                  <p className="text-text-secondary">{reason}</p>
                </li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
