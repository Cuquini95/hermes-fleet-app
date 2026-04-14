import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, RefreshCw, AlertTriangle, ClipboardX, Package, Wrench, CheckCircle } from 'lucide-react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { SkeletonList } from '../components/ui/Skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FallaCriticaAlert {
  kind: 'falla';
  id: string;
  unidad: string;
  tipoFalla: string;
  descripcion: string;
  prioridad: string;
}

interface DvirReprobadoAlert {
  kind: 'dvir';
  id: string;
  unidad: string;
  fecha: string;
  defectos: string;
}

interface StockCriticoAlert {
  kind: 'stock';
  id: string;
  partNumber: string;
  descripcion: string;
  stock: number;
  minimo: number;
}

interface PmVencidoAlert {
  kind: 'pm';
  id: string;
  unidad: string;
  tipoPm: string;
  horasActuales: number;
  horasProximo: number;
  horasVencido: number;
}

type Alert = FallaCriticaAlert | DvirReprobadoAlert | StockCriticoAlert | PmVencidoAlert;

interface AlertsData {
  fallas: FallaCriticaAlert[];
  dvir: DvirReprobadoAlert[];
  stock: StockCriticoAlert[];
  pm: PmVencidoAlert[];
}

// ── Data computation ──────────────────────────────────────────────────────────

function computeFallas(rows: string[][]): FallaCriticaAlert[] {
  const alerts: FallaCriticaAlert[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 15) continue;
    const prioridad = (row[8] ?? '').trim();
    const otId = (row[13] ?? '').trim();
    const estado = (row[14] ?? '').trim().toLowerCase();
    if ((prioridad === 'Alta' || prioridad === 'Crítica') && otId === '' && estado === 'abierta') {
      alerts.push({
        kind: 'falla',
        id: `falla-${i}`,
        unidad: (row[3] ?? '').trim(),
        tipoFalla: (row[6] ?? '').trim(),
        descripcion: (row[7] ?? '').trim(),
        prioridad,
      });
    }
  }
  return alerts;
}

function computeDvir(rows: string[][]): DvirReprobadoAlert[] {
  const alerts: DvirReprobadoAlert[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 27) continue;
    const resultado = (row[22] ?? '').trim().toLowerCase();
    const estadoAccion = (row[26] ?? '').trim().toLowerCase();
    if (resultado === 'reprobado' && estadoAccion === 'pendiente') {
      alerts.push({
        kind: 'dvir',
        id: `dvir-${i}`,
        unidad: (row[4] ?? '').trim(),
        fecha: (row[2] ?? '').trim(),
        defectos: (row[23] ?? '').trim(),
      });
    }
  }
  return alerts;
}

function computeStock(rows: string[][]): StockCriticoAlert[] {
  const alerts: StockCriticoAlert[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    const partNumber = (row[0] ?? '').trim();
    const descripcion = (row[1] ?? '').trim();
    if (!partNumber) continue;
    const stock = parseInt(row[3] ?? '', 10);
    const minimo = parseInt(row[4] ?? '', 10);
    if (!isNaN(stock) && !isNaN(minimo) && stock <= minimo) {
      alerts.push({
        kind: 'stock',
        id: `stock-${partNumber}-${i}`,
        partNumber,
        descripcion,
        stock,
        minimo,
      });
    }
  }
  return alerts;
}

function computePm(historialRows: string[][], horometrosRows: string[][]): PmVencidoAlert[] {
  // Latest PM entry per unit: { tipoPm, horasProximo }
  const latestPm: Record<string, { tipoPm: string; horasProximo: number; fecha: string }> = {};
  for (let i = 1; i < historialRows.length; i++) {
    const row = historialRows[i];
    if (!row || row.length < 5) continue;
    const unidad = (row[1] ?? '').trim();
    const fecha = (row[0] ?? '').trim();
    if (!unidad || !fecha) continue;
    const horasProximo = parseFloat(row[4] ?? '');
    const tipoPm = (row[2] ?? '').trim();
    if (isNaN(horasProximo) || horasProximo <= 0) continue;
    const existing = latestPm[unidad];
    if (!existing || fecha >= existing.fecha) {
      latestPm[unidad] = { tipoPm, horasProximo, fecha };
    }
  }

  // Latest horómetro per unit
  const latestHoro: Record<string, number> = {};
  for (let i = 1; i < horometrosRows.length; i++) {
    const row = horometrosRows[i];
    if (!row || row.length < 6) continue;
    const unidad = (row[2] ?? '').trim();
    if (!unidad) continue;
    const horo = parseFloat(row[5] ?? '');
    if (isNaN(horo) || horo <= 0) continue;
    const existing = latestHoro[unidad];
    if (existing === undefined || horo > existing) {
      latestHoro[unidad] = horo;
    }
  }

  const alerts: PmVencidoAlert[] = [];
  for (const [unidad, pmData] of Object.entries(latestPm)) {
    const horasActuales = latestHoro[unidad];
    if (horasActuales === undefined) continue;
    if (horasActuales >= pmData.horasProximo - 50) {
      alerts.push({
        kind: 'pm',
        id: `pm-${unidad}`,
        unidad,
        tipoPm: pmData.tipoPm,
        horasActuales,
        horasProximo: pmData.horasProximo,
        horasVencido: Math.round(horasActuales - pmData.horasProximo),
      });
    }
  }

  return alerts.sort((a, b) => b.horasVencido - a.horasVencido);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  colorClass: string;
}

function SectionHeader({ icon, title, count, colorClass }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={colorClass}>{icon}</span>
      <h2 className="font-bold text-text text-sm uppercase tracking-wide flex-1">{title}</h2>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-red-100 text-critical' : 'bg-green-100 text-success'}`}>
        {count}
      </span>
    </div>
  );
}

function FallaCard({ alert }: { alert: FallaCriticaAlert }) {
  const isCritica = alert.prioridad === 'Crítica';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border border-l-4 border-l-critical p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-text">{alert.unidad}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${isCritica ? 'bg-red-100 text-critical' : 'bg-amber-100 text-amber'}`}>
          {alert.prioridad.toUpperCase()}
        </span>
      </div>
      <p className="text-sm font-medium text-text">{alert.tipoFalla}</p>
      {alert.descripcion && (
        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{alert.descripcion}</p>
      )}
      <p className="text-xs text-critical mt-2 font-medium">Sin OT asignada</p>
    </div>
  );
}

function DvirCard({ alert }: { alert: DvirReprobadoAlert }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border border-l-4 border-l-critical p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-text">{alert.unidad}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-critical shrink-0">
          REPROBADO
        </span>
      </div>
      <p className="text-xs text-text-secondary">{alert.fecha}</p>
      {alert.defectos && (
        <p className="text-sm text-text mt-1 line-clamp-2">{alert.defectos}</p>
      )}
      <p className="text-xs text-critical mt-2 font-medium">Acción pendiente</p>
    </div>
  );
}

function StockCard({ alert }: { alert: StockCriticoAlert }) {
  const isZero = alert.stock === 0;
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${isZero ? 'border-l-critical' : 'border-l-amber'} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-semibold text-amber">{alert.partNumber}</p>
          <p className="font-medium text-text text-sm mt-0.5">{alert.descripcion}</p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isZero ? 'bg-red-100 text-critical' : 'bg-amber-100 text-amber'}`}>
            {isZero ? 'SIN STOCK' : 'BAJO'}
          </span>
          <span className="text-xl font-bold text-text">{alert.stock}</span>
          <span className="text-xs text-text-secondary">Mín: {alert.minimo}</span>
        </div>
      </div>
    </div>
  );
}

function PmCard({ alert }: { alert: PmVencidoAlert }) {
  const isOverdue = alert.horasVencido > 0;
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${isOverdue ? 'border-l-critical' : 'border-l-amber'} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-text">{alert.unidad}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-100 text-critical' : 'bg-amber-100 text-amber'}`}>
          {isOverdue ? 'VENCIDO' : 'PRÓXIMO'}
        </span>
      </div>
      <p className="text-sm text-text-secondary">{alert.tipoPm}</p>
      <div className="flex items-center justify-between mt-2 text-sm">
        <span className="text-text-secondary font-mono">Actual: {alert.horasActuales.toLocaleString()} hrs</span>
        <span className={`font-bold ${isOverdue ? 'text-critical' : 'text-amber'}`}>
          {isOverdue
            ? `VENCIDO ${alert.horasVencido} hrs`
            : `Faltan ${Math.abs(alert.horasVencido)} hrs`}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const [averias, inspecciones, inventario, historialPm, horometros] = await Promise.all([
        readRange(SHEET_TABS.AVERIAS, signal),
        readRange(SHEET_TABS.INSPECCIONES, signal),
        readRange(SHEET_TABS.INVENTARIO, signal),
        readRange(SHEET_TABS.HISTORIAL_PM, signal),
        readRange(SHEET_TABS.HOROMETROS, signal),
      ]);

      if (signal.aborted) return;

      setData({
        fallas: computeFallas(averias),
        dvir: computeDvir(inspecciones),
        stock: computeStock(inventario),
        pm: computePm(historialPm, horometros),
      });
      setLastRefresh(new Date());
    } catch (err: unknown) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Error al cargar alertas');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  function handleRetry() {
    const ctrl = new AbortController();
    load(ctrl.signal);
  }

  const totalAlerts = data
    ? data.fallas.length + data.dvir.length + data.stock.length + data.pm.length
    : 0;

  const allAlerts: Alert[] = data
    ? [...data.fallas, ...data.dvir, ...data.stock, ...data.pm]
    : [];

  const noAlerts = !loading && !error && data !== null && allAlerts.length === 0;

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <h1 className="text-xl font-bold text-text">Alertas</h1>
          {!loading && data !== null && totalAlerts > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-critical">
              {totalAlerts}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
          aria-label="Actualizar alertas"
        >
          <RefreshCw size={18} className={`text-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Last refresh */}
      {lastRefresh && !loading && (
        <p className="text-xs text-text-secondary mb-4">
          Actualizado: {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && <SkeletonList count={5} />}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <AlertTriangle size={32} className="text-critical mx-auto mb-3" />
          <p className="text-sm font-semibold text-text mb-1">Error al cargar alertas</p>
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

      {/* Empty state */}
      {noAlerts && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-success" />
          </div>
          <p className="text-base font-semibold text-text">Todo en orden ✓</p>
          <p className="text-sm text-text-secondary text-center max-w-xs">
            No hay fallas críticas, DVIR reprobados, stock bajo ni PMs vencidos en este momento.
          </p>
        </div>
      )}

      {/* Alert sections */}
      {!loading && !error && data !== null && totalAlerts > 0 && (
        <div className="flex flex-col gap-6">

          {/* Fallas críticas sin OT */}
          <section>
            <SectionHeader
              icon={<AlertTriangle size={16} />}
              title="Fallas Críticas sin OT"
              count={data.fallas.length}
              colorClass="text-critical"
            />
            {data.fallas.length === 0 ? (
              <p className="text-xs text-text-secondary pl-1">Sin alertas</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.fallas.map((a) => <FallaCard key={a.id} alert={a} />)}
              </div>
            )}
          </section>

          {/* DVIR reprobado sin seguimiento */}
          <section>
            <SectionHeader
              icon={<ClipboardX size={16} />}
              title="DVIR Reprobado sin seguimiento"
              count={data.dvir.length}
              colorClass="text-critical"
            />
            {data.dvir.length === 0 ? (
              <p className="text-xs text-text-secondary pl-1">Sin alertas</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.dvir.map((a) => <DvirCard key={a.id} alert={a} />)}
              </div>
            )}
          </section>

          {/* Stock crítico */}
          <section>
            <SectionHeader
              icon={<Package size={16} />}
              title="Stock Crítico"
              count={data.stock.length}
              colorClass="text-amber"
            />
            {data.stock.length === 0 ? (
              <p className="text-xs text-text-secondary pl-1">Sin alertas</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.stock.map((a) => <StockCard key={a.id} alert={a} />)}
              </div>
            )}
          </section>

          {/* PM vencido */}
          <section>
            <SectionHeader
              icon={<Wrench size={16} />}
              title="PM Vencido / Próximo"
              count={data.pm.length}
              colorClass="text-amber"
            />
            {data.pm.length === 0 ? (
              <p className="text-xs text-text-secondary pl-1">Sin alertas</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.pm.map((a) => <PmCard key={a.id} alert={a} />)}
              </div>
            )}
          </section>

        </div>
      )}

      {/* Bell empty state for initial non-loaded */}
      {!loading && !error && data === null && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Bell size={28} className="text-text-secondary" />
          </div>
          <p className="text-sm text-text-secondary text-center max-w-xs">
            Las alertas de PM vencido, stock bajo y fallas críticas aparecerán aquí.
          </p>
        </div>
      )}
    </div>
  );
}
