/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Self-service reports page with dynamic filters and multiple export paths.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  ClipboardCheck,
  Fuel,
  Gauge,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate } from '../lib/date-utils';
import { visibleWorkOrderFolio } from '../lib/purchasing-api';
import { pendingPanamaFaultReports, WORKSHOP_CAPTURE_CHANGED } from '../lib/offline-queue';
import { requestWorkshop } from '../lib/workshop-api';
import { useAuthStore } from '../stores/auth-store';
import { SkeletonList } from '../components/ui/Skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DvirRecord {
  id: string;
  fecha: string;
  hora: string;
  unidad: string;
  tipo: string;
  score: string;
  resultado: string;
}

interface CombustibleRecord {
  id: string;
  hora: string;
  unidad: string;
  tipo: string;
  litros: string;
}

interface HorometroRecord {
  id: string;
  hora: string;
  unidad: string;
  turno: string;
  horometro: string;
}

interface AveriaRecord {
  id: string;
  fecha?: string;
  hora: string;
  unidad: string;
  tipoFalla: string;
  prioridad: string;
  otId: string;
  workshopStatus?: string;
}

interface ReportsData {
  dvir: DvirRecord[];
  combustible: CombustibleRecord[];
  horometros: HorometroRecord[];
  averias: AveriaRecord[];
}

// ── Data parsers ──────────────────────────────────────────────────────────────

function parseDvir(rows: string[][], userName: string, dateStr: string): DvirRecord[] {
  const records: DvirRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 23) continue;
    const fecha = (row[2] ?? '').trim();
    const operador = (row[6] ?? '').trim();
    if (fecha !== dateStr || operador !== userName) continue;
    records.push({
      id: `dvir-${i}`,
      fecha,
      hora: (row[3] ?? '').trim(),
      unidad: (row[4] ?? '').trim(),
      tipo: (row[7] ?? '').trim(),
      score: (row[21] ?? '').trim(),
      resultado: (row[22] ?? '').trim(),
    });
  }
  return records;
}

function parseCombustible(rows: string[][], userName: string, dateStr: string): CombustibleRecord[] {
  const records: CombustibleRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;
    const fecha = (row[1] ?? '').trim();
    const operador = (row[4] ?? '').trim();
    if (fecha !== dateStr || operador !== userName) continue;
    records.push({
      id: `fuel-${i}`,
      hora: (row[2] ?? '').trim(),
      unidad: (row[3] ?? '').trim(),
      tipo: (row[5] ?? '').trim(),
      litros: (row[6] ?? '').trim(),
    });
  }
  return records;
}

function parseHorometros(rows: string[][], userName: string, dateStr: string): HorometroRecord[] {
  const records: HorometroRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;
    const fecha = (row[0] ?? '').trim();
    const operador = (row[4] ?? '').trim();
    if (fecha !== dateStr || operador !== userName) continue;
    records.push({
      id: `horo-${i}`,
      hora: (row[1] ?? '').trim(),
      unidad: (row[2] ?? '').trim(),
      turno: (row[5] ?? '').trim(),
      horometro: (row[6] ?? '').trim(),
    });
  }
  return records;
}

function parseAverias(rows: string[][], userName: string, dateStr: string): AveriaRecord[] {
  const records: AveriaRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;
    const fecha = (row[0] ?? '').trim();
    const operador = (row[6] ?? '').trim();
    if (fecha !== dateStr || operador !== userName) continue;
    records.push({
      id: `averia-${i}`,
      hora: (row[1] ?? '').trim(),
      unidad: (row[2] ?? '').trim(),
      tipoFalla: (row[3] ?? '').trim(),
      prioridad: (row[5] ?? '').trim(),
      otId: (row[13] ?? '').trim(),
    });
  }
  return records;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function ResultadoBadge({ resultado }: { resultado: string }) {
  const lower = resultado.toLowerCase();
  let classes = 'bg-gray-100 text-text-secondary';
  if (lower === 'aprobado') classes = 'bg-green-100 text-success';
  else if (lower === 'condicional') classes = 'bg-amber-100 text-amber';
  else if (lower === 'reprobado') classes = 'bg-red-100 text-critical';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${classes}`}>
      {resultado.toUpperCase()}
    </span>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const lower = prioridad.toLowerCase();
  let classes = 'bg-gray-100 text-text-secondary';
  if (lower === 'crítica') classes = 'bg-red-100 text-critical';
  else if (lower === 'alta') classes = 'bg-red-50 text-critical';
  else if (lower === 'media') classes = 'bg-amber-100 text-amber';
  else if (lower === 'baja') classes = 'bg-green-100 text-success';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${classes}`}>
      {prioridad.toUpperCase()}
    </span>
  );
}

// ── Record cards ──────────────────────────────────────────────────────────────

function DvirCard({ record }: { record: DvirRecord }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-text text-sm">{record.unidad}</span>
          <span className="text-xs text-text-secondary capitalize">{record.tipo}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">{record.hora}</span>
          {record.score && (
            <span className="text-xs font-mono text-text-secondary">{record.score}</span>
          )}
        </div>
      </div>
      <ResultadoBadge resultado={record.resultado} />
    </div>
  );
}

function CombustibleCard({ record }: { record: CombustibleRecord }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-text text-sm">{record.unidad}</span>
          <span className="text-xs text-text-secondary capitalize">{record.tipo}</span>
        </div>
        <span className="text-xs text-text-secondary">{record.hora}</span>
      </div>
      {record.litros && (
        <span className="text-sm font-bold text-text shrink-0">{record.litros} L</span>
      )}
    </div>
  );
}

function HorometroCard({ record }: { record: HorometroRecord }) {
  const turnoLabel = record.turno === 'inicio' ? 'Inicio' : record.turno === 'final' ? 'Final' : record.turno;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-text text-sm">{record.unidad}</span>
          <span className="text-xs text-text-secondary">{turnoLabel}</span>
        </div>
        <span className="text-xs text-text-secondary">{record.hora}</span>
      </div>
      {record.horometro && (
        <span className="text-sm font-bold text-text shrink-0 font-mono">{record.horometro} h</span>
      )}
    </div>
  );
}

function AveriaCard({ record }: { record: AveriaRecord }) {
  const publicOt = visibleWorkOrderFolio(record.otId ?? '');
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-text text-sm">{record.unidad}</span>
          <span className="text-xs text-text-secondary">{record.tipoFalla}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">{record.hora}</span>
          {publicOt && <span className="text-xs text-text-secondary">{publicOt}</span>}
        </div>
        {record.workshopStatus && <p className="mt-1 text-xs font-semibold text-blue-800">{record.workshopStatus}</p>}
        {record.otId && !publicOt && <details className="text-xs text-text-secondary">
          <summary className="cursor-pointer py-1">Referencia</summary>
          <p className="break-words">{record.otId}</p>
        </details>}
      </div>
      <PrioridadBadge prioridad={record.prioridad} />
    </div>
  );
}

// ── Section component ─────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  iconColorClass: string;
  children: React.ReactNode;
}

function Section({ icon, title, count, iconColorClass, children }: SectionProps) {
  if (!count) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={iconColorClass}>{icon}</span>
        <h2 className="font-bold text-text text-sm flex-1">{title}</h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyReportsPage() {
  const userId = useAuthStore((s) => s.userId);
  const isPanama = useAuthStore((s) => s.project === 'tmf-panama');
  return <Reports key={JSON.stringify([isPanama, userId])} actorId={isPanama ? userId : undefined} />;
}

function Reports({ actorId }: { actorId?: string }) {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [partial, setPartial] = useState(false);
  const [localFaults, setLocalFaults] = useState<Awaited<ReturnType<typeof pendingPanamaFaultReports>>>([]);
  const [revision, setRevision] = useState(0);

  const todayStr = mexicoDate();

  const load = useCallback(async (signal: AbortSignal, background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const results = await Promise.allSettled([
        readRange(SHEET_TABS.INSPECCIONES, signal),
        readRange(SHEET_TABS.COMBUSTIBLE, signal),
        readRange(SHEET_TABS.HOROMETROS, signal),
        actorId ? requestWorkshop<{ reports: AveriaRecord[] }>('myfaults') : readRange(SHEET_TABS.AVERIAS, signal),
      ] as const);

      if (signal.aborted) return;
      const failed = results.filter(item => item.status === 'rejected');
      if (failed.length && (!actorId || failed.length === results.length)) throw failed[0]?.reason;
      const [insp, fuel, horo, faults] = results;
      const inspRows = insp.status === 'fulfilled' ? insp.value : [];
      const fuelRows = fuel.status === 'fulfilled' ? fuel.value : [];
      const horoRows = horo.status === 'fulfilled' ? horo.value : [];
      const faultSource = faults.status === 'fulfilled' ? faults.value : [];
      const faultsOn = (date: string) => Array.isArray(faultSource)
        ? parseAverias(faultSource, userName, date)
        : faultSource.reports.filter(report => report.fecha === date);

      let dvir = parseDvir(inspRows, userName, todayStr);
      let combustible = parseCombustible(fuelRows, userName, todayStr);
      let horometros = parseHorometros(horoRows, userName, todayStr);
      let averias = faultsOn(todayStr);

      // If today is completely empty, try yesterday
      const totalToday = dvir.length + combustible.length + horometros.length + averias.length;
      if (totalToday === 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = mexicoDate(yesterday);
        dvir = parseDvir(inspRows, userName, yesterdayStr);
        combustible = parseCombustible(fuelRows, userName, yesterdayStr);
        horometros = parseHorometros(horoRows, userName, yesterdayStr);
        averias = faultsOn(yesterdayStr);
      }

      setData({ dvir, combustible, horometros, averias });
      setPartial(failed.length > 0);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      if (signal.aborted) return;
      if (!background) setError(err instanceof Error ? err.message : 'Error al cargar reportes');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [actorId, userName, todayStr]);

  useEffect(() => {
    const controller = new AbortController();
    let activeRequest = false;
    const update = (background: boolean) => {
      if (activeRequest || (background && (!navigator.onLine || document.visibilityState !== 'visible'))) return;
      activeRequest = true;
      void load(controller.signal, background).finally(() => { activeRequest = false; });
    };
    update(false);
    if (!actorId) return () => controller.abort();
    const refresh = () => {
      void pendingPanamaFaultReports(actorId).then(items => {
        if (!controller.signal.aborted) setLocalFaults(items);
      }).catch(() => {});
      update(true);
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('online', refresh);
    window.addEventListener(WORKSHOP_CAPTURE_CHANGED, refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('online', refresh);
      window.removeEventListener(WORKSHOP_CAPTURE_CHANGED, refresh);
    };
  }, [actorId, load, revision]);

  function handleRetry() {
    setRevision(value => value + 1);
  }

  const total = data
    ? data.dvir.length + data.combustible.length + data.horometros.length + data.averias.length
    : 0;
  const allEmpty = !loading && !error && !partial && data !== null && total === 0 && localFaults.length === 0;

  // Format today's date for display: "lunes 13 de abril"
  const todayDisplay = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Panama',
  });

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
          aria-label="Volver"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text">Mis reportes</h1>
          <p className="text-xs text-text-secondary capitalize">{todayDisplay}</p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
          aria-label="Actualizar reportes"
        >
          <RefreshCw size={18} className={`text-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Last sync */}
      {lastRefresh && !loading && (
        <p className="text-xs text-text-secondary mb-4 pl-1">
          Actualizado{' '}
          {lastRefresh.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' })}
        </p>
      )}
      {!lastRefresh && !loading && <div className="mb-4" />}
      {!loading && !error && partial && <p role="status" className="mb-3 text-sm text-amber-800">Algunos reportes están pendientes de consulta.</p>}

      {localFaults.length > 0 && <section aria-label="Reportes guardados en el teléfono" className="mb-4 space-y-2">
        {localFaults.map(report => <article key={report.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">Guardado en el teléfono</p>
          <p className="break-words text-sm">{report.unit} · {report.type}</p>
          <p className="text-xs text-amber-900">Pendiente de enviar a Taller</p>
        </article>)}
      </section>}

      {/* Loading skeleton */}
      {loading && <SkeletonList count={4} />}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <AlertTriangle size={32} className="text-critical mx-auto mb-3" />
          <p className="text-sm font-semibold text-text mb-1">Error al cargar reportes</p>
          <p className="text-xs text-text-secondary mb-4">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* All-empty state */}
      {allEmpty && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <CheckCircle size={28} className="text-success shrink-0" />
          <div>
            <p className="font-semibold text-text text-sm">Sin actividad registrada hoy ni ayer.</p>
          </div>
        </div>
      )}

      {/* Sections */}
      {!loading && !error && data !== null && total > 0 && (
        <div className="flex flex-col gap-6">

          {/* Checklists DVIR */}
          <Section
            icon={<ClipboardCheck size={16} />}
            title="Inspecciones"
            count={data.dvir.length}
            iconColorClass="text-blue-600"
          >
            <div className="flex flex-col gap-2">
              {data.dvir.map((r) => <DvirCard key={r.id} record={r} />)}
            </div>
          </Section>

          {/* Combustible */}
          <Section
            icon={<Fuel size={16} />}
            title="Combustible"
            count={data.combustible.length}
            iconColorClass="text-amber"
          >
            <div className="flex flex-col gap-2">
              {data.combustible.map((r) => <CombustibleCard key={r.id} record={r} />)}
            </div>
          </Section>

          {/* Horómetros */}
          <Section
            icon={<Gauge size={16} />}
            title="Horómetros"
            count={data.horometros.length}
            iconColorClass="text-text-secondary"
          >
            <div className="flex flex-col gap-2">
              {data.horometros.map((r) => <HorometroCard key={r.id} record={r} />)}
            </div>
          </Section>

          {/* Averías */}
          <Section
            icon={<AlertTriangle size={16} />}
            title="Averías"
            count={data.averias.length}
            iconColorClass="text-critical"
          >
            <div className="flex flex-col gap-2">
              {data.averias.map((r) => <AveriaCard key={r.id} record={r} />)}
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}
