import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { parseInventoryRows, type InventoryItem } from '../lib/inventory-rows';

interface StockItem extends InventoryItem {
  status: 'critical' | 'low' | 'ok';
}

type FilterType = 'all' | 'critical' | 'low' | 'ok';

const STATUS_BORDER: Record<StockItem['status'], string> = {
  critical: 'border-l-critical',
  low: 'border-l-amber',
  ok: 'border-l-transparent',
};

const STATUS_BADGE: Record<StockItem['status'], string> = {
  critical: 'bg-red-100 text-critical',
  low: 'bg-amber-100 text-amber',
  ok: 'bg-green-100 text-success',
};

const STATUS_LABEL: Record<StockItem['status'], string> = {
  critical: 'CRÍTICO',
  low: 'BAJO',
  ok: 'OK',
};

function computeStatus(stock: number, minimum: number): StockItem['status'] {
  if (stock === 0 || stock < minimum) return 'critical';
  if (stock < minimum * 1.5) return 'low';
  return 'ok';
}

function parseRows(rows: string[][]): StockItem[] {
  return parseInventoryRows(rows).map((item) => ({
    ...item,
    status: computeStatus(item.stock, item.minimum),
  }));
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border border-l-4 border-l-border p-4 flex items-center gap-3 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-3 w-32 bg-gray-200 rounded" />
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 space-y-1">
        <div className="h-5 w-14 bg-gray-200 rounded-full" />
        <div className="h-7 w-8 bg-gray-200 rounded" />
        <div className="h-3 w-12 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    readRange(SHEET_TABS.INVENTARIO, ctrl.signal)
      .then((rows) => {
        setItems(parseRows(rows));
        setUpdatedAt(new Date());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Error al cargar inventario');
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [retryKey]);

  const criticalCount = items.filter((i) => i.status === 'critical').length;
  const lowCount = items.filter((i) => i.status === 'low').length;
  const okCount = items.filter((i) => i.status === 'ok').length;

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">
          Inventario Repuestos{!loading && items.length > 0 ? ` (${items.length})` : ''}
        </h1>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-text-secondary mb-4 ml-12">
        {loading
          ? 'Cargando…'
          : updatedAt
          ? `Actualizado ${formatTimestamp(updatedAt)}`
          : ''}
      </p>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-critical rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-critical font-medium">{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-critical text-critical text-sm font-semibold shrink-0"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      )}

      {/* Summary pills */}
      {!error && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              filter === 'critical'
                ? 'bg-red-100 border-critical text-critical'
                : 'bg-white border-border text-text-secondary'
            }`}
          >
            <span className="text-base">🔴</span>
            CRÍTICO {loading ? '…' : criticalCount}
          </button>
          <button
            type="button"
            onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              filter === 'low'
                ? 'bg-amber-100 border-amber text-amber'
                : 'bg-white border-border text-text-secondary'
            }`}
          >
            <span className="text-base">🟡</span>
            BAJO {loading ? '…' : lowCount}
          </button>
          <button
            type="button"
            onClick={() => setFilter(filter === 'ok' ? 'all' : 'ok')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              filter === 'ok'
                ? 'bg-green-100 border-success text-success'
                : 'bg-white border-border text-text-secondary'
            }`}
          >
            <span className="text-base">✅</span>
            OK {loading ? '…' : okCount}
          </button>
        </div>
      )}

      {/* Stock items */}
      <div className="flex flex-col gap-3">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-8 text-center">
            <p className="text-text-secondary text-sm">Sin artículos en esta categoría.</p>
          </div>
        )}

        {!loading &&
          !error &&
          filtered.map((item) => (
            <div
              key={item.partNumber}
              className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${STATUS_BORDER[item.status]} p-4 flex items-center gap-3`}
            >
              {/* Left: part info */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs font-semibold text-amber">{item.partNumber}</p>
                <p className="font-medium text-text text-sm mt-0.5">{item.description}</p>
                <p className="text-text-secondary text-xs mt-0.5">{item.oemRef}</p>
              </div>

              {/* Right: stock info */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="text-xl font-bold text-text">{item.stock}</span>
                <span className="text-xs text-text-secondary">Mín: {item.minimum}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
