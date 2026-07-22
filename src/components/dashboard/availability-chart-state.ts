export interface AvailabilityChartPoint {
  day: string;
  pct: number;
  unavailable?: number;
  total?: number;
}

export type AvailabilityChartState = 'loading' | 'error' | 'empty' | 'ready';

export function getAvailabilityChartState(
  data: AvailabilityChartPoint[],
  loading = false,
  error: string | null = null,
): AvailabilityChartState {
  if (loading) return 'loading';
  if (error) return 'error';
  return data.length > 0 && data.some((point) => point.total && point.total > 0)
    ? 'ready'
    : 'empty';
}
