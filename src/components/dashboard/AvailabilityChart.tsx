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
}

const DEFAULT_DATA: ChartPoint[] = [
  { day: 'Lun', pct: 88 },
  { day: 'Mar', pct: 91 },
  { day: 'Mié', pct: 88 },
  { day: 'Jue', pct: 85 },
  { day: 'Vie', pct: 91 },
  { day: 'Sáb', pct: 92 },
  { day: 'Dom', pct: 88 },
];

interface AvailabilityChartProps {
  data?: ChartPoint[];
}

export default function AvailabilityChart({ data = DEFAULT_DATA }: AvailabilityChartProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-4">
        Tendencia de Disponibilidad — 7 días
      </h3>
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
            domain={[75, 100]}
            tick={{ fill: '#6B7280', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Disponibilidad']}
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
    </div>
  );
}
