import { createHash } from 'node:crypto';

export const EXPENSE_ADJUSTMENTS_TAB = 'HERMES_PA_AJUSTES_GASTOS';
export const EXPENSE_ADJUSTMENTS_HEADER = ['GASTO_ID', 'AJUSTE_ID', 'EVENTO', 'DETALLE_JSON'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validAmount = value => /^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(value ?? '');
const validActor = actor => typeof actor?.id === 'string' && Boolean(actor.id)
  && typeof actor.name === 'string' && Boolean(actor.name);
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function projectExpenseAdjustments(rows, expenseId, originalAmount, originalRow) {
  if (!Array.isArray(rows[0]) || !EXPENSE_ADJUSTMENTS_HEADER.every((value, index) => rows[0][index] === value)) return null;
  const history = rows.slice(1).filter(row => row[0] === expenseId);
  const originalVersion = digest(originalRow);
  const version = digest([originalVersion, history]);
  const items = [];
  const ids = new Set();
  let effectiveAmount = originalAmount;
  let pending = null;
  try {
    for (const [, id, action, data] of history) {
      const event = JSON.parse(data);
      if (!/^AJG-[A-F0-9]{18}$/.test(id) || event.originalVersion !== originalVersion
        || !validActor(event.actor) || !validDate(event.at)) return null;
      if (action === 'propose') {
        if (pending || ids.has(id) || event.previousAmount !== effectiveAmount
          || !validAmount(event.newAmount) || event.newAmount === effectiveAmount
          || typeof event.reason !== 'string' || !event.reason) return null;
        ids.add(id);
        pending = { id, status: 'Pendiente', previousAmount: event.previousAmount, newAmount: event.newAmount,
          reason: event.reason, authorId: event.actor.id, author: event.actor.name, createdAt: event.at };
        items.push(pending);
      } else if (action === 'review') {
        if (pending?.id !== id || pending.authorId === event.actor.id || !['Aprobado', 'Rechazado'].includes(event.status)
          || typeof event.reason !== 'string' || (event.status === 'Rechazado' && !event.reason)
          || Date.parse(event.at) < Date.parse(pending.createdAt)) return null;
        Object.assign(pending, { status: event.status, reviewerId: event.actor.id, reviewer: event.actor.name,
          reviewedAt: event.at, reviewReason: event.reason });
        if (event.status === 'Aprobado') effectiveAmount = pending.newAmount;
        pending = null;
      } else return null;
    }
  } catch {
    return null;
  }
  return { items, pending, effectiveAmount, version, originalVersion };
}
