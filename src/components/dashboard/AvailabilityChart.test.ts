import { describe, expect, it } from 'vitest';
import { getAvailabilityChartState } from './availability-chart-state';

const points = [
  { day: 'Lun', pct: 100, unavailable: 0, total: 4 },
];

describe('getAvailabilityChartState', () => {
  it('keeps the loading state explicit while dependencies are pending', () => {
    expect(getAvailabilityChartState([], true)).toBe('loading');
  });

  it('surfaces a dependency error instead of an indefinite spinner', () => {
    expect(getAvailabilityChartState([], false, 'No se pudo cargar el inventario de unidades.')).toBe('error');
  });

  it('distinguishes a completed empty result from loading', () => {
    expect(getAvailabilityChartState([], false)).toBe('empty');
  });

  it('renders the chart state when a populated trend exists', () => {
    expect(getAvailabilityChartState(points, false)).toBe('ready');
  });
});
