import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { SkeletonList } from '../components/ui/Skeleton';
import { PANAMA_PM_MASTER_URL, PANAMA_PM_REGISTER_URL, fetchPanamaMaintenance, type MaintenanceEntry, type PanamaMaintenance } from '../lib/panama-maintenance';
import LegacyPMSchedulePage from './LegacyPMSchedulePage';

const states = {
  overdue: { label: 'Vencido', cls: 'border-l-critical' },
  upcoming: { label: 'Próximo', cls: 'border-l-amber' },
  ok: { label: 'Al día', cls: 'border-l-success' },
  unknown: { label: 'Requiere verificación', cls: 'border-l-gray-400' },
};

function meter(value: number | null) {
  return value === null ? 'Sin dato' : `${value.toLocaleString('es-PA')} h`;
}

function MaintenanceCard({ entry, canSchedule }: { entry: MaintenanceEntry; canSchedule: boolean }) {
  const state = states[entry.state];
  return (
    <article className={`min-w-0 rounded-xl border border-border border-l-4 ${state.cls} bg-white p-4`}>
      <h2 className="break-words font-bold text-text">{entry.unit} · {entry.model || 'Modelo por verificar'}</h2>
      <p className="mt-1 text-sm font-semibold text-text">{entry.sourceStatus || state.label}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div><dt className="text-text-secondary">Nivel oficial</dt><dd>{entry.level || 'Sin dato'}</dd></div>
        <div><dt className="text-text-secondary">Vencimiento oficial</dt><dd>{meter(entry.dueAt)}</dd></div>
        <div><dt className="text-text-secondary">Horómetro oficial</dt><dd>{meter(entry.currentHours)}</dd></div>
        <div><dt className="text-text-secondary">Horas restantes</dt><dd>{meter(entry.remaining)}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-text-secondary">Lectura: {entry.reading || 'sin dato'} · Plan: {entry.plan || 'sin dato'}</p>
      {entry.lastOfficial && <p className="mt-1 text-xs text-text-secondary">Último PM en el maestro: {entry.lastOfficial}</p>}
      {entry.reconciliationPending && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-text">
          <p>El cierre aceptado en Hermes aún está pendiente de conciliación con PM FLOTA.</p>
          {entry.projectedNext && <p className="mt-1 font-semibold">
            Próximo estimado con el plan aprobado: {entry.projectedNext.level} a {meter(entry.projectedNext.dueAt)}.
          </p>}
          {PANAMA_PM_REGISTER_URL && <a href={PANAMA_PM_REGISTER_URL} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center font-semibold underline">
            Conciliar en ANOTAR PM
          </a>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 text-sm font-semibold">
        {entry.checklistUrl && <a href={entry.checklistUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">Checklist del equipo</a>}
        {canSchedule && entry.level && <Link
          to={`/pm-order?${new URLSearchParams({ unidad: entry.unit, nivel: entry.level })}`}
          className="inline-flex min-h-11 items-center text-amber"
        >
          Orden PM para {entry.unit}
        </Link>}
      </div>
    </article>
  );
}

function PanamaPMSchedule({ userId, canSchedule }: { userId?: string; canSchedule: boolean }) {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<PanamaMaintenance | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPanamaMaintenance(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setData({ entries: null, components: null, componentSourcesAvailable: false, historyAvailable: false, acceptedHistory: [] }); });
    return () => controller.abort();
  }, [refresh, userId]);

  function reload() {
    setData(null);
    setRefresh(value => value + 1);
  }

  return (
    <div className="flex flex-col pb-4">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" aria-label="Volver" onClick={() => navigate(-1)} className="rounded-xl border border-border bg-white p-3"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-xl font-bold text-text">Programa de Mantenimiento</h1>
        <button type="button" aria-label="Actualizar programa PM" onClick={reload} disabled={data === null} className="rounded-xl border border-border bg-white p-3">
          <RefreshCw size={18} className={data === null ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="mb-3 text-sm text-text-secondary">
        Vencimientos y estados del maestro {PANAMA_PM_MASTER_URL
          ? <a href={PANAMA_PM_MASTER_URL} target="_blank" rel="noreferrer" className="font-semibold underline">PM FLOTA</a>
          : <strong>PM FLOTA</strong>}.
      </p>
      {data?.sourceDate && <p className="mb-3 text-xs text-text-secondary">
        Corte del {new Date(data.sourceDate).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })} · Panamá
      </p>}
      {canSchedule && <Link to="/pm-order" className="mb-4 inline-flex min-h-11 items-center rounded-xl bg-amber px-4 text-sm font-semibold text-white">Nueva Orden PM</Link>}
      {data === null && <SkeletonList count={4} />}
      {data?.entries === null && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-text">
        PM FLOTA no disponible. No se pudo verificar qué equipos están vencidos. Consulta el maestro y actualiza.
      </p>}
      {data?.entries?.length === 0 && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-text">PM FLOTA no devolvió equipos en tu alcance. Confirma la cobertura del maestro.</p>}
      {data?.entries && <div className="grid gap-3 sm:grid-cols-2">
        {[...data.entries].sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity)).map(entry => <MaintenanceCard key={entry.unit} entry={entry} canSchedule={canSchedule} />)}
      </div>}
      {data && (
        <section className="mt-5 rounded-xl border border-border bg-white p-4">
          <h2 className="font-bold text-text">Último cierre aceptado por equipo en Hermes</h2>
          {!data.historyAvailable
            ? <p role="alert" className="mt-2 text-sm text-text-secondary">No se pudo consultar el historial aceptado.</p>
            : data.acceptedHistory.length === 0
              ? <p className="mt-2 text-sm text-text-secondary">El historial no devolvió cierres con aceptación y checklist acreditados.</p>
              : <ul className="mt-2 divide-y divide-border text-sm">
                {data.acceptedHistory.map(row => <li key={row.folio} className="py-2">
                  <Link to={`/workorders/${encodeURIComponent(row.folio)}`} className="font-semibold underline">{row.folio}</Link>
                  <span> · {row.unit} · {row.level} · {meter(row.meter)} · {row.performedOn}</span>
                  <p className="text-text-secondary">{row.reference} · Revisión: {row.reviewer || 'Responsable identificado'}</p>
                </li>)}
              </ul>}
        </section>
      )}
    </div>
  );
}

export default function PMSchedulePage() {
  const { project, role, userId } = useAuthStore();
  const canSchedule = role === 'jefe_taller' || role === 'coordinador' || role === 'gerencia';
  return project === 'tmf-panama' ? <PanamaPMSchedule key={userId} userId={userId} canSchedule={canSchedule} /> : <LegacyPMSchedulePage />;
}
