import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface StockItem {
  partNumber: string;
  description: string;
  oemRef: string;
  stock: number;
  minimum: number;
  status: 'critical' | 'low' | 'ok';
}

const STOCK_ITEMS: StockItem[] = [
  {
    partNumber: 'FLT-HYD-001',
    description: 'Filtro Hidráulico Komatsu',
    oemRef: 'KOM-207-60-71181',
    stock: 0,
    minimum: 4,
    status: 'critical',
  },
  {
    partNumber: 'FREIN-001',
    description: 'Pastillas de Freno CAT 740B',
    oemRef: 'CAT-9W-2620',
    stock: 2,
    minimum: 5,
    status: 'critical',
  },
  {
    partNumber: 'FLT-ACE-002',
    description: 'Filtro Aceite Motor D155',
    oemRef: 'KOM-600-211-5240',
    stock: 3,
    minimum: 6,
    status: 'low',
  },
  {
    partNumber: 'EMP-001',
    description: 'Empaque Cabeza Motor',
    oemRef: 'MACK-21893456',
    stock: 1,
    minimum: 3,
    status: 'low',
  },
  {
    partNumber: 'COR-HYD-003',
    description: 'Correa Alternador Doosan',
    oemRef: 'DOO-K9002983',
    stock: 4,
    minimum: 6,
    status: 'low',
  },
  {
    partNumber: 'NEU-CAM-001',
    description: 'Neumático 23.5R25',
    oemRef: 'BRI-OTR-23525',
    stock: 2,
    minimum: 4,
    status: 'low',
  },
  {
    partNumber: 'ACE-MOT-001',
    description: 'Aceite Motor 15W40 (bidón 5L)',
    oemRef: 'SHELL-RIM-X-15W40',
    stock: 5,
    minimum: 8,
    status: 'low',
  },
  {
    partNumber: 'BAT-24V-001',
    description: 'Batería 24V 170Ah',
    oemRef: 'BOSCH-S5-A08',
    stock: 6,
    minimum: 4,
    status: 'ok',
  },
  {
    partNumber: 'FLT-COM-001',
    description: 'Filtro Combustible Komatsu',
    oemRef: 'KOM-600-311-3750',
    stock: 12,
    minimum: 6,
    status: 'ok',
  },
  {
    partNumber: 'SEL-HYD-001',
    description: 'Sello Cilindro Hidráulico',
    oemRef: 'KOM-707-99-01340',
    stock: 8,
    minimum: 4,
    status: 'ok',
  },
];

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

export default function InventoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');

  const criticalCount = STOCK_ITEMS.filter((i) => i.status === 'critical').length;
  const lowCount = STOCK_ITEMS.filter((i) => i.status === 'low').length;
  const okCount = STOCK_ITEMS.filter((i) => i.status === 'ok').length;

  const filtered =
    filter === 'all'
      ? STOCK_ITEMS
      : STOCK_ITEMS.filter((i) => i.status === filter);

  return (
    <div className="flex flex-col pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Inventario Repuestos</h1>
      </div>

      {/* Summary pills */}
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
          CRÍTICO {criticalCount}
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
          BAJO {lowCount}
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
          OK {okCount}
        </button>
      </div>

      {/* Stock items */}
      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
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
