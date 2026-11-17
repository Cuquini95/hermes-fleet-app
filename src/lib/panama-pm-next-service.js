const key = value => String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const planFields = ['cycle', 'level2', 'level3', 'level4', 'level5', 'level6'];

export function pmMasterNumber(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return null;
  const number = Number(raw.replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

export function panamaPmIntervals(plan) {
  if (!plan || key(plan.active) !== 'SI') return [];
  return [...new Set(planFields.flatMap(field => {
    const value = pmMasterNumber(plan[field]);
    return value !== null && value >= 10 && value <= 99999 && Number.isInteger(value) ? [value] : [];
  }))].sort((a, b) => a - b);
}

export function projectPanamaPmNextService(accepted, plan, anchor) {
  if (key(plan?.active) !== 'SI' || key(plan?.approved) !== 'SI') return null;
  const intervals = panamaPmIntervals(plan);
  const cycle = pmMasterNumber(plan.cycle);
  const closedLevel = /^PM-(\d+)$/.exec(accepted.level);
  const closedInterval = Number(closedLevel?.[1]);
  if (cycle === null || !intervals.includes(cycle) || !intervals.includes(closedInterval)
    || intervals.some(interval => interval % cycle !== 0)
    || planFields.some(field => String(plan[field] ?? '').trim() && !intervals.includes(pmMasterNumber(plan[field])))
    || !Number.isFinite(anchor) || anchor < 0 || !Number.isFinite(accepted.meter) || accepted.meter < 0) return null;
  const dueAt = Math.round((accepted.meter + cycle) * 1000) / 1000;
  // CALC resets the cycle anchor at acceptance of the highest configured level.
  const cycleAnchor = closedInterval === intervals.at(-1) ? accepted.meter : anchor;
  if (cycleAnchor > accepted.meter) return null;
  const cyclePosition = Math.round((dueAt - cycleAnchor) / cycle) * cycle;
  const level = intervals.filter(interval => cyclePosition % interval === 0).at(-1) ?? cycle;
  return { dueAt, level: `PM-${level}`, cycle, anchor: cycleAnchor, intervals };
}

export function parsePanamaPmNextService(value) {
  let result;
  try { result = typeof value === 'string' ? JSON.parse(value) : value; }
  catch { return null; }
  if (result?.status === 'unavailable') return ['source', 'plan', 'anchor', 'rule'].includes(result.reason) ? result : null;
  const validNumber = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const validProjected = row => typeof row?.level === 'string' && /^PM-\d+$/.test(row.level) && validNumber(row.dueAt);
  if (!['projected', 'verified', 'mismatch'].includes(result?.status) || !validProjected(result)
    || !validNumber(result?.anchor) || !validNumber(result?.cycle) || result.cycle === 0
    || !Array.isArray(result?.intervals) || !result.intervals.every(validNumber)
    || (result?.status !== 'projected' && !validProjected(result.official))) return null;
  return result;
}
