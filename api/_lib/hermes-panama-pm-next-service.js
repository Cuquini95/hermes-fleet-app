import { pmMasterNumber, projectPanamaPmNextService } from '../../src/lib/panama-pm-next-service.js';
import { pmLevelKey } from './hermes-pm-triggers.js';

const key = value => String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
function unitRow(rows, unit) {
  const matching = Array.isArray(rows) ? rows.filter(row => key(row?.unit) === unit) : [];
  return matching.length === 1 ? matching[0] : undefined;
}

function dateEvidence(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function officialNext(row, closure, cut) {
  const previous = /\b(PM[ -]?(?:\d{1,2},\d{3}|\d{1,5}))\s+a\s+([\d,.]+)\s*h\b/i.exec(row?.last ?? '');
  if (!previous || pmLevelKey(previous[1]) !== closure.level || pmMasterNumber(previous[2]) !== closure.meter
    || /POR CONFIRMAR|SIN |FALTA|ACTUALIZAR|INACTIVO|ATRASAD|PROVISIONAL/.test(key(`${row.last} ${row.reading ?? ''} ${row.status ?? ''}`))) return null;
  const level = pmLevelKey(row.next);
  const dueAt = pmMasterNumber(row.due);
  return level && dueAt !== null && dueAt >= closure.meter ? { level, dueAt, ...(cut && { cut }) } : null;
}

export async function nextPmAtAcceptance(readSources, unit, level, meter) {
  const closure = { level: pmLevelKey(level), meter: pmMasterNumber(meter) };
  try {
    const { sections, snapshots = {} } = await readSources?.() ?? {};
    if (!Array.isArray(sections?.maintenancePlan) || !Array.isArray(sections?.maintenanceAnchor)) {
      return { status: 'unavailable', reason: 'source' };
    }
    const plan = unitRow(sections.maintenancePlan, unit);
    if (!plan || key(plan.active) !== 'SI' || key(plan.approved) !== 'SI') return { status: 'unavailable', reason: 'plan' };
    const anchor = pmMasterNumber(unitRow(sections.maintenanceAnchor, unit)?.anchor);
    if (anchor === null || anchor < 0) return { status: 'unavailable', reason: 'anchor' };
    const projection = projectPanamaPmNextService(closure, plan, anchor);
    if (!projection) return { status: 'unavailable', reason: 'rule' };
    const official = officialNext(unitRow(sections.maintenance, unit), closure, dateEvidence(snapshots.maintenance));
    const planCut = dateEvidence(snapshots.maintenancePlan);
    const anchorCut = dateEvidence(snapshots.maintenanceAnchor);
    const rule = { ...projection, ...(planCut && { planCut }), ...(anchorCut && { anchorCut }) };
    if (!official) return { status: 'projected', ...rule };
    return { status: official.level === rule.level && official.dueAt === rule.dueAt ? 'verified' : 'mismatch', ...rule, official };
  } catch {
    return { status: 'unavailable', reason: 'source' };
  }
}
