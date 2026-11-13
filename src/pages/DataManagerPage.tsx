import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  Database,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { readRange } from '../lib/sheets-api';
import { useAnalyticsStore } from '../stores/analyticsStore';
import AnalyticsModal from '../components/analytics/AnalyticsModal';
import PanamaSourceRecords from '../components/workshop/PanamaSourceRecords';
import { useAuthStore } from '../stores/auth-store';

// ── Collection definitions ───────────────────────────────────────────────────

type ColumnAlign = 'left' | 'right' | 'center';

interface ColumnDef {
  label: string;
  index: number;          // source column index from sheets
  align?: ColumnAlign;
  mono?: boolean;         // monospace font (numbers / codes)
  currency?: boolean;     // format as USD currency
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

const COLLECTIONS: [Collection, ...Collection[]] = [
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
    // Sheet cols: #(0) FECHA(1) HORA(2) UNIDAD(3) OPERADOR(4) TIPO(5) LITROS(6)
    //             COSTO(7) HOROMETRO(8) KM(9) RENDIMIENTO(10) ESTACION(11) OBSERVACIONES(12)
    columns: [
      { label: 'Fecha',        index: 1, sticky: true, minWidth: '110px' },
      { label: 'Hora',         index: 2, mono: true, hideOnMobile: true, minWidth: '70px' },
      { label: 'Unidad',       index: 3, mono: true, minWidth: '90px' },
      { label: 'Operador',     index: 4, minWidth: '140px' },
      { label: 'Tipo Comb',    index: 5, hideOnMobile: true },
      { label: 'Litros',       index: 6, align: 'right', mono: true },
      { label: 'Costo',        index: 7, align: 'right', mono: true, currency: true },
      { label: 'Horóm',        index: 8, align: 'right', mono: true, hideOnMobile: true },
      { label: 'KM',           index: 9, align: 'right', mono: true, hideOnMobile: true },
      { label: 'Rendimiento',  index: 10, align: 'right', mono: true, hideOnMobile: true },
      { label: 'Estación',     index: 11, hideOnMobile: true, minWidth: '130px' },
      { label: 'Observaciones',index: 12, hideOnMobile: true, minWidth: '160px' },
    ],
  },
  {
    id: 'gastos',
    icon: '💰',
    label: 'Gastos',
    tab: '02 Gastos',
    emptyMessage: 'Aún no hay gastos registrados',
    columns: [
      { label: 'Fecha',       index: 1, sticky: true, minWidth: '110px' },
      { label: 'ID Gasto',    index: 0, mono: true, hideOnMobile: true },
      { label: 'Hora',        index: 2, hideOnMobile: true, minWidth: '70px' },
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
      { label: 'Status',      index: 16, badge: 'status' },
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
      { label: 'OT',          index: 13, mono: true, hideOnMobile: true },
      { label: 'Unidad',      index: 2, mono: true, minWidth: '90px' },
      { label: 'Tipo',        index: 3, hideOnMobile: true },
      { label: 'Descripción', index: 4, minWidth: '200px' },
      { label: 'Severidad',   index: 5, badge: 'severity' },
      { label: 'Reportó',     index: 6, hideOnMobile: true },
      { label: 'Estado',      index: 9, badge: 'status' },
    ],
  },
  {
    id: 'ot',
    icon: '🔧',
    label: 'Órdenes de Trabajo',
    tab: 'ORDENES_TRABAJO',
    emptyMessage: 'No hay órdenes de trabajo',
    columns: [
      { label: 'Fecha',       index: 2, sticky: true, minWidth: '110px' },
      { label: 'OT ID',       index: 1, mono: true },
      { label: 'Unidad',      index: 3, mono: true, minWidth: '90px' },
      { label: 'Tipo',        index: 4, hideOnMobile: true },
      { label: 'Descripción', index: 5, minWidth: '200px' },
      { label: 'Severidad',   index: 6, badge: 'severity' },
      { label: 'Técnico',     index: 8, hideOnMobile: true },
      { label: 'Estado',      index: 9, badge: 'status' },
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
    // Sheet cols: #(0) FECHA(1) HORA(2) CAMION(3) CONDUCTOR(4) RUTA ORIGEN(5)
    //             RUTA DESTINO(6) KM CARGADO(7) KM VACIO(8) KM TOTAL(9)
    //             MATERIAL(10) TONELAJE(11) OBSERVACIONES(12)
    columns: [
      { label: 'Fecha',         index: 1, sticky: true, minWidth: '110px' },
      { label: 'Hora',          index: 2, mono: true, hideOnMobile: true },
      { label: 'Unidad',        index: 3, mono: true, minWidth: '90px' },
      { label: 'Conductor',     index: 4, minWidth: '140px' },
      { label: 'Origen',        index: 5, hideOnMobile: true, minWidth: '130px' },
      { label: 'Destino',       index: 6, minWidth: '130px' },
      { label: 'KM Carg',       index: 7, align: 'right', mono: true, hideOnMobile: true },
      { label: 'KM Vac',        index: 8, align: 'right', mono: true, hideOnMobile: true },
      { label: 'KM Total',      index: 9, align: 'right', mono: true },
      { label: 'Material',      index: 10, hideOnMobile: true },
      { label: 'Tonelaje',      index: 11, align: 'right', mono: true },
      { label: 'Observaciones', index: 12, hideOnMobile: true, minWidth: '200px' },
    ],
  },
  {
    id: 'inspecciones',
    icon: '📋',
    label: 'Inspecciones',
    tab: '14 Inspecciones',
    emptyMessage: 'Aún no hay inspecciones registradas',
    // Sheet cols: #(0) INSP_ID(1) FECHA(2) HORA(3) CODIGO UNIDAD(4) MODELO(5)
    //             OPERADOR(6) TIPO(7) HOROMETRO(8) ...checks... SCORE(N-3) RESULTADO(N-2)
    columns: [
      { label: 'Fecha',     index: 2, sticky: true, minWidth: '110px' },
      { label: 'Hora',      index: 3, mono: true, hideOnMobile: true },
      { label: 'Folio',     index: 1, mono: true, hideOnMobile: true },
      { label: 'Unidad',    index: 4, mono: true, minWidth: '90px' },
      { label: 'Modelo',    index: 5, hideOnMobile: true, minWidth: '130px' },
      { label: 'Operador',  index: 6, minWidth: '140px' },
      { label: 'Tipo Insp', index: 7, hideOnMobile: true },
      { label: 'Horómetro', index: 8, align: 'right', mono: true, hideOnMobile: true },
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
  const first = (row[columns[0]?.index ?? 0] || '').toLowerCase().trim();
  if (!first) return false;
  const expected = columns[0]?.label.toLowerCase().trim() ?? '';
  if (!expected) return false;
  return first === expected || first.startsWith('fecha');
}

function recordRows(rows: string[][], collection: Collection, isPanama: boolean): string[][] {
  if (isPanama) return rows.slice(collection.id === 'combustible' ? 2 : 1).filter(row => !isRowEmpty(row));
  const filtered = rows.filter(row => !isRowEmpty(row));
  return filtered[0] && looksLikeHeaderRow(filtered[0], collection.columns) ? filtered.slice(1) : filtered;
}

function formatCurrency(raw: string): string {
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'USD',
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

function buildTSV(columns: ColumnDef[], rows: string[][]): string {
  const header = columns.map((c) => c.label).join('\t');
  const body = rows
    .map((r) => columns.map((c) => (r[c.index] ?? '').replace(/\t/g, ' ')).join('\t'))
    .join('\n');
  return `${header}\n${body}`;
}

// ── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type TabCache = Record<string, string[][]>;

export default function DataManagerPage() {
  const userId = useAuthStore(state => state.userId);
  const project = useAuthStore(state => state.project);
  return <DataManager key={`${project}:${userId}`} isPanama={project === 'tmf-panama'} />;
}

function DataManager({ isPanama }: { isPanama: boolean }) {
  const [activeId, setActiveId] = useState<string>(() => isPanama ? 'averias' : COLLECTIONS[0].id);
  const [cache, setCache] = useState<TabCache>({});
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requests = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const activeRequests = requests.current;
    return () => { for (const request of activeRequests.values()) request.abort(); activeRequests.clear(); };
  }, []);

  const active: Collection = useMemo(
    () => {
      const collection = COLLECTIONS.find((c) => c.id === activeId) ?? COLLECTIONS[0];
      if (!isPanama || collection.id !== 'gastos') return collection;
      return { ...collection, columns: collection.columns.map(column => ({ ...column,
        label: ({ RFC: 'RUC', IVA: 'ITBMS', Status: 'Estado' } as Record<string, string>)[column.label] ?? column.label,
      })) };
    },
    [activeId, isPanama]
  );

  const loadTab = useCallback(async (collection: Collection) => {
    requests.current.get(collection.id)?.abort();
    const controller = new AbortController();
    requests.current.set(collection.id, controller);
    setLoadingTabs((prev) => ({ ...prev, [collection.id]: true }));
    setErrors((prev) => ({ ...prev, [collection.id]: null }));
    try {
      const rows = await readRange(collection.tab, controller.signal, undefined, 0);
      if (!controller.signal.aborted) setCache((prev) => ({ ...prev, [collection.id]: rows }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos';
      if (!controller.signal.aborted) setErrors((prev) => ({ ...prev, [collection.id]: msg }));
    } finally {
      if (!controller.signal.aborted) {
        requests.current.delete(collection.id);
        setLoadingTabs((prev) => ({ ...prev, [collection.id]: false }));
      }
    }
  }, []);

  // Lazy-load the active tab the first time it becomes active
  useEffect(() => {
    if (cache[active.id] === undefined && !loadingTabs[active.id] && !errors[active.id]) {
      loadTab(active);
    }
  }, [active, cache, loadingTabs, errors, loadTab]);

  // Reset search and pagination when switching tabs
  useEffect(() => {
    setSearch('');
    setDisplayLimit(PAGE_SIZE);
  }, [activeId]);

  // Reset pagination when search changes
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [search]);

  // Clean rows: drop empties and any header row
  const cleanRows = useMemo(() => {
    const raw = cache[active.id];
    return raw ? recordRows(raw, active, isPanama) : [];
  }, [cache, active, isPanama]);

  // Filtered by search (client-side, instant)
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cleanRows;
    return cleanRows.filter((row) =>
      row.some((cell) => (cell || '').toLowerCase().includes(q))
    );
  }, [cleanRows, search]);

  // Page the visible rows — only show the first `displayLimit` rows
  const pagedRows = useMemo(
    () => visibleRows.slice(0, displayLimit),
    [visibleRows, displayLimit],
  );
  const hasMore = visibleRows.length > displayLimit;

  // IntersectionObserver: load next page when sentinel enters viewport.
  // hasMore is included in deps so the observer is (re-)attached the moment the
  // sentinel first renders after data loads (the mount run sees sentinel=null and
  // returns early; without hasMore in deps the effect would never re-run for it).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayLimit((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayLimit, activeId, search, hasMore]);

  const isLoading = !!loadingTabs[active.id];
  const error = errors[active.id];
  const verified = !!cache[active.id] && !error && !isLoading;
  const master = !isPanama ? null : active.id === 'averias' ? 'failures' : active.id === 'ot' ? 'orders' : null;
  const loadedRowCounts = (id: string): number | null => {
    const raw = cache[id];
    if (!raw || errors[id]) return null;
    const coll = COLLECTIONS.find((c) => c.id === id);
    return coll ? recordRows(raw, coll, isPanama).length : null;
  };

  async function handleCopy() {
    if (visibleRows.length === 0) return;
    const tsv = buildTSV(active.columns, visibleRows);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`${active.id}-${stamp}.csv`, active.columns, visibleRows);
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
          Consulta, filtra y exporta registros. Para corregir un registro, abre el módulo donde se capturó.
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
                <span className="text-base leading-none" aria-hidden="true">{col.icon}</span>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
        <div className="relative min-w-0 basis-full sm:flex-1">
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
            {verified ? visibleRows.length : '—'}
          </span>
          <span>registros</span>
          {verified && search && cleanRows.length !== visibleRows.length && (
            <span className="text-[#9CA3AF]">/ {cleanRows.length}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => loadTab(active)}
          disabled={isLoading}
          title="Recargar datos"
          aria-label="Recargar datos"
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#162252] hover:border-[#162252]/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!verified || visibleRows.length === 0}
          title="Copiar para Excel"
          aria-label="Copiar tabla para Excel"
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#E5E7EB] bg-white text-[#162252] text-xs font-semibold hover:bg-[#F1F5F9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? <Check size={14} className="text-green-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span className="hidden sm:inline">{copied ? '¡Copiado!' : 'Copiar'}</span>
        </button>

        <button
          type="button"
          onClick={handleExport}
          disabled={!verified || visibleRows.length === 0}
          title="Exportar CSV"
          aria-label="Exportar como CSV"
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#162252] text-white text-xs font-semibold hover:bg-[#1E3A8A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </button>

        <button
          type="button"
          onClick={() => { setAnalyticsOpen(true); void useAnalyticsStore.getState().fetch(); }}
          disabled={!verified}
          aria-label="Abrir analítica"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-40"
        >
          <span aria-hidden="true">📊</span> Analítica
        </button>
      </div>

      {/* ── Mobile row count ──────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pt-2 text-xs text-[#6B7280]">
        <span className="font-mono font-semibold text-[#162252]">
          {verified ? visibleRows.length : '—'}
        </span>{' '}
        registros
        {verified && search && cleanRows.length !== visibleRows.length && (
          <span className="text-[#9CA3AF]"> de {cleanRows.length}</span>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        {error ? (
          <ErrorState message={error} onRetry={() => loadTab(active)} />
        ) : !cache[active.id] ? (
          <SkeletonTable columns={active.columns} />
        ) : visibleRows.length === 0 ? (
          <EmptyState message={search ? 'Sin resultados para tu búsqueda' : master ? 'Sin registros de Hermes en esta categoría.' : active.emptyMessage} />
        ) : (
          <>
            <DataTable columns={active.columns} rows={pagedRows} />
            {/* Infinite scroll sentinel — visible when user scrolls near the bottom */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center items-center py-4 text-xs text-[#6B7280]">
                <Loader2 size={16} className="animate-spin mr-2" />
                Cargando más…
              </div>
            )}
          </>
        )}
        {master && <div className="mt-3"><PanamaSourceRecords key={master} source={master} search={search} /></div>}
      </div>

      <AnalyticsModal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DataTable({ columns, rows }: { columns: ColumnDef[]; rows: string[][] }) {
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
                className={`group transition-colors ${ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}
              >
                {columns.map((col, ci) => {
                  const raw = row[col.index] ?? '';
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
                  ].join(' ');

                  return (
                    <td key={ci} className={baseClasses}>
                      {renderCell(raw, col)}
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
