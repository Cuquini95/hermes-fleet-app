/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Expense list/filter/report page. Shared filter state across tabs; monolith keeps filter serialization in one place.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Receipt,
  TrendingUp,
  Wrench,
  Fuel,
  Package,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useGastosStore } from '../stores/gastos-store';
import type { GastoCompra, GastoTipo } from '../stores/gastos-store';
import MonthSelector from '../components/MonthSelector';
import { generateGastosPDF, type GastoReportData } from '../lib/gastos-pdf';
import { downloadBlob } from '../lib/download-blob';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Colour palette ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Refaccion:   '#F59E0B',
  Combustible: '#3B82F6',
  Servicio:    '#8B5CF6',
  Otro:        '#6B7280',
};

const TYPE_ICONS_SM: Record<string, React.ReactNode> = {
  Refaccion:   <Wrench  size={14} />,
  Combustible: <Fuel    size={14} />,
  Servicio:    <Package size={14} />,
  Otro:        <Receipt size={14} />,
};

const TYPE_ICONS_LG: Record<string, React.ReactNode> = {
  Refaccion:   <Wrench  size={20} />,
  Combustible: <Fuel    size={20} />,
  Servicio:    <Package size={20} />,
  Otro:        <Receipt size={20} />,
};

const TYPE_ORDER = ['Combustible', 'Refaccion', 'Servicio', 'Otro'] as const;

// ── Heatmap colour scale (blue, darkest = highest spend) ─────────────────────

function heatColor(value: number, max: number): { bg: string; text: string } {
  if (max === 0 || value === 0) return { bg: '#F1F5F9', text: '#94A3B8' };
  const r = value / max;
  if (r > 0.70) return { bg: '#1D4ED8', text: '#ffffff' };
  if (r > 0.40) return { bg: '#2563EB', text: '#ffffff' };
  if (r > 0.20) return { bg: '#3B82F6', text: '#ffffff' };
  if (r > 0.08) return { bg: '#93C5FD', text: '#1E3A8A' };
  return          { bg: '#DBEAFE', text: '#1E3A8A' };
}

// ── Helper: current month label ───────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ── Filter gastos to a specific year/month ──────────────────────────────────
// fecha is stored as "dd/MM/yyyy" — compare month and year parts directly

function filterByMonth(gastos: GastoCompra[], year: number, month: number): GastoCompra[] {
  return gastos.filter((g) => {
    if (g.status === 'Eliminado') return false;
    const parts = g.fecha.split('/');
    if (parts.length !== 3) return false;
    return parseInt(parts[1] ?? '0') === month && parseInt(parts[2] ?? '0') === year;
  });
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function byUnit(gastos: GastoCompra[]) {
  const map: Record<string, number> = {};
  for (const g of gastos) {
    map[g.unidad] = (map[g.unidad] || 0) + g.total;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function byType(gastos: GastoCompra[]) {
  const map: Record<string, { total: number; count: number }> = {};
  for (const g of gastos) {
    const bucket = map[g.tipo] ?? { total: 0, count: 0 };
    bucket.total += g.total;
    bucket.count += 1;
    map[g.tipo] = bucket;
  }
  return map;
}

// ── Currency formatter ────────────────────────────────────────────────────────

const mxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

// ── Report data builder (for PDF export) ─────────────────────────────────────

interface BuildReportArgs {
  gastos: GastoCompra[];
  selectedUnits: Set<string>;
  year: number;
  month: number;
  userName: string;
}

function buildReportData(args: BuildReportArgs): GastoReportData {
  const { gastos, selectedUnits, year, month, userName } = args;

  // Filter to only the selected units
  const filtered = gastos.filter((g) => selectedUnits.has(g.unidad));
  const total = filtered.reduce((s, g) => s + g.total, 0);
  const count = filtered.length;

  // Per-type aggregation
  const typeOrder: GastoTipo[] = ['Combustible', 'Refaccion', 'Servicio', 'Otro'];
  const byTypeData = typeOrder.map((tipo) => {
    const items = filtered.filter((g) => g.tipo === tipo);
    const typeTotal = items.reduce((s, g) => s + g.total, 0);
    return {
      tipo,
      total: typeTotal,
      count: items.length,
      pct: total > 0 ? (typeTotal / total) * 100 : 0,
    };
  });

  // Per-unit aggregation (only units present in the filtered set)
  const unitMap = new Map<string, GastoCompra[]>();
  for (const g of filtered) {
    const list = unitMap.get(g.unidad) ?? [];
    list.push(g);
    unitMap.set(g.unidad, list);
  }
  const byUnitData = Array.from(unitMap.entries()).map(([unidad, items]) => ({
    unidad,
    total: items.reduce((s, g) => s + g.total, 0),
    count: items.length,
    gastos: items,
  }));

  return {
    period: { year, month, label: monthLabel(year, month) },
    generatedAt: `${mexicoDate()} ${mexicoTime()}`,
    generatedBy: userName || 'Usuario',
    selectedUnits: Array.from(selectedUnits).sort(),
    gastos: filtered,
    totals: {
      total,
      count,
      averagePerRecord: count > 0 ? total / count : 0,
    },
    byType: byTypeData,
    byUnit: byUnitData,
  };
}

function buildFilename(year: number, month: number, selectedUnits: string[]): string {
  const mes = MONTH_NAMES[month - 1];
  if (selectedUnits.length === 1) {
    return `Gastos-${mes}-${year}-${selectedUnits[0]}.pdf`;
  }
  return `Gastos-${mes}-${year}.pdf`;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'detalle';

interface ToastState {
  kind: 'success' | 'error';
  message: string;
}

export default function GastosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);
  const { gastos, loading, fetchGastos, deleteGasto } = useGastosStore();

  const [tab, setTab] = useState<Tab>('resumen');

  // ── Month selector state (defaults to current month) ─────────────────────
  const now = new Date();
  const [selectedYear, setSelectedYear]   = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  // ── Unit selection state (for PDF export) ────────────────────────────────
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());

  // ── PDF download state ───────────────────────────────────────────────────
  const [generating, setGenerating] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const canCreate = role === 'gerencia' || role === 'supervisor' ||
                    role === 'jefe_taller' || role === 'coordinador';

  useEffect(() => {
    fetchGastos();
  }, []);

  const monthly   = useMemo(
    () => filterByMonth(gastos, selectedYear, selectedMonth),
    [gastos, selectedYear, selectedMonth]
  );
  const totalMes  = monthly.reduce((s, g) => s + g.total, 0);
  const unitData  = byUnit(monthly);
  const typeMap   = byType(monthly);
  const unitMax   = unitData[0]?.value ?? 0;

  // When the month or data changes, reset selected units to ALL visible
  useEffect(() => {
    setSelectedUnits(new Set(unitData.map((u) => u.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, unitData.length]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleUnit(unitId: string): void {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function selectAllUnits(): void {
    setSelectedUnits(new Set(unitData.map((u) => u.name)));
  }

  function selectNoUnits(): void {
    setSelectedUnits(new Set());
  }

  async function handleDownloadPDF(): Promise<void> {
    if (selectedUnits.size === 0 || monthly.length === 0) return;
    setGenerating(true);
    try {
      const reportData = buildReportData({
        gastos: monthly,
        selectedUnits,
        year: selectedYear,
        month: selectedMonth,
        userName,
      });
      const blob = await generateGastosPDF(reportData);
      const filename = buildFilename(selectedYear, selectedMonth, reportData.selectedUnits);
      downloadBlob(blob, filename);
      setToast({ kind: 'success', message: `PDF descargado: ${filename}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setToast({ kind: 'error', message: `No se pudo generar el PDF: ${msg}` });
    } finally {
      setGenerating(false);
    }
  }

  const canDownload = canCreate && monthly.length > 0 && selectedUnits.size > 0 && !generating;

  return (
    <div className="flex flex-col py-4 gap-4 animate-fade-up">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.kind === 'success' ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Gastos</h1>
          <MonthSelector
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => {
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              useGastosStore.setState({ fetched: false });
              fetchGastos();
            }}
            className="p-2 rounded-full"
            style={{ color: '#162252' }}
            aria-label="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {canCreate && (
            <button
              onClick={() => navigate('/gastos/nuevo')}
              className="flex items-center gap-1.5 bg-amber text-white text-sm font-medium rounded-lg px-3 py-2"
            >
              <Plus size={16} /> Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Download PDF CTA */}
      {canCreate && monthly.length > 0 && (
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={!canDownload}
          className="w-full flex items-center justify-center gap-2 bg-navy text-white text-sm font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ backgroundColor: '#162252' }}
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando PDF…
            </>
          ) : (
            <>
              <Download size={18} />
              Descargar PDF ({selectedUnits.size} {selectedUnits.size === 1 ? 'unidad' : 'unidades'})
            </>
          )}
        </button>
      )}

      {/* Total KPI */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center">
          <TrendingUp size={22} className="text-amber" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text">
            {loading ? '…' : mxn(totalMes)}
          </p>
          <p className="text-sm text-text-secondary">Total del mes · {monthly.length} registros</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['resumen', 'detalle'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'bg-amber text-white'
                : 'bg-white border border-border text-text-secondary'
            }`}
          >
            {t === 'resumen' ? 'Resumen' : 'Detalle'}
          </button>
        ))}
      </div>

      {/* ── RESUMEN tab ──────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <>
          {/* Type cards 2×2 */}
          {monthly.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {TYPE_ORDER.map((tipo) => {
                const val   = typeMap[tipo]?.total ?? 0;
                const count = typeMap[tipo]?.count ?? 0;
                const pct   = totalMes > 0 ? Math.round((val / totalMes) * 100) : 0;
                const color = TYPE_COLORS[tipo];
                return (
                  <div key={tipo} className="bg-white rounded-xl border border-border p-3 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${color}18`, color }}
                      >
                        {TYPE_ICONS_LG[tipo]}
                      </div>
                      <span className="text-sm font-bold" style={{ color }}>
                        {pct}%
                      </span>
                    </div>
                    <p className="text-base font-bold text-text leading-tight">{mxn(val)}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{tipo} · {count} reg.</p>
                    <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Heat map by unit — tap to select/deselect for PDF export */}
          {unitData.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-text">Mapa de calor por Unidad</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={selectAllUnits}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber/10 text-amber hover:bg-amber/20 transition-colors"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={selectNoUnits}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-text-secondary hover:bg-gray-200 transition-colors"
                  >
                    Ninguna
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-secondary mb-2">
                Toca una unidad para incluirla o excluirla del reporte PDF
              </p>
              <div className="grid grid-cols-3 gap-2">
                {unitData.map((u) => {
                  const { bg, text } = heatColor(u.value, unitMax);
                  const isSelected = selectedUnits.has(u.name);
                  return (
                    <button
                      key={u.name}
                      type="button"
                      onClick={() => toggleUnit(u.name)}
                      className={`rounded-xl py-3 px-2 flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber ring-offset-1'
                          : 'opacity-50 grayscale'
                      }`}
                      style={{ background: bg }}
                      aria-pressed={isSelected}
                    >
                      <span className="text-xs font-bold" style={{ color: text }}>
                        {u.name}
                      </span>
                      <span className="text-xs" style={{ color: text, opacity: 0.8 }}>
                        {mxn(u.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && monthly.length === 0 && (
            <div className="bg-white rounded-xl border border-border p-8 text-center">
              <Receipt size={32} className="text-text-secondary mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Sin gastos este mes</p>
              {canCreate && (
                <button
                  onClick={() => navigate('/gastos/nuevo')}
                  className="mt-3 text-sm text-amber font-medium"
                >
                  Registrar primer gasto
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── DETALLE tab ──────────────────────────────────────────────────── */}
      {tab === 'detalle' && (
        <div className="flex flex-col gap-2">
          {loading && (
            <div className="text-center py-10 text-sm text-text-secondary">Cargando…</div>
          )}
          {!loading && gastos.length === 0 && (
            <div className="text-center py-10 text-sm text-text-secondary">Sin gastos registrados</div>
          )}
          {gastos.filter((g) => g.status !== 'Eliminado').slice().reverse().map((g) => (
            <GastoRow
              key={g.gasto_id}
              gasto={g}
              canDelete={canCreate}
              onDelete={() => deleteGasto(g.gasto_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── GastoRow ──────────────────────────────────────────────────────────────────

function GastoRow({
  gasto,
  canDelete,
  onDelete,
}: {
  gasto: GastoCompra;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const color = TYPE_COLORS[gasto.tipo] ?? '#6B7280';
  const statusColor =
    gasto.status === 'Aprobado'  ? 'text-success' :
    gasto.status === 'Rechazado' ? 'text-red-500' :
    'text-amber';

  return (
    <div className="bg-white rounded-xl border border-border p-3 shadow-sm flex items-center gap-3">
      <div
        className="rounded-full self-stretch"
        style={{ backgroundColor: color, minWidth: 4, maxWidth: 4 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{gasto.proveedor || '—'}</p>
        <p className="text-xs text-text-secondary">
          {gasto.unidad} · {gasto.fecha}
        </p>
        <p className="text-xs text-text-secondary flex items-center gap-1">
          <span style={{ color }}>{TYPE_ICONS_SM[gasto.tipo]}</span>
          {gasto.tipo}
        </p>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{mxn(gasto.total)}</p>
          <p className={`text-xs font-medium ${statusColor}`}>{gasto.status}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Eliminar gasto"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
