import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Plus,
  RefreshCw,
  Receipt,
  TrendingUp,
  Truck,
  Wrench,
  Fuel,
  Package,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useGastosStore } from '../stores/gastos-store';
import type { GastoCompra } from '../stores/gastos-store';

// ── Colour palette ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Refaccion:   '#F59E0B',
  Combustible: '#3B82F6',
  Servicio:    '#8B5CF6',
  Otro:        '#6B7280',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Refaccion:   <Wrench  size={14} />,
  Combustible: <Fuel    size={14} />,
  Servicio:    <Package size={14} />,
  Otro:        <Receipt size={14} />,
};

// ── Helper: current month label ───────────────────────────────────────────────

function currentMonthLabel(): string {
  return new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' });
}

// ── Filter gastos to current month ───────────────────────────────────────────

function thisMonth(gastos: GastoCompra[]): GastoCompra[] {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return gastos.filter((g) => g.fecha.startsWith(ym) && g.status === 'Aprobado');
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
    .slice(0, 8);
}

function byType(gastos: GastoCompra[]) {
  const map: Record<string, number> = {};
  for (const g of gastos) {
    map[g.tipo] = (map[g.tipo] || 0) + g.total;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

// ── Currency formatter ────────────────────────────────────────────────────────

const mxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'detalle';

export default function GastosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const { gastos, loading, fetched, fetchGastos } = useGastosStore();

  const [tab, setTab] = useState<Tab>('resumen');

  const canCreate = role === 'gerencia' || role === 'supervisor' ||
                    role === 'jefe_taller' || role === 'coordinador';

  useEffect(() => {
    if (!fetched) fetchGastos();
  }, [fetched, fetchGastos]);

  const monthly = thisMonth(gastos);
  const totalMes = monthly.reduce((s, g) => s + g.total, 0);
  const unitData = byUnit(monthly);
  const typeData = byType(monthly);

  return (
    <div className="flex flex-col py-4 gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Gastos</h1>
          <p className="text-text-secondary text-sm capitalize">{currentMonthLabel()}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => useGastosStore.setState({ fetched: false })}
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
          {/* By type — donut */}
          {typeData.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <p className="text-sm font-semibold text-text mb-3">Por Tipo</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={55}
                      dataKey="value"
                      stroke="none"
                    >
                      {typeData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={TYPE_COLORS[entry.name] ?? '#6B7280'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => mxn(Number(v))}
                      contentStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {typeData.map((d) => {
                    const pct = totalMes > 0 ? ((d.value / totalMes) * 100).toFixed(0) : '0';
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <span style={{ color: TYPE_COLORS[d.name] ?? '#6B7280' }}>
                          {TYPE_ICONS[d.name]}
                        </span>
                        <span className="text-xs text-text flex-1">{d.name}</span>
                        <span className="text-xs font-semibold text-text">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* By unit — bar chart */}
          {unitData.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <p className="text-sm font-semibold text-text mb-3">
                <Truck size={14} className="inline mr-1" />
                Por Unidad
              </p>
              <ResponsiveContainer width="100%" height={unitData.length * 36 + 20}>
                <BarChart
                  data={unitData}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                  <Tooltip formatter={(v) => mxn(Number(v))} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
          {gastos.slice().reverse().map((g) => (
            <GastoRow key={g.gasto_id} gasto={g} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── GastoRow ──────────────────────────────────────────────────────────────────

function GastoRow({ gasto }: { gasto: GastoCompra }) {
  const color = TYPE_COLORS[gasto.tipo] ?? '#6B7280';
  const statusColor =
    gasto.status === 'Aprobado' ? 'text-success' :
    gasto.status === 'Rechazado' ? 'text-red-500' :
    'text-amber';

  return (
    <div className="bg-white rounded-xl border border-border p-3 shadow-sm flex items-center gap-3">
      {/* Type colour dot */}
      <div
        className="w-3 rounded-full self-stretch"
        style={{ backgroundColor: color, minWidth: 4, maxWidth: 4 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{gasto.proveedor || '—'}</p>
        <p className="text-xs text-text-secondary">
          {gasto.unidad} · {gasto.fecha}
        </p>
        <p className="text-xs text-text-secondary">{gasto.tipo}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-text">{mxn(gasto.total)}</p>
        <p className={`text-xs font-medium ${statusColor}`}>{gasto.status}</p>
      </div>
    </div>
  );
}
