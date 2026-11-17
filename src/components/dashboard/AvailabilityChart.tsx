import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  day: string;
  pct: number;
  unavailable?: number;
  total?: number;
}

interface AvailabilityChartProps {
  data: ChartPoint[];
}

export default function AvailabilityChart({ data }: AvailabilityChartProps) {
  const hasData = data.length > 0 && data.some((point) => point.total && point.total > 0);

  return (
    <div className="w-full min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <h3 className="font-semibold text-text mb-4">
        Disponibilidad · últimos 7 días
      </h3>
      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-secondary">
          Cargando disponibilidad real...
        </div>
      ) : (
        <ResponsiveContainer width="100%" minWidth={0} height={200}>
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 2 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#6B7280', fontSize: 11 }}
              tickMargin={6}
              minTickGap={4}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              width={38}
              tick={{ fill: '#6B7280', fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const payload = item.payload as ChartPoint;
                const unavailable = payload.unavailable ?? 0;
                const total = payload.total ?? 0;
                const available = Math.max(0, total - unavailable);
                return [
                  `${value}%${total ? ` (${available}/${total} disponibles)` : ''}`,
                  'Disponibilidad',
                ];
              }}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="pct"
              stroke="#16A34A"
              strokeWidth={2}
              dot={{ r: 4, fill: '#16A34A', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
