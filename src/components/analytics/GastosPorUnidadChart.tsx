// src/components/analytics/GastosPorUnidadChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { UnitMetrics } from './analyticsUtils'
import { formatPeso } from './analyticsUtils'

interface GastosPorUnidadChartProps {
  units: UnitMetrics[]
}

export default function GastosPorUnidadChart({ units }: GastosPorUnidadChartProps) {
  if (units.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 flex items-center justify-center h-40">
        <p className="text-[#475569] text-sm">Sin datos para este período</p>
      </div>
    )
  }

  const data = units.map(u => ({ unit: u.unit, gastos: Math.round(u.gastos) }))

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-3">
        Gastos por Unidad
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="unit"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => [formatPeso(value), 'Gastos']}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="gastos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
