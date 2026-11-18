import { panamaWorkshopDate } from './hermes-panama-workshop.js';

const key = (value = '') => value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const ending = new Set(['COMPLETADO', 'COMPLETADA', 'CERRADO', 'CERRADA', 'CANCELADO', 'CANCELADA']);
const open = new Set(['ABIERTA', 'ABIERTO', 'PENDIENTE', 'EN ESPERA DE ASIGNACION', 'EN REPARACION',
  'EN PROCESO', 'EN EJECUCION', 'ESPERANDO PIEZA', 'ESPERANDO REPUESTO', 'RESUELTA', 'RESUELTO', 'PROGRAMADA', 'PROGRAMADO']);
const ordinary = new Set(['ALTA', 'MEDIA', 'BAJA']);
const partsStates = new Set(['ESPERANDO PIEZA', 'ESPERANDO REPUESTO']);
const unassignedNames = new Set(['SIN ASIGNAR', 'POR ASIGNAR', 'PENDIENTE', '-', '—']);

function recordFor(order, pendingReturn, dueAt) {
  const [id, unit] = [order[1], order[3].trim().toUpperCase()];
  const orderStatus = (order[9] || '').trim();
  const status = key(orderStatus);
  const priority = key(order[7] || '');
  const awaitingReturn = pendingReturn(order);
  if (ending.has(status) && !awaitingReturn) return { id, unit, state: 'resolved' };
  if (!awaitingReturn && !open.has(status)) return { id, unit, state: 'unknown' };

  const assigned = (order[8] || '').trim();
  const owner = awaitingReturn || !assigned || unassignedNames.has(key(assigned)) ? null : assigned;
  // A technician ID remains evidence of assignment if a legacy row has no display name.
  const unassigned = !awaitingReturn && !['RESUELTA', 'RESUELTO'].includes(status)
    && owner === null && !(order[17] || '').trim();
  const critical = ['CRITICA', 'CRITICO'].includes(priority);
  const kind = awaitingReturn ? 'return'
    : partsStates.has(status) ? 'parts' : critical ? 'critical' : unassigned ? 'assignment' : null;
  if (!kind) return { id, unit, state: ordinary.has(priority) ? 'resolved' : 'unknown' };

  const due = order[4] === 'PM' ? dueAt(order) : null;
  return {
    id, unit, state: 'active', kind, folio: /^OT-\d{4,15}$/.test(order[25] || '') ? order[25] : id,
    owner, dueHours: Number.isFinite(due) && due > 0 ? due : null, status: orderStatus,
    description: (order[5] || '').trim(), openedOn: panamaWorkshopDate(order[2]), unassigned, critical,
  };
}

export function workshopExceptionRecords(orders, visible, pendingReturn, dueAt, history = [], historyTime = Date.parse) {
  const counts = new Map();
  for (const row of orders) {
    if (row[1]) counts.set(row[1], (counts.get(row[1]) || 0) + 1);
  }

  const revisions = new Map();
  const columns = { estado: 9, prioridad: 7, mecanico_asignado: 8 };
  for (const entry of [...history].sort((a, b) => historyTime(a[0]) - historyTime(b[0]))) {
    if (!Object.hasOwn(columns, entry[2])) continue;
    const existing = revisions.get(entry[1]) ?? {};
    existing[columns[entry[2]]] = entry[4];
    revisions.set(entry[1], existing);
  }

  const records = new Map();
  for (const row of orders) {
    if (!visible(row)) continue;
    const [id, unit] = [row[1], row[3].trim().toUpperCase()];
    const record = counts.get(id) > 1 ? { id, unit, state: 'unknown' }
      : recordFor(Object.assign([...row], revisions.get(id)), pendingReturn, dueAt);
    records.set(JSON.stringify([unit, id]), record);
  }
  return [...records.values()];
}
