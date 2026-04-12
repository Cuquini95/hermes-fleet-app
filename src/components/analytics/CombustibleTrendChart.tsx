// src/components/analytics/CombustibleTrendChart.tsx
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import type { WeekPoint } from './analyticsUtils'
import { formatLitros } from './analyticsUtils'

interface CombustibleTrendChartProps {
  data: WeekPoint[]
}

export default function CombustibleTrendChart({ data }: CombustibleTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 flex items-center justify-center h-40">
        <p className="text-[#475569] text-sm">Sin datos para este período</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-3">
        Combustible — Tendencia
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="combustibleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}L`}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => [formatLitros(value), 'Combustible']}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area
            type="monotone"
            dataKey="litros"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#combustibleGradient)"
            dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
