const KOMATSU_CAT_DOOSAN_THRESHOLDS: Record<string, number> = {
  'PM-1': 250,
  'PM-2': 500,
  'PM-3': 1000,
  'PM-4': 2000,
  'PM-5': 4000,
};

const MACK_THRESHOLDS: Record<string, number> = {
  'PM-1': 100,
  'PM-2': 250,
  'PM-3': 500,
  'PM-4': 1000,
  'PM-5': 2000,
};

export const PM_THRESHOLDS: Record<string, Record<string, number>> = {
  Komatsu: KOMATSU_CAT_DOOSAN_THRESHOLDS,
  CAT: KOMATSU_CAT_DOOSAN_THRESHOLDS,
  Doosan: KOMATSU_CAT_DOOSAN_THRESHOLDS,
  Mack: MACK_THRESHOLDS,
};

function getBrandThresholds(model: string): Record<string, number> {
  if (model.startsWith('Mack')) return MACK_THRESHOLDS;
  if (model.startsWith('Komatsu') || model.startsWith('CAT') || model.startsWith('Doosan')) {
    return KOMATSU_CAT_DOOSAN_THRESHOLDS;
  }
  return KOMATSU_CAT_DOOSAN_THRESHOLDS;
}

export function getNextPM(
  model: string,
  currentHours: number
): { level: string; due_at: number; hours_remaining: number } {
  const thresholds = getBrandThresholds(model);
  const levels = Object.keys(thresholds).sort(
    (a, b) => thresholds[a] - thresholds[b]
  );

  for (const level of levels) {
    const interval = thresholds[level];
    const cyclePosition = currentHours % interval;
    const due_at = currentHours - cyclePosition + interval;
    const hours_remaining = due_at - currentHours;

    if (hours_remaining <= interval * 0.2 || hours_remaining <= 50) {
      return { level, due_at, hours_remaining };
    }
  }

  const lastLevel = levels[levels.length - 1];
  const interval = thresholds[lastLevel];
  const cyclePosition = currentHours % interval;
  const due_at = currentHours - cyclePosition + interval;
  const hours_remaining = due_at - currentHours;

  return { level: lastLevel, due_at, hours_remaining };
}
