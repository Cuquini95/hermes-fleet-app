import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  Database,
  Loader2,
  Pencil,
} from 'lucide-react';
import { readRange, upsertRow } from '../lib/sheets-api';

// ── Collection definitions ───────────────────────────────────────────────────

type ColumnAlign = 'left' | 'right' | 'center';

interface ColumnDef {
  label: string;
  index: number;          // source column index from sheets
  align?: ColumnAlign;
  mono?: boolean;         // monospace font (numbers / codes)
  currency?: boolean;     // format as MXN currency
  badge?: 'severity' | 'status' | 'resultado';
  hideOnMobile?: boolean; // hide on small screens
  sticky?: boolean;       // sticky first column
  minWidth?: string;
}

interface Collection {
  id: string;
  icon: string;           // emoji
  label: string;
  tab: string;
  emptyMessage: string;
  columns: ColumnDef[];
}

const COLLECTIONS: Collection[] = [
  {
    id: 'fletes',
    icon: '🚛',
    label: 'Fletes',
    tab: 'Reporte_Fletes_Transporte',
    emptyMessage: 'Aún no hay fletes registrados',
    columns: [
      { label: 'Fecha',     index: 0, sticky: true, minWidth: '110px' },
      { label: 'Hora',      index: 1, mono: true, hideOnMobile: true, minWidth: '70px' },
      { label: 'Unidad',    index: 2, mono: true, minWidth: '90px' },
      { label: 'Conductor', index: 3, minWidth: '140px' },
      { label: 'KM Carg',   index: 4, align: 'right', mono: true, hideOnMobile: true },
      { label: 'KM Vac',    index: 5, align: 'right', mono: true, hideOnMobile: true },
      { label: 'Origen',    index: 6, hideOnMobile: true, minWidth: '130px' },
      { label: 'Destino',   index: 7, minWidth: '130px' },
      { label: 'KM Total',  index: 8, align: 'right', mono: true },
      { label: 'Cliente',   index: 9, hideOnMobile: true, minWidth: '140px' },
      { label: 'Material',  index: 10, hideOnMobile: true, minWidth: '130px' },
      { label: 'Tonelaje',  index: 11, align: 'right', mono: true },
      { label: 'Flete',     index: 12, align: 'right', mono: true, currency: true },
    ],
  },
  {
    id: 'combustible',
    icon: '⛽',
    label: 'Combustible',
    tab: 'Combustible',
    emptyMessage: 'Aún no hay cargas de combustible registradas',
    columns: [
      { label: 'Fecha',     index: 0, sticky: true, minWidth: '110px' },
      { label: 'Hora',      index: 1, mono: true, hideOnMobile: true, minWidth: '70px' },
      { label: 'Tipo',      index: 2, hideOnMobile: true },
      { label: 'Unidad',    index: 3, mono: true, minWidth: '90px' },
      { label: 'Operador',  index: 4, minWidth: '140px' },
      { label: 'Comb',      index: 5, hideOnMobile: true },
      { label: 'Litros',    index: 6, align: 'right', mono: true },
      { label: 'Costo',     index: 7, align: 'right', mono: true, currency: true },
      { label: 'P.Unit',    index: 8, align: 'right', mono: true, currency: true, hideOnMobile: true },
      { label: 'Horóm',     index: 9, align: 'right', mono: true, hideOnMobile: true },
      { label: 'KM',        index: 10, align: 'right', mono: true, hideOnMobile: true },
      { label: 'Estación',  index: 11, hideOnMobile: true, minWidth: '130px' },
      { label: 'Folio',     index: 12, mono: true, hideOnMobile: true },
    ],
  },
  {
    id: 'gastos',
    icon: '💰',
    label: 'Gastos',
    tab: 'Gastos',
    emptyMessage: 'Aún no hay gastos registrados',
    columns: [
      { label: 'Fecha',       index: 0, sticky: true, minWidth: '110px' },
      { label: 'ID Gasto',    index: 1, mono: true, hideOnMobile: true },
      { label: 'Fecha Doc',   index: 2, hideOnMobile: true, minWidth: '110px' },
      { label: 'Tipo',        index: 3 },
      { label: 'Proveedor',   index: 4, minWidth: '160px' },
      { label: 'RFC',         index: 5, mono: true, hideOnMobile: true },
      { label: 'Folio',       index: 6, mono: true, hideOnMobile: true },
      { label: 'Subtotal',    index: 7, align: 'right', mono: true, currency: true, hideOnMobile: true },
      { label: 'IVA',         index: 8, align: 'right', mono: true, currency: true, hideOnMobile: true },
      { label: 'Total',       index: 9, align: 'right', mono: true, currency: true },
      { label: 'Unidad',      index: 10, mono: true },
      { label: 'OT Ref',      index: 11, mono: true, hideOnMobile: true },
      { label: 'Solicitante', index: 12, hideOnMobile: true },
      { label: 'Método',      index: 13, hideOnMobile: true },
      { label: 'Status',      index: 14, badge: 'status' },
    ],
  },
  {
    id: 'averias',
    icon: '⚠️',
    label: 'Averías',
    tab: 'Averias',
    emptyMessage: 'No hay averías reportadas',
    columns: [
      { label: 'Fecha',       index: 0, sticky: true, minWidth: '110px' },
      { label: 'ID',          index: 1, mono: true, hideOnMobile: true },
      { label: 'Unidad',      index: 2, mono: true, minWidth: '90px' },
      { label: 'Tipo',        index: 3, hideOnMobile: true },
      { label: 'Descripción', index: 4, minWidth: '200px' },
      { label: 'Severidad',   index: 5, badge: 'severity' },
      { label: 'Técnico',     index: 6, hideOnMobile: true },
      { label: 'Status',      index: 7, badge: 'status' },
    ],
  },
  {
    id: 'ot',
    icon: '🔧',
    label: 'Órdenes de Trabajo',
    tab: 'ORDENES_TRABAJO',
    emptyMessage: 'No hay órdenes de trabajo',
    columns: [
      { label: 'Fecha',       index: 0, sticky: true, minWidth: '110px' },
      { label: 'OT ID',       index: 1, mono: true },
      { label: 'Fecha Doc',   index: 2, hideOnMobile: true, minWidth: '110px' },
      { label: 'Unidad',      index: 3, mono: true, minWidth: '90px' },
      { label: 'Tipo',        index: 4, hideOnMobile: true },
      { label: 'Descripción', index: 5, minWidth: '200px' },
      { label: 'Severidad',   index: 6, badge: 'severity' },
      { label: 'Técnico',     index: 7, hideOnMobile: true },
      { label: 'Status',      index: 8, badge: 'status' },
    ],
  },
  {
    id: 'horometros',
    icon: '⏱️',
    label: 'Horómetros',
    tab: '04B Registro Horómetros',
    emptyMessage: 'Aún no hay lecturas de horómetro',
    columns: [
      { label: 'Fecha',     index: 0, sticky: true, minWidth: '110px' },
      { label: 'Hora',      index: 1, mono: true, hideOnMobile: true },
      { label: 'Unidad',    index: 2, mono: true, minWidth: '90px' },
      { label: 'Modelo',    index: 3, hideOnMobile: true, minWidth: '130px' },
      { label: 'Operador',  index: 4, minWidth: '140px' },
      { label: 'Turno',     index: 5, hideOnMobile: true },
      { label: 'Horómetro', index: 6, align: 'right', mono: true },
      { label: 'Próx PM',   index: 7, align: 'right', mono: true, hideOnMobile: true },
      { label: 'Faltan',    index: 8, align: 'right', mono: true },
    ],
  },
  {
    id: 'viajes_pena',
    icon: '🏔️',
    label: 'Viajes Peña',
    tab: 'Reporte_Viajes_Peña',
    emptyMessage: 'Aún no hay viajes a Peña registrados',
    columns: [
      { label: 'Fecha',         index: 0, sticky: true, minWidth: '110px' },
      { label: 'Hora',          index: 1, mono: true, hideOnMobile: true },
      { label: 'Unidad',        index: 2, mono: true, minWidth: '90px' },
      { label: 'Operador',      index: 3, minWidth: '140px' },
      { label: 'Origen',        index: 4, hideOnMobile: true, minWidth: '130px' },
      { label: 'Destino',       index: 5, minWidth: '130px' },
      { label: 'Viajes',        index: 6, align: 'right', mono: true },
      { label: 'M³',            index: 7, align: 'right', mono: true },
      { label: 'Observaciones', index: 8, hideOnMobile: true, minWidth: '200px' },
    ],
  },
  {
    id: 'inspecciones',
    icon: '📋',
    label: 'Inspecciones',
    tab: '14 Inspecciones',
    emptyMessage: 'Aún no hay inspecciones registradas',
    columns: [
      { label: 'Fecha',     index: 0, sticky: true, minWidth: '110px' },
      { label: 'Hora',      index: 1, mono: true, hideOnMobile: true },
      { label: 'Folio',     index: 2, mono: true, hideOnMobile: true },
      { label: 'Tipo',      index: 3, hideOnMobile: true },
      { label: 'Unidad',    index: 4, mono: true, minWidth: '90px' },
      { label: 'Modelo',    index: 5, hideOnMobile: true, minWidth: '130px' },
      { label: 'Operador',  index: 6, minWidth: '140px' },
      { label: 'Tipo Insp', index: 7, hideOnMobile: true },
      { label: 'Score',     index: 8, align: 'right', mono: true },
      { label: 'Resultado', index: 9, badge: 'resultado' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => !cell || cell.trim() === '');
}

function looksLikeHeaderRow(row: string[], columns: ColumnDef[]): boolean {
  // If the first cell contains the expected header name (e.g. "Fecha"),
  // treat this row as a header that should be skipped.
  const first = (row[0] || '').toLowerCase().trim();
  if (!first) return false;
  const expected = columns[0]?.label.toLowerCase().trim() ?? '';
  if (!expected) return false;
  return first === expected || first.startsWith('fecha');
}

function formatCurrency(raw: string): string {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function severityBadge(value: string): { bg: string; text: string; ring: string } {
  const v = value.toLowerCase();
  if (v.includes('alta') || v.includes('crítica') || v.includes('critica')) {
    return { bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30' };
  }
  if (v.includes('media') || v.includes('moderad')) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  }
  if (v.includes('baja') || v.includes('leve')) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-300', ring: 'ring-slate-500/30' };
}

function statusBadge(value: string): { bg: string; text: string; ring: string } {
  const v = value.toLowerCase();
  if (v.includes('activ') || v.includes('pagad') || v.includes('cerrad') || v.includes('complet')) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  }
  if (v.includes('pend') || v.includes('progres') || v.includes('abiert')) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  }
  if (v.includes('cancel') || v.includes('rechaz') || v.includes('falla')) {
    return { bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30' };
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-300', ring: 'ring-slate-500/30' };
}

function resultadoBadge(value: string): { bg: string; text: string; ring: string } {
  const v = value.toLowerCase();
  if (v.includes('aprob') || v.includes('ok') || v.includes('pas')) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  }
  if (v.includes('condic') || v.includes('observ')) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  }
  if (v.includes('rechaz') || v.includes('falla') || v.includes('no')) {
    return { bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30' };
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-300', ring: 'ring-slate-500/30' };
}

function downloadCSV(filename: string, columns: ColumnDef[], rows: string[][]) {
  const escape = (s: string) => {
    const needsQuotes = /[",\n]/.test(s);
    const v = s.replace(/"/g, '""');
    return needsQuotes ? `"${v}"` : v;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escape(r[c.index] ?? '')).join(','))
    .join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────────

type TabCache = Record<string, string[][]>;

type EditingCell = { rowIndex: number; colIndex: number; value: string } | null;
type SavingCell = { rowIndex: number; colIndex: number } | null;
type FlashCell = { rowIndex: number; colIndex: number; type: 'success' | 'error' } | null;

export default function DataManagerPage() {
  const [activeId, setActiveId] = useState<string>(COLLECTIONS[0].id);
  const [cache, setCache] = useState<TabCache>({});
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [savingCell, setSavingCell] = useState<SavingCell>(null);
  const [flashCell, setFlashCell] = useState<FlashCell>(null);
  const [toast, setToast] = useState<string | null>(null);

  const active = useMemo(
    () => COLLECTIONS.find((c) => c.id === activeId) ?? COLLECTIONS[0],
    [activeId]
  );

  const loadTab = useCallback(async (collection: Collection) => {
    setLoadingTabs((prev) => ({ ...prev, [collection.id]: true }));
    setErrors((prev) => ({ ...prev, [collection.id]: null }));
    try {
      const rows = await readRange(collection.tab);
      setCache((prev) => ({ ...prev, [collection.id]: rows }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos';
      setErrors((prev) => ({ ...prev, [collection.id]: msg }));
    } finally {
      setLoadingTabs((prev) => ({ ...prev, [collection.id]: false }));
    }
  }, []);

  // Lazy-load the active tab the first time it becomes active
  useEffect(() => {
    if (cache[active.id] === undefined && !loadingTabs[active.id] && !errors[active.id]) {
      loadTab(active);
    }
  }, [active, cache, loadingTabs, errors, loadTab]);

  // Reset search and editing when switching tabs
  useEffect(() => {
    setSearch('');
    setEditingCell(null);
    setSavingCell(null);
    setFlashCell(null);
  }, [activeId]);

  // Clean rows: drop empties and any header row
  const cleanRows = useMemo(() => {
    const raw = cache[active.id];
    if (!raw) return [];
    const filtered = raw.filter((row) => !isRowEmpty(row));
    if (filtered.length > 0 && looksLikeHeaderRow(filtered[0], active.columns)) {
      return filtered.slice(1);
    }
    return filtered;
  }, [cache, active]);

  // Filtered by search (client-side, instant)
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cleanRows;
    return cleanRows.filter((row) =>
      row.some((cell) => (cell || '').toLowerCase().includes(q))
    );
  }, [cleanRows, search]);

  const isLoading = !!loadingTabs[active.id];
  const error = errors[active.id];
  const loadedRowCounts = (id: string): number | null => {
    const raw = cache[id];
    if (!raw) return null;
    const filtered = raw.filter((r) => !isRowEmpty(r));
    const body =
      filtered.length > 0 &&
      looksLikeHeaderRow(filtered[0], COLLECTIONS.find((c) => c.id === id)!.columns)
        ? filtered.slice(1)
        : filtered;
    return body.length;
  };

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`${active.id}-${stamp}.csv`, active.columns, visibleRows);
  }

  function handleCellClick(rowIndex: number, colIndex: number, value: string) {
    // Block if already saving this cell or a different cell is being edited
    if (savingCell) return;
    setEditingCell({ rowIndex, colIndex, value });
  }

  function handleCellChange(value: string) {
    setEditingCell((prev) => (prev ? { ...prev, value } : prev));
  }

  function handleCellCancel() {
    setEditingCell(null);
  }

  async function handleCellSave(rowIndex: number, colIndex: number, newValue: string) {
    const sourceRow = visibleRows[rowIndex];
    if (!sourceRow) {
      setEditingCell(null);
      return;
    }
    const targetCol = active.columns[colIndex];
    const originalValue = sourceRow[targetCol.index] ?? '';

    if (newValue === originalValue) {
      setEditingCell(null);
      return;
    }

    // Find key column (sticky col or col index 0)
    const keyCol = active.columns.find((c) => c.sticky) ?? active.columns[0];
    const keyValue = sourceRow[keyCol.index];
    if (!keyValue) {
      setEditingCell(null);
      return;
    }

    // Build the updated full row (pad to accommodate targetCol.index if needed)
    const updatedRow = [...sourceRow];
    while (updatedRow.length <= targetCol.index) {
      updatedRow.push('');
    }
    updatedRow[targetCol.index] = newValue;

    setEditingCell(null);
    setSavingCell({ rowIndex, colIndex });

    try {
      await upsertRow(active.tab, keyValue, updatedRow);
      // Update cache: replace the matching row (by key) in the raw cache
      setCache((prev) => {
        const tabRows = prev[active.id];
        if (!tabRows) return prev;
        const nextRows = tabRows.map((r) => {
          if ((r[keyCol.index] ?? '') === keyValue) return updatedRow;
          return r;
        });
        return { ...prev, [active.id]: nextRows };
      });
      setFlashCell({ rowIndex, colIndex, type: 'success' });
      setTimeout(() => setFlashCell(null), 1000);
    } catch (err: unknown) {
      setFlashCell({ rowIndex, colIndex, type: 'error' });
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setToast(msg);
      setTimeout(() => setFlashCell(null), 1000);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSavingCell(null);
    }
  }

  return (
    <div className="-mx-4 -my-0 min-h-full bg-[#F1F5F9] text-[#1A2B2B]">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2 mb-1">
          <Database size={20} className="text-[#162252]" />
          <h1 className="text-xl font-bold tracking-tight">Gestor de Datos</h1>
        </div>
        <p className="text-xs text-[#6B7280]">
          Tu reemplazo para Airtable · Explora, filtra y exporta cada colección de la flota
        </p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-[80px] z-10 bg-[#F1F5F9]/95 backdrop-blur border-b border-[#E5E7EB]">
        <div className="flex overflow-x-auto no-scrollbar">
          {COLLECTIONS.map((col) => {
            const isActive = col.id === active.id;
            const count = loadedRowCounts(col.id);
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setActiveId(col.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[#162252]'
                    : 'text-[#6B7280] hover:text-[#1A2B2B]'
                }`}
              >
                <span className="text-base leading-none">{col.icon}</span>
                <span>{col.label}</span>
                {count !== null && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${
                      isActive
                        ? 'bg-[#162252]/10 text-[#162252] ring-[#162252]/30'
                        : 'bg-[#E5E7EB] text-[#6B7280] ring-[#D1D5DB]'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-t-full bg-[#162252]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[#E5E7EB]">
        <div className="flex-1 relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar en ${active.label.toLowerCase()}…`}
            className="w-full bg-white border border-[#E5E7EB] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1A2B2B] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#162252]/30 focus:border-[#162252]/50"
          />
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#6B7280] px-2">
          <span className="font-mono font-semibold text-[#162252]">
            {visibleRows.length}
          </span>
          <span>registros</span>
          {search && cleanRows.length !== visibleRows.length && (
            <span className="text-[#9CA3AF]">/ {cleanRows.length}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => loadTab(active)}
          disabled={isLoading}
          title="Recargar"
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#162252] hover:border-[#162252]/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>

        <button
          type="button"
          onClick={handleExport}
          disabled={visibleRows.length === 0}
          title="Exportar CSV"
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#162252] text-white text-xs font-semibold hover:bg-[#1E3A8A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          <span className="hidden sm:inline">Exportar CSV</span>
        </button>
      </div>

      {/* ── Mobile row count ──────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pt-2 text-xs text-[#6B7280]">
        <span className="font-mono font-semibold text-[#162252]">
          {visibleRows.length}
        </span>{' '}
        registros
        {search && cleanRows.length !== visibleRows.length && (
          <span className="text-[#9CA3AF]"> de {cleanRows.length}</span>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        {error ? (
          <ErrorState message={error} onRetry={() => loadTab(active)} />
        ) : isLoading && !cache[active.id] ? (
          <SkeletonTable columns={active.columns} />
        ) : visibleRows.length === 0 ? (
          <EmptyState message={search ? 'Sin resultados para tu búsqueda' : active.emptyMessage} />
        ) : (
          <DataTable
            columns={active.columns}
            rows={visibleRows}
            editingCell={editingCell}
            savingCell={savingCell}
            flashCell={flashCell}
            onCellClick={handleCellClick}
            onCellChange={handleCellChange}
            onCellSave={handleCellSave}
            onCellCancel={handleCellCancel}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1A2B2B] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg max-w-xs text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface DataTableProps {
  columns: ColumnDef[];
  rows: string[][];
  editingCell: EditingCell;
  savingCell: SavingCell;
  flashCell: FlashCell;
  onCellClick: (rowIndex: number, colIndex: number, value: string) => void;
  onCellChange: (value: string) => void;
  onCellSave: (rowIndex: number, colIndex: number, value: string) => void;
  onCellCancel: () => void;
}

function DataTable({
  columns,
  rows,
  editingCell,
  savingCell,
  flashCell,
  onCellClick,
  onCellChange,
  onCellSave,
  onCellCancel,
}: DataTableProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#F8FAFC]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{ minWidth: col.minWidth }}
                  className={[
                    'px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-[#162252]',
                    'border-b-2 border-[#162252]/20',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.sticky ? 'sticky left-0 bg-[#F8FAFC] z-20 border-r border-[#E5E7EB]' : '',
                    col.hideOnMobile ? 'hidden md:table-cell' : '',
                  ].join(' ')}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`group transition-colors ${
                  ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                } hover:bg-[#EFF6FF]`}
              >
                {columns.map((col, ci) => {
                  const raw = row[col.index] ?? '';
                  const isEditable = !col.sticky && !col.badge;
                  const isEditing =
                    editingCell?.rowIndex === ri && editingCell?.colIndex === ci;
                  const isSaving =
                    savingCell?.rowIndex === ri && savingCell?.colIndex === ci;
                  const flash =
                    flashCell?.rowIndex === ri && flashCell?.colIndex === ci
                      ? flashCell.type
                      : null;

                  // Background classes for flash state
                  let flashClass = '';
                  if (flash === 'success') {
                    flashClass = 'bg-[#F0FDF4] ring-1 ring-inset ring-[#16A34A]';
                  } else if (flash === 'error') {
                    flashClass = 'bg-[#FEF2F2] ring-1 ring-inset ring-[#DC2626]';
                  }

                  const baseClasses = [
                    'relative px-3 py-2.5 text-[#1A2B2B] border-b border-[#F3F4F6] whitespace-nowrap transition-colors',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.mono ? 'font-mono text-[13px]' : '',
                    col.sticky
                      ? `sticky left-0 z-[1] border-r border-[#E5E7EB] font-medium text-[#1A2B2B] ${
                          ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                        } group-hover:bg-[#EFF6FF]`
                      : '',
                    col.hideOnMobile ? 'hidden md:table-cell' : '',
                    isEditable && !isEditing && !isSaving
                      ? 'cursor-pointer hover:bg-[#EFF6FF] hover:ring-1 hover:ring-inset hover:ring-[#162252]/30'
                      : '',
                    isEditing
                      ? 'bg-white ring-2 ring-inset ring-[#162252] shadow-sm'
                      : '',
                    flashClass,
                  ].join(' ');

                  if (isEditing && editingCell) {
                    return (
                      <td key={ci} className={baseClasses}>
                        <EditableInput
                          value={editingCell.value}
                          align={col.align}
                          mono={col.mono}
                          onChange={onCellChange}
                          onSave={(v) => onCellSave(ri, ci, v)}
                          onCancel={onCellCancel}
                        />
                      </td>
                    );
                  }

                  if (isSaving) {
                    return (
                      <td key={ci} className={baseClasses}>
                        <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-xs">{raw || '—'}</span>
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={ci}
                      className={`group/cell ${baseClasses}`}
                      onClick={
                        isEditable
                          ? () => onCellClick(ri, ci, raw)
                          : undefined
                      }
                    >
                      {renderCell(raw, col)}
                      {isEditable && (
                        <Pencil
                          size={11}
                          className="absolute top-1 right-1 text-[#162252]/60 opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface EditableInputProps {
  value: string;
  align?: ColumnAlign;
  mono?: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function EditableInput({
  value,
  align,
  mono,
  onChange,
  onSave,
  onCancel,
}: EditableInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isLongText = value.length > 40;

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      if ('select' in el) el.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseClasses = [
    'w-full border-0 outline-none bg-transparent text-[#1A2B2B] text-sm p-0',
    align === 'right' ? 'text-right' : 'text-left',
    mono ? 'font-mono text-[13px]' : '',
  ].join(' ');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave((e.target as HTMLInputElement | HTMLTextAreaElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  if (isLongText) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${baseClasses} resize-none`}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onSave(e.target.value)}
      onKeyDown={handleKeyDown}
      className={baseClasses}
    />
  );
}

function renderCell(raw: string, col: ColumnDef) {
  if (!raw) {
    return <span className="text-[#9CA3AF]">—</span>;
  }
  if (col.currency) {
    return <span className="text-[#1A2B2B]">{formatCurrency(raw)}</span>;
  }
  if (col.badge === 'severity') {
    const style = severityBadge(raw);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
      >
        {raw}
      </span>
    );
  }
  if (col.badge === 'status') {
    const style = statusBadge(raw);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
      >
        {raw}
      </span>
    );
  }
  if (col.badge === 'resultado') {
    const style = resultadoBadge(raw);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
      >
        {raw}
      </span>
    );
  }
  return raw;
}

function SkeletonTable({ columns }: { columns: ColumnDef[] }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-[#162252] border-b-2 border-[#162252]/20 text-left ${
                    col.hideOnMobile ? 'hidden md:table-cell' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, ri) => (
              <tr
                key={ri}
                className={ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-3 border-b border-[#E5E7EB] ${
                      col.hideOnMobile ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    <div
                      className="h-3 rounded bg-[#E5E7EB] animate-pulse"
                      style={{ width: `${40 + ((ri * 7 + ci * 13) % 50)}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#9CA3AF] border-t border-[#E5E7EB]">
        <Loader2 size={13} className="animate-spin" />
        Cargando datos…
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white py-16 flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-[#162252]/10 flex items-center justify-center ring-1 ring-[#162252]/20">
        <Database size={20} className="text-[#162252]" />
      </div>
      <p className="text-sm text-[#6B7280]">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 py-12 flex flex-col items-center gap-3 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/30">
        <AlertCircle size={20} className="text-red-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-red-400">Error al cargar</p>
        <p className="text-xs text-[#6B7280] mt-1 max-w-sm break-words">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#162252] text-white text-xs font-semibold hover:bg-[#1E3A8A] transition-colors"
      >
        <RefreshCw size={13} />
        Reintentar
      </button>
    </div>
  );
}
