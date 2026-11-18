import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { requestWorkshop } from '../lib/workshop-api';
import { downloadBlob } from '../lib/download-blob';
import { maintenanceMetricsCsv, MTTR_EXCLUSION_LABELS, type DowntimeReport, type MaintenancePhaseTime } from '../lib/panama-maintenance-metrics';
import { useAuthStore } from '../stores/auth-store';

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
const actionClass = 'min-h-11 min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold';
const summaryClass = 'min-h-11 cursor-pointer py-3 text-sm font-semibold';

function PhaseList({ rows }: { rows: MaintenancePhaseTime[] }) {
  return <dl className="space-y-2 text-sm">{rows.map(row => (
    <div key={row.key} className={`flex flex-wrap justify-between gap-x-3 gap-y-1 ${['unknown', 'mixed'].includes(row.key) ? 'text-amber-900' : ''}`}>
      <dt className="min-w-0 break-words">{row.label}</dt><dd className="font-semibold tabular-nums">{duration(row.seconds)}</dd>
    </div>
  ))}</dl>;
}

export default function PanamaDowntimePage() {
  const project = useAuthStore(state => state.project);
  const scope = useAuthStore(state => JSON.stringify([state.userId, state.project, state.role, state.unitScope, state.assignedUnits]));
  return project === 'tmf-panama' ? <DowntimeView key={scope} /> : <Navigate to="/workorders" replace />;
}

function DowntimeView() {
  const today = dateInput.format(new Date());
  const [filters, setFilters] = useState(() => ({ from: dateInput.format(new Date(Date.now() - 6 * 86_400_000)), through: today, unit: '' }));
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
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron consultar los tiempos de mantenimiento.');
    });
    return () => { active = false; };
  }, [criteria]);

  function apply(next = filters) {
    setData(null); setError('');
    setCriteria({ ...next, unit: next.unit.trim().toUpperCase() });
  }
  function applyFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply(); }
  function preset(days: number) {
    const next = { ...filters, from: dateInput.format(new Date(Date.now() - (days - 1) * 86_400_000)), through: today };
    setFilters(next); apply(next);
  }

  return <div className="min-w-0 space-y-4 py-4 text-text">
    <div><h1 className="text-lg font-bold sm:text-xl">Tiempos de mantenimiento</h1>
      <p className="mt-1 text-sm text-text-secondary">Paradas confirmadas y espera de repuestos.</p></div>
    <form onSubmit={applyFilters} className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3 rounded-xl border border-border bg-card p-3">
      <div className="col-span-full flex flex-wrap gap-2" aria-label="Períodos rápidos">
        {[[1, 'Hoy'], [7, '7 días'], [15, '15 días']].map(([days, label]) => <button key={days} type="button" className={actionClass}
          onClick={() => preset(Number(days))}>{label}</button>)}
      </div>
      <label className="min-w-0 space-y-1 text-sm font-medium">Desde
        <input type="date" className={inputClass} value={filters.from} max={filters.through || today} required onChange={event => setFilters({ ...filters, from: event.target.value })} />
      </label>
      <label className="min-w-0 space-y-1 text-sm font-medium">Hasta
        <input type="date" className={inputClass} value={filters.through} min={filters.from} max={today} required onChange={event => setFilters({ ...filters, through: event.target.value })} />
      </label>
      <label className="min-w-0 space-y-1 text-sm font-medium">Unidad
        <input className={inputClass} value={filters.unit} placeholder="Todas" maxLength={24} autoCapitalize="characters" onChange={event => setFilters({ ...filters, unit: event.target.value })} />
      </label>
      <button type="submit" className="min-h-11 self-end rounded-lg bg-[#162252] px-3 py-2 text-sm font-semibold text-white">Consultar</button>
    </form>
    {error ? <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>{error}</p>
      <button className={actionClass} onClick={() => apply(criteria)}>Reintentar consulta</button></div>
      : !data && <p role="status" className="text-sm text-text-secondary">Consultando tiempos…</p>}
    {data && <>
      <section className="space-y-2 rounded-xl border border-border bg-card p-4" aria-label="Resumen de tiempo caído">
        <h2 className="text-sm font-semibold">Tiempo caído medido</h2>
        <p className="break-words text-2xl font-bold">{data.metrics.measuredSeconds === null ? 'Sin intervalos verificados' : duration(data.metrics.measuredSeconds)}</p>
        <p className="text-sm text-text-secondary">{data.intervals.length} {data.intervals.length === 1 ? 'parada medida' : 'paradas medidas'} · {criteria.unit || 'Equipos autorizados'}</p>
        <p className="text-xs text-text-secondary">{data.from === data.through ? displayDate(data.from) : `${displayDate(data.from)} al ${displayDate(data.through)}`} · Hora de Panamá</p>
        <p className="text-xs text-text-secondary">Consultado el {displayTime(data.checkedAt)}</p>
        {data.pending.length > 0 && <p className="text-sm text-amber-900">{data.pending.length} {data.pending.length === 1 ? 'parada sin intervalo confirmado' : 'paradas sin intervalo confirmado'}. El total medido es parcial.</p>}
        {!data.masterAvailable && <p className="text-sm text-amber-900">Maestro de Taller sin consulta. Se muestran los registros de Hermes.</p>}
        <button className={actionClass} onClick={() => downloadBlob(new Blob([maintenanceMetricsCsv(data, criteria.unit)], { type: 'text/csv;charset=utf-8' }),
          `tiempos-mantenimiento-${data.from}-${data.through}.csv`)}>Descargar detalle CSV</button>
      </section>
      {data.metrics.measuredSeconds !== null && <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Tiempo por estado">
        <h2 className="font-bold">¿Dónde se va el tiempo?</h2>
        <PhaseList rows={data.metrics.breakdown} />
        <p className="border-t border-border pt-3 text-sm text-text-secondary">Estados verificados: {data.metrics.coverage.percent?.toLocaleString('es-PA', { maximumFractionDigits: 1 }) ?? 'Sin dato'}% del tiempo medido.</p>
        <p className="text-xs text-text-secondary">Horas calendario en el estado registrado. No equivalen a horas trabajadas por el mecánico. Las OT superpuestas del mismo equipo se cuentan una vez.</p>
      </section>}
      <section className="space-y-2 rounded-xl border border-border bg-card p-4" aria-label="MTTR registrado">
        <h2 className="text-sm font-semibold">Tiempo medio hasta el retorno · MTTR</h2>
        <p className="text-2xl font-bold">{data.metrics.mttr.seconds === null ? 'Sin retornos elegibles' : duration(data.metrics.mttr.seconds)}</p>
        <p className="text-sm text-text-secondary">{data.metrics.mttr.denominator} {data.metrics.mttr.denominator === 1 ? 'parada correctiva con retorno aceptado' : 'paradas correctivas con retorno aceptado'} en el período.</p>
        <p className="text-xs text-text-secondary">Muestra registrada; incluye esperas. No representa toda la flota.</p>
        <details className="border-t border-border"><summary className={summaryClass}>Ver cálculo y exclusiones</summary>
          <div className="space-y-3 text-sm">
            <p>{data.metrics.mttr.basis}</p>
            <p>Duración acumulada completa: {duration(data.metrics.mttr.numeratorSeconds)}. Dividida entre {data.metrics.mttr.denominator} paradas elegibles.</p>
            <ul className="space-y-2">{data.metrics.mttr.cohort.map((row, index) => <li key={index} className="break-words"><strong>{row.unit} · {duration(row.seconds)}</strong>
              <p>{row.folios.join(' / ')}</p><p className="text-xs text-text-secondary">{displayTime(row.startedAt)} a {displayTime(row.endedAt)}</p></li>)}</ul>
            <dl className="space-y-1">{Object.entries(data.metrics.mttr.exclusions).map(([reason, count]) => <div key={reason} className="flex flex-wrap justify-between gap-x-2">
              <dt>{MTTR_EXCLUSION_LABELS[reason as keyof typeof MTTR_EXCLUSION_LABELS]}</dt><dd>{count}</dd></div>)}</dl>
            <p className="text-xs text-text-secondary">Exclusiones de las paradas que tocan el período. Los intervalos sin confirmar no entran al cálculo: {data.metrics.mttr.pendingStops}.</p>
          </div>
        </details>
      </section>
      {data.pending.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm" aria-label="Paradas pendientes de confirmar">
        <details><summary className={summaryClass}>Ver equipos pendientes ({data.pending.length})</summary><ul className="space-y-3 pb-3">
          {data.pending.map(({ unit, folio, date, reason }, index) => <li key={`${unit}:${folio}:${index}`} className="break-words"><strong>{unit}{folio && ` · ${folio}`}</strong>
            {date && <span className="ml-2">{displayDate(date)}</span>}<p className="text-text-secondary">{reason}</p></li>)}
        </ul></details>
      </section>}
      {data.metrics.issues.length > 0 && <details className="rounded-xl border border-border bg-card px-3"><summary className={summaryClass}>Historial por revisar ({data.metrics.issues.length})</summary>
        <ul className="space-y-2 pb-3 text-sm">{data.metrics.issues.map((issue, index) => <li key={index} className="break-words"><strong>{issue.unit} · {issue.folio}</strong><p>{issue.reason}</p></li>)}</ul>
      </details>}
      {data.intervals.map(interval => {
        const detail = data.metrics.details.find(row => row.unit === interval.unit && row.id === interval.id);
        return <article key={`${interval.unit}:${interval.id}`} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-bold">{interval.unit}</h2><strong>{duration(interval.seconds)}</strong></div>
          <p className="text-sm text-text-secondary">{displayTime(interval.startedAt)} · {interval.endedAt ? displayTime(interval.endedAt) : 'Parada abierta'}</p>
          {detail && <details><summary className={summaryClass}>Ver estados de esta parada</summary><PhaseList rows={data.metrics.breakdown.map(row => ({ ...row, seconds: detail.phases[row.key] }))} /></details>}
          {interval.segments.length > 0 ? <ul className="space-y-1 text-sm" aria-label="Horas por turno">{interval.segments.map(segment => <li key={segment.from} className="flex flex-wrap justify-between gap-x-2">
            <span>{segment.shift} · {displayDate(segment.date)}</span><span>{duration(segment.seconds)}</span></li>)}</ul>
            : <p className="text-xs text-text-secondary">Horario de turnos por confirmar.</p>}
          <ul className="space-y-1 border-t border-border pt-2 text-sm" aria-label="Órdenes de la parada">{interval.orders.map(order => <li key={order.id} className="break-words">
            <Link className="font-semibold text-blue-800 underline" to={`/workorders/${encodeURIComponent(order.folio)}`}>{order.folio}</Link>
            <span className="ml-2 text-text-secondary">{order.source === 'Taller' ? 'Diagnóstico' : 'Reporte'} · {order.cause}</span></li>)}</ul>
        </article>;
      })}
    </>}
  </div>;
}
