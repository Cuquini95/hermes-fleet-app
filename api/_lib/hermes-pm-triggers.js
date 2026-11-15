import { HermesSheetError } from './hermes-google-sheets.js';

const key = value => String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
export const pmLevelKey = value => {
  const match = /^PM[ -]?(\d{1,5}|\d{1,2},\d{3})$/i.exec(String(value ?? '').trim());
  return match ? `PM-${Number(match[1].replace(',', ''))}` : '';
};
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' });
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const family = { dozers: 'Componentes · Dozers', excavators: 'Componentes · Excavadoras' };

function number(value) {
  const raw = String(value ?? '').trim();
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw) && Number.isFinite(Number(raw.replaceAll(',', '')))
    ? Number(raw.replaceAll(',', '')) : null;
}

function one(rows, unit) {
  const matches = Array.isArray(rows) ? rows.filter(row => key(row.unit) === unit) : [];
  return matches.length === 1 ? matches[0] : null;
}

function approvedRule(context, unit, level) {
  try {
    const list = context.pmTriggerRules ?? JSON.parse(process.env.HERMES_PANAMA_PM_TRIGGER_RULES_JSON || '[]');
    const matches = list.filter(row => key(row?.unit) === unit && pmLevelKey(row?.level) === level);
    if (!matches.length) return null;
    const [rule] = matches;
    if (matches.length !== 1 || typeof rule.reference !== 'string' || !rule.reference.trim() || rule.reference.length > 160
      || (rule.dueDate != null && !validDate(rule.dueDate))
      || (rule.condition != null && (!Object.hasOwn(family, rule.condition?.source) || !Number.isSafeInteger(rule.condition.minCritical)
        || rule.condition.minCritical <= 0))) throw new Error('Invalid rule');
    return { ...rule, reference: rule.reference.trim() };
  } catch {
    throw new HermesSheetError(409, 'El plan aprobado de disparadores PM requiere revisión.');
  }
}

export async function evaluatePmTriggers(context, unit, level) {
  const today = dateFmt.format(new Date(context.now ?? Date.now()));
  const rule = approvedRule(context, unit, level);
  const { sections = {}, snapshots = {} } = await context.readPmSources?.() ?? {};
  const hours = one(sections.maintenance, unit);
  const plan = one(sections.maintenancePlan, unit);
  const applies = pmLevelKey(hours?.next) === level;
  const trusted = applies && key(plan?.active) === 'SI' && key(plan?.approved) === 'SI'
    && !/SIN |FALTA|ACTUALIZAR|INACTIVO|ATRASAD|PROVISIONAL/.test(`${key(hours?.reading)} ${key(hours?.status)}`);
  const meter = trusted ? number(hours.hours) : null;
  const threshold = applies ? number(hours?.due) : null;
  const hourRule = {
    kind: 'hours', source: 'PM FLOTA', actual: meter, threshold, cut: snapshots.maintenance,
    state: meter === null || threshold === null ? 'unknown' : meter >= threshold ? 'due' : 'ok',
    occurrence: threshold === null ? null : `hours:${threshold}`,
  };
  const condition = rule?.condition;
  const summary = condition ? one(sections[condition.source], unit) : null;
  const critical = number(summary?.critical);
  const conditionState = critical !== null && Number.isInteger(critical) && critical >= (condition?.minCritical ?? Infinity) ? 'due'
    : critical !== null && Number.isInteger(critical) && number(summary?.noData) === 0 ? 'ok' : 'unknown';
  return { today, rules: [hourRule, {
    kind: 'date', source: rule?.reference, actual: today, threshold: rule?.dueDate ?? null,
    state: rule?.dueDate ? today >= rule.dueDate ? 'due' : 'ok' : 'not_configured',
    occurrence: rule?.dueDate ? `date:${rule.dueDate}` : null,
  }, {
    kind: 'condition', source: condition ? family[condition.source] : undefined, reference: condition ? rule.reference : undefined,
    actual: critical, threshold: condition?.minCritical ?? null, cut: condition ? snapshots[condition.source] : undefined,
    state: condition ? conditionState : 'not_configured',
    occurrence: condition ? `condition:${rule.reference}:${condition.source}:${condition.minCritical}` : null,
  }] };
}
