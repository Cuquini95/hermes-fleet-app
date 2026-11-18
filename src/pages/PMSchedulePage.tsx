import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { SkeletonList } from '../components/ui/Skeleton';
import PanamaPmBatch from '../components/workshop/PanamaPmBatch';
import PanamaPmNextService from '../components/workshop/PanamaPmNextService';
import PanamaPmChecklistPdf from '../components/workshop/PanamaPmChecklistPdf';
import { PANAMA_PM_MASTER_URL, PANAMA_PM_REGISTER_URL, fetchPanamaMaintenance, type MaintenanceEntry, type PanamaMaintenance } from '../lib/panama-maintenance';
import LegacyPMSchedulePage from './LegacyPMSchedulePage';

const states = {
  overdue: { label: 'Vencido', cls: 'border-l-critical' },
  upcoming: { label: 'Por vencer', cls: 'border-l-amber' },
  ok: { label: 'Al día', cls: 'border-l-success' },
  unknown: { label: 'Por verificar', cls: 'border-l-gray-400' },
};

function meter(value: number | null) {
  return value === null ? 'Sin dato' : `${value.toLocaleString('es-PA')} h`;
}

function MaintenanceCard({ entry, canSchedule }: { entry: MaintenanceEntry; canSchedule: boolean }) {
  const state = states[entry.state];
  return (
    <article className={`min-w-0 rounded-xl border border-border border-l-4 ${state.cls} bg-white p-4`}>
      <h2 className="break-words font-bold text-text">{entry.unit}{entry.model && ` · ${entry.model}`}</h2>
      <p className="mt-1 text-sm font-semibold text-text">{state.label}</p>
      {entry.planApproval !== 'approved' && <p className="mt-1 text-xs text-amber-800">
        {entry.planApproval === 'unavailable' ? 'Plan no disponible' : 'Plan por aprobar'}
      </p>}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div><dt className="text-text-secondary">Nivel</dt><dd>{entry.level || 'Sin dato'}</dd></div>
        <div><dt className="text-text-secondary">Vence a</dt><dd>{meter(entry.dueAt)}</dd></div>
        <div><dt className="text-text-secondary">Horómetro</dt><dd>{meter(entry.currentHours)}</dd></div>
        <div><dt className="text-text-secondary">{entry.remaining !== null && entry.remaining < 0 ? 'Atraso' : 'Horas restantes'}</dt>
          <dd>{meter(entry.remaining === null ? null : Math.abs(entry.remaining))}</dd></div>
      </dl>
      {entry.reconciliationPending && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-text">
          <p>Cierre por conciliar con PM FLOTA.</p>
          {entry.projectedNext && <p className="mt-1 font-semibold">
            Próximo estimado · {entry.projectedNext.level} a {meter(entry.projectedNext.dueAt)}.
          </p>}
          {PANAMA_PM_REGISTER_URL && <a href={PANAMA_PM_REGISTER_URL} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center font-semibold underline">
            Conciliar en ANOTAR PM
          </a>}
        </div>
      )}
      {entry.readingConflict && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">El saldo de horas del maestro difiere del cálculo. Taller debe conciliarlo antes de programar.</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 text-sm font-semibold">
        {entry.checklistUrl && entry.level && <PanamaPmChecklistPdf unit={entry.unit} level={entry.level} />}
        {!entry.checklistUrl && entry.level && <p className="flex min-h-11 items-center font-normal text-text-secondary">Checklist pendiente</p>}
        {canSchedule && entry.batchBlock && <p className="flex min-h-11 items-center font-normal text-amber-800">{entry.batchBlock}</p>}
        {canSchedule && entry.level && !entry.batchBlock && <Link
          to={`/pm-order?${new URLSearchParams({ unidad: entry.unit, nivel: entry.level })}`}
          className="inline-flex min-h-11 items-center text-amber"
        >
          Orden PM para {entry.unit}
        </Link>}
      </div>
      {(entry.sourceStatus || entry.reading || entry.plan || entry.lastOfficial) && <details className="break-words text-xs text-text-secondary">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Datos del maestro</summary>
        {entry.sourceStatus && <p>Estado original · {entry.sourceStatus}</p>}
        {entry.reading && <p>Lectura · {entry.reading}</p>}
        {entry.plan && <p>Plan · {entry.plan}</p>}
        {entry.lastOfficial && <p>Último PM · {entry.lastOfficial}</p>}
      </details>}
    </article>
  );
}

function PanamaPMSchedule({ userId, canSchedule }: { userId?: string; canSchedule: boolean }) {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<PanamaMaintenance | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const entries = data?.entries ? [...data.entries].sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity)) : null;

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
        <h1 className="min-w-0 flex-1 text-lg font-bold text-text sm:text-xl">Programa de Mantenimiento</h1>
        <button type="button" aria-label="Actualizar programa PM" onClick={reload} disabled={data === null} className="rounded-xl border border-border bg-white p-3">
          <RefreshCw size={18} className={data === null ? 'animate-spin' : ''} />
        </button>
      </div>
      <details className="mb-3 text-xs text-text-secondary">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Fuente de vencimientos</summary>
        {PANAMA_PM_MASTER_URL
          ? <a href={PANAMA_PM_MASTER_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">Ver PM FLOTA</a>
          : <p>PM FLOTA</p>}
        {data?.sourceDate && <p>Corte del {new Date(data.sourceDate).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })} · Panamá</p>}
      </details>
      {canSchedule && userId && <div className={`mb-4 ${batchOpen ? '' : 'flex flex-wrap items-start gap-2'}`}>
        {!batchOpen && <Link to="/pm-order" className="inline-flex min-h-11 items-center rounded-xl bg-amber px-4 text-sm font-semibold text-white">Nueva Orden PM</Link>}
        <PanamaPmBatch entries={entries} userId={userId} onOpenChange={setBatchOpen} />
      </div>}
      {data === null && <SkeletonList count={4} />}
      {data?.entries === null && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-text">
        PM FLOTA no disponible. Actualiza para verificar los vencimientos.
      </p>}
      {data?.entries?.length === 0 && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-text">Sin equipos en PM FLOTA para tu cuenta.</p>}
      {entries && entries.some(entry => entry.planApproval !== 'approved') && <aside className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-semibold">Revisión de planes PM</p>
        <p className="mt-1">{entries.filter(entry => entry.planApproval !== 'approved').length} equipos necesitan revisar su plan. Taller confirma modelo, serie, tareas y aprobación.</p>
        {PANAMA_PM_MASTER_URL && <a href={PANAMA_PM_MASTER_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">Revisar maestro PM</a>}
      </aside>}
      {!batchOpen && entries && <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(entry => <MaintenanceCard key={entry.unit} entry={entry} canSchedule={canSchedule} />)}
      </div>}
      {data && (
        <section className="mt-5 rounded-xl border border-border bg-white p-4">
          <h2 className="font-bold text-text">Último PM por equipo</h2>
          {!data.historyAvailable
            ? <p role="alert" className="mt-2 text-sm text-text-secondary">Historial de PM no disponible.</p>
            : data.acceptedHistory.length === 0
              ? <p className="mt-2 text-sm text-text-secondary">Sin PM aceptados.</p>
              : <ul className="mt-2 divide-y divide-border text-sm">
                {data.acceptedHistory.map(row => <li key={row.folio} className="py-2">
                  <Link to={`/workorders/${encodeURIComponent(row.folio)}`} className="font-semibold underline">{row.folio}</Link>
                  <span> · {row.unit} · {row.level} · {meter(row.meter)} · {row.performedOn}</span>
                  <details className="text-xs text-text-secondary">
                    <summary className="min-h-11 cursor-pointer py-3 font-medium">Datos del cierre</summary>
                    <p className="break-words">{row.reference}</p>
                    {row.reviewer && <p>Revisó · {row.reviewer}</p>}
                  </details>
                  <PanamaPmNextService service={row.nextService} />
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
