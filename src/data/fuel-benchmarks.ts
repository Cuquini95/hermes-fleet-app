export const FUEL_BENCHMARKS: Record<string, { min: number; max: number; unit: string }> = {
  'Komatsu HM400-3': { min: 0.95, max: 1.1, unit: 'L/hr' },
  'Komatsu D155AX-6': { min: 0.9, max: 1.0, unit: 'L/hr' },
  'Komatsu D65EX-16': { min: 0.7, max: 0.85, unit: 'L/hr' },
  'CAT 740B': { min: 0.8, max: 0.9, unit: 'L/hr' },
  'Mack GR84B 8x4': { min: 28, max: 32, unit: 'L/100km' },
  'Doosan DL420A': { min: 0.85, max: 1.0, unit: 'L/hr' },
  'Doosan DX340LC': { min: 0.8, max: 0.95, unit: 'L/hr' },
  'Doosan DX225LC': { min: 0.65, max: 0.8, unit: 'L/hr' },
  'Doosan DX360LCA': { min: 0.85, max: 1.0, unit: 'L/hr' },
};

export function isAnomalous(model: string, consumption: number): boolean {
  const benchmark = FUEL_BENCHMARKS[model];
  if (!benchmark) return false;
  return consumption > benchmark.max * 1.3;
}
