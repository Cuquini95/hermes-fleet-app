const panamaDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit',
});
const months = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};
const equivalents = new Map([
  ['ABIERTA', 'ABIERTO'], ['CERRADA', 'CERRADO'], ['COMPLETADO', 'CERRADO'],
  ['COMPLETADA', 'CERRADO'], ['CANCELADA', 'CANCELADO'], ['RESUELTA', 'RESUELTO'],
]);
const finalStates = new Set(['CERRADO', 'CANCELADO']);
const openOrderStates = new Set([
  'ABIERTO', 'PENDIENTE', 'EN PROCESO', 'EN REPARACION', 'EN EJECUCION',
  'EN ESPERA DE ASIGNACION', 'ESPERANDO PIEZA', 'RESUELTO', 'PROGRAMADO', 'PROGRAMADA',
]);
const stoppedFailures = new Set(['DETENIDO REPORTADO', 'EN REPARACION', 'ESPERANDO PIEZA']);
const priorities = new Set(['CRITICA', 'CRITICO', 'ALTA', 'MEDIA', 'BAJA']);
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toUpperCase();
const plain = value => key(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');
const state = value => equivalents.get(plain(value)) ?? plain(value);
const priorityKey = value => plain(value).replace(/^CRITICO$/, 'CRITICA');
const isOrder = value => /^OT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(key(value));

function dateOf(value) {
  const raw = clean(value);
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) && Number.isFinite(Date.parse(raw))) {
    return panamaDay.format(new Date(raw));
  }
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[ T])/);
  const dmy = raw.match(/^(\d{1,2})(?:\/(\d{1,2})\/|[- ]([a-z]+)[- ])(\d{4})(?:$|[ T])/i);
  if (!ymd && !dmy) return null;
  const year = ymd?.[1] ?? dmy[4];
  const month = Number(ymd?.[2] ?? dmy?.[2] ?? months[dmy?.[3]?.toLowerCase().slice(0, 3)]);
  const day = Number(ymd?.[3] ?? dmy[1]);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function operationalFailures(rows) {
  return rows?.flatMap(row => {
    const id = isOrder(row[13]) ? key(row[13])
      : key(clean(row[11]).match(/(?:^|\|)\s*OT:\s*(OT-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/i)?.[1]);
    const unit = key(row[2]);
    const date = dateOf(row[0]);
    if (!unit || !date) return [];
    return [{ id, order: id, unit, status: clean(row[9]), date }];
  }) ?? null;
}

function operationalOrders(rows) {
  return rows?.flatMap(row => isOrder(row[1]) && key(row[3])
    ? [{ id: key(row[1]), unit: key(row[3]), status: clean(row[9]), priority: clean(row[7]) }] : []) ?? null;
}

function masterRecord(row, failures) {
  return {
    id: key(row.id), unit: key(row.unit), status: clean(row.status), source: 'master',
    ...(row.description ? { description: clean(row.description) } : {}),
    ...(failures ? { date: dateOf(row.last), order: key(row.order) } : { priority: clean(row.priority) }),
  };
}

function uniqueRecords(rows) {
  const byId = new Map();
  const unlinked = [];
  for (const row of rows) {
    if (!row.id) {
      unlinked.push(row);
      continue;
    }
    const existing = byId.get(row.id);
    if (!existing) byId.set(row.id, row);
    else if (existing.unit !== row.unit || state(existing.status) !== state(row.status)) {
      existing.needsReview = true;
    }
  }
  return { byId, unlinked };
}

function reconcileSection(master, operational, failures, allows) {
  const { byId: official } = uniqueRecords((master?.records ?? []).filter(row => row.id && row.unit)
    .map(row => masterRecord(row, failures)));
  const { byId: local, unlinked } = uniqueRecords(operational ?? []);
  const linkedOrders = new Map();
  if (failures) {
    for (const record of official.values()) {
      if (!record.order) continue;
      const linked = linkedOrders.get(record.order) ?? [];
      linked.push(record);
      linkedOrders.set(record.order, linked);
    }
  }

  const localOnly = [];
  for (const row of local.values()) {
    const direct = official.get(row.id);
    const matches = direct ? [direct] : linkedOrders.get(row.order) ?? [];
    if (!matches.length) {
      localOnly.push({ ...row, source: 'hermes' });
      continue;
    }
    for (const record of matches) {
      if (matches.length > 1 || row.needsReview || record.unit !== row.unit || state(record.status) !== state(row.status)) {
        record.needsReview = true;
        if (record.unit === row.unit && allows(row.unit)) record.operationalStatus = row.status;
      }
      if (!failures && record.unit === row.unit && priorities.has(plain(record.priority))
        && priorities.has(plain(row.priority)) && priorityKey(record.priority) !== priorityKey(row.priority)) {
        record.priorityConflict = true;
      }
    }
    if (matches.some(record => record.unit !== row.unit)) {
      localOnly.push({ ...row, source: 'hermes', needsReview: true, excludedFromCount: true });
    }
  }
  return {
    records: [...official.values(), ...localOnly, ...unlinked.map(row => ({ ...row, source: 'hermes' }))]
      .filter(row => allows(row.unit)),
    capturedAt: master?.capturedAt ?? null,
    masterAvailable: master != null,
    operationalAvailable: operational != null,
  };
}

function restrictionsFor(failures, orders) {
  const units = new Map();
  for (const row of failures.records) {
    if (row.source === 'master' && stoppedFailures.has(state(row.status))) {
      units.set(row.unit, {
        unitId: row.unit, source: 'averia', level: 'blocked', label: 'No despachar',
        reason: 'Avería detenida en el Maestro de Taller', effectiveStatus: 'taller',
      });
    }
  }
  for (const row of [...failures.records, ...orders.records]) {
    if (!row.needsReview) continue;
    units.set(row.unit, {
      unitId: row.unit, source: 'averia', level: 'blocked', label: 'Por conciliar',
      reason: 'Avería u OT por conciliar entre el Maestro de Taller y Hermes', effectiveStatus: 'taller',
    });
  }
  return [...units.values()];
}

export function reconcilePanamaWorkshop(masters, failureRows, orderRows, allows, now = new Date()) {
  const failures = reconcileSection(masters?.failures, operationalFailures(failureRows), true, allows);
  const orders = reconcileSection(masters?.orders, operationalOrders(orderRows), false, allows);
  const today = panamaDay.format(now);
  const cases = failures.records.filter(record => !record.excludedFromCount);
  const todayVerified = failures.masterAvailable && (failures.operationalAvailable || cases.length > 0)
    && (!failures.capturedAt || dateOf(failures.capturedAt) === today)
    && cases.every(record => record.date);
  const orderRecords = orders.records.filter(record => !record.excludedFromCount);
  const openOrders = orderRecords.filter(record => openOrderStates.has(state(record.status)));
  const ordersVerified = orders.masterAvailable && (orders.operationalAvailable || orderRecords.length > 0)
    && orderRecords.every(record => openOrderStates.has(state(record.status)) || finalStates.has(state(record.status)));
  const criticalOrders = openOrders.filter(record => priorityKey(record.priority) === 'CRITICA'
    && !record.needsReview && !record.priorityConflict);
  const ordersWithoutPriority = orderRecords.filter(record => record.needsReview || record.priorityConflict
    || (openOrderStates.has(state(record.status)) && !priorities.has(plain(record.priority))));
  const prioritiesVerified = ordersVerified && ordersWithoutPriority.length === 0
    && (orders.operationalAvailable || criticalOrders.length > 0);
  return {
    workshop: {
      failures, orders,
      alertsToday: todayVerified ? cases.filter(record => record.date === today).length : null,
      openOrders: ordersVerified ? openOrders.length : null,
      criticalOTs: prioritiesVerified ? criticalOrders.length : null,
      criticalOrders,
      ordersWithoutPriority,
    },
    masterRestrictions: restrictionsFor(failures, orders),
  };
}
