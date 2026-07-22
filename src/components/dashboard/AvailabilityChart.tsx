import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getAvailabilityChartState,
  type AvailabilityChartPoint,
} from './availability-chart-state';

interface AvailabilityChartProps {
  data: AvailabilityChartPoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function AvailabilityChart({ data, loading = false, error = null, onRetry }: AvailabilityChartProps) {
  const state = getAvailabilityChartState(data, loading, error);

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-4">
        Tendencia de Disponibilidad - 7 dias
      </h3>
      {state !== 'ready' ? (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-secondary">
          {state === 'loading' && 'Cargando disponibilidad real...'}
          {state === 'empty' && 'No hay datos suficientes para construir la tendencia.'}
          {state === 'error' && (
            <div className="text-center" role="alert">
              <p className="text-red-600">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 underline hover:text-text"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}
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
                const payload = item.payload as AvailabilityChartPoint;
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
