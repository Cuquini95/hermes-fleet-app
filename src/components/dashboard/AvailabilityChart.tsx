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
  loading?: boolean;
}

export default function AvailabilityChart({ data, loading = false }: AvailabilityChartProps) {
  const hasData = data.length > 0 && data.some((point) => point.total && point.total > 0);

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-4">
        Referencia mecánica · últimos 7 días
      </h3>
      <p className="mb-3 text-xs text-text-secondary">Estimación según averías abiertas y estado actual. Las restricciones de despacho se consultan por separado.</p>
      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-secondary">
          {loading ? 'Cargando disponibilidad…' : 'Disponibilidad sin datos'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#6B7280', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#6B7280', fontSize: 12 }}
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
                  'Disponibilidad mecánica estimada',
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
