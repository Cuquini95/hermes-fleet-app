import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchWorkshop, verifyUnitsReadiness } from '../../api/_lib/hermes-workshop.js';
import * as panamaMaster from '../../api/_lib/hermes-panama.js';

const date = '2026-11-14';
const capturedAt = '2026-11-14T13:21:18.372Z';
const now = new Date('2026-11-15T01:00:00Z');
const manager = {
  userId: 'qa-gerencia', userName: 'Gerencia QA', project: 'tmf-panama',
  role: 'gerencia', allUnits: true,
};

const section = (records, cut = null) => ({ records, capturedAt: cut });
const fault = (unit, order, status, reportDate = date) => {
  const row = Array(16).fill('');
  Object.assign(row, { 0: reportDate, 2: unit, 9: status, 13: order });
  return row;
};
const order = (unit, id, status, priority = 'CRITICA') => {
  const row = Array(25).fill('');
  Object.assign(row, { 1: id, 2: date, 3: unit, 4: 'Avería', 7: priority, 9: status });
  if (status === 'Completado') row[22] = '{"decision":"accepted"}';
  return row;
};

function sheetsWith({ masters, failures = [], orders = [], unavailable = [] }) {
  return {
    async readWorkshopMasters() { return masters; },
    async read(tab) {
      if (unavailable.includes(tab)) throw new Error('No disponible');
      return tab === 'Averias' ? faultsWithHeader(failures)
        : tab === 'ORDENES_TRABAJO' ? ordersWithHeader(orders) : [];
    },
  };
}

const faultsWithHeader = rows => [['FECHA', 'HORA', 'UNIDAD'], ...rows];
const ordersWithHeader = rows => [['ROW_ID', 'OT_ID', 'FECHA', 'UNIDAD'], ...rows];

function readiness(sheets, session = manager) {
  return dispatchWorkshop({ path: 'api/workshop/readiness', method: 'GET', session, sheets, now });
}

test('Mis reportes devuelve el folio y el estado de Taller del autor y unidad autorizados', async () => {
  const session = { ...manager, role: 'operador', allUnits: false, assignedUnits: ['QA01'] };
  const failures = [
    Object.assign(fault('QA01', 'OT-INTERNA-A', 'Abierta', '1/11/2026'), { 6: 'Nombre anterior', 15: session.userId }),
    Object.assign(fault('QA01', 'OT-INTERNA-B', 'Abierta', '1/11/2026'), { 6: session.userName, 15: 'otro-id' }),
    Object.assign(fault('QA02', 'OT-INTERNA-C', 'Abierta', '1/11/2026'), { 6: session.userName, 15: session.userId }),
    Object.assign(fault('QA01', 'OT-SIN-ORDEN', 'Abierta', '1/11/2026'), { 6: session.userName, 15: session.userId }),
  ];
  const orders = [Object.assign(order('QA01', 'OT-INTERNA-A', 'En Reparación'), { 19: session.userId, 25: 'OT-0120' })];
  const result = await dispatchWorkshop({ path: 'api/workshop/myfaults', method: 'GET', session, sheets: sheetsWith({ failures, orders }) });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.reports.map(row => [row.fecha, row.unidad, row.otId, row.workshopStatus]), [
    ['01/11/2026', 'QA01', 'OT-0120', 'En reparación'],
    ['01/11/2026', 'QA01', 'OT-SIN-ORDEN', undefined],
  ]);
});

test('an enforced Sticker restriction overrides an operating confirmation while a non-stopping report does not', async () => {
  const store = sheetsWith({
    masters: {
      failures: section([{ id: 'CASE-1', unit: 'QA02', status: 'Detenido reportado', last: date }]),
      orders: section([]),
    },
  });
  const read = store.read;
  store.nativeOperations = true;
  store.read = async tab => {
    if (tab === 'HERMES_PA_CONFIRMACION_OPERATIVA') return [['UNIDAD'], ['QA01', 'operativo'], ['QA02', 'operativo'], ['QA03', 'operativo']];
    if (tab === 'Averias') return [fault('QA03', 'OT-0120', 'Abierta')];
    if (tab === 'Inspeccion_Stickers') {
      const red = Array(18).fill('');
      red[5] = 'QA01';
      red[12] = 'Rojo';
      return [red];
    }
    return read(tab);
  };

  const { body } = await readiness(store);
  assert.deepEqual(body.operatingStatuses, [['QA01', 'inoperativo'], ['QA02', 'inoperativo'], ['QA03', 'operativo']]);
  assert.equal(body.operatingCheckedAt, now.toISOString());
  assert.equal(body.stickers[0][12], 'Rojo');
  assert.deepEqual(body.inspections, []);
  const limited = { ...manager, allUnits: false, assignedUnits: ['QA02'] };
  assert.deepEqual((await readiness(store, limited)).body.operatingStatuses, [['QA02', 'inoperativo']]);
});

test('el Dashboard recibe un solo caso y una sola OT por folio y el estado oficial prevalece', async () => {
  const saved = sheetsWith({
    masters: {
      failures: section([
        { id: 'TMF-20261114-DZ203', unit: 'DZ203', status: 'Cerrada', last: '14-nov-2026 07:32', order: 'OT-0042' },
        { id: 'tmf-20261114-dz203', unit: 'DZ203', status: 'Cerrada', last: '14-nov-2026 07:32', order: 'OT-0042' },
        { id: 'TMF-20261113-EX401', unit: 'EX401', status: 'Por verificar', last: '13-nov-2026 10:00' },
      ], capturedAt),
      orders: section([
        { id: 'OT-0042', unit: 'DZ203', status: 'Cerrada' },
        { id: 'OT-0047', unit: 'EX401', status: 'Abierta' },
      ], capturedAt),
    },
    failures: [fault('DZ203', 'ot-0042', 'En Reparación')],
    orders: [order('DZ203', 'ot-0042', 'En Reparación'), order('DZ204', 'OT-0050', 'Abierta')],
  });
  const { status, body } = await readiness(saved);
  assert.equal(status, 200);
  assert.ok(body.workshop, 'La consulta debe ofrecer el consolidado del Maestro de Taller');
  assert.deepEqual(body.workshop.failures.records.map(row => [row.id, row.status, row.operationalStatus]), [
    ['TMF-20261114-DZ203', 'Cerrada', 'En Reparación'],
    ['TMF-20261113-EX401', 'Por verificar', undefined],
  ]);
  assert.equal(body.workshop.failures.capturedAt, capturedAt);
  assert.equal(body.workshop.alertsToday, 1);
  assert.equal(body.workshop.openOrders, 2);
  assert.equal(body.workshop.criticalOTs, null);
  assert.deepEqual(body.workshop.orders.records.map(row => [row.id, row.status]), [
    ['OT-0042', 'Cerrada'], ['OT-0047', 'Abierta'], ['OT-0050', 'Abierta'],
  ]);
  assert.deepEqual(body.masterRestrictions.map(row => [row.unitId, row.level, row.label]), [
    ['DZ203', 'blocked', 'Por conciliar'],
  ]);
});

test('una avería y una OT con estados equivalentes no generan discrepancia', async () => {
  const { body } = await readiness(sheetsWith({
    masters: {
      failures: section([{ id: 'OT-0042', unit: 'DZ203', status: 'Cerrada', last: date }]),
      orders: section([{ id: 'OT-0042', unit: 'DZ203', status: 'Cerrada' }]),
    },
    failures: [fault('DZ203', 'OT-0042', 'Completado')],
    orders: [order('DZ203', 'OT-0042', 'Completado')],
  }));
  assert.deepEqual(body.masterRestrictions, []);
  assert.equal(body.workshop.failures.records.length, 1);
  assert.equal(body.workshop.failures.records[0].operationalStatus, undefined);
  assert.equal(body.workshop.criticalOTs, 0);
});

test('distingue los folios críticos confirmados de las órdenes abiertas sin prioridad', async () => {
  const { body } = await readiness(sheetsWith({
    masters: { failures: section([]), orders: section([
      { id: 'OT-0001', unit: 'DZ203', status: 'Abierta' },
    ], capturedAt) },
    orders: [order('DZ204', 'OT-0100', 'Abierta'), order('DZ205', 'OT-0101', 'Completado')],
  }));
  assert.equal(body.workshop.criticalOTs, null);
  assert.deepEqual(body.workshop.criticalOrders.map(row => row.id), ['OT-0100']);
  assert.deepEqual(body.workshop.ordersWithoutPriority.map(row => row.id), ['OT-0001']);
});

test('un corte faltante deja los indicadores sin verificar y conserva la fuente que sí respondió', async () => {
  const { body } = await readiness(sheetsWith({
    masters: { failures: null, orders: section([{ id: 'OT-0042', unit: 'DZ203', status: 'Abierta', priority: 'Crítica' }], capturedAt) },
    failures: [fault('DZ203', 'OT-0050', 'Abierta')],
    unavailable: ['ORDENES_TRABAJO'],
  }));
  assert.equal(body.workshop.alertsToday, null);
  assert.equal(body.workshop.failures.masterAvailable, false);
  assert.equal(body.workshop.orders.operationalAvailable, false);
  assert.equal(body.workshop.orders.capturedAt, capturedAt);
  assert.equal(body.workshop.criticalOTs, 1);
});

test('el servidor bloquea el retorno si una OT cerrada en Hermes sigue abierta en el Maestro', async () => {
  const store = sheetsWith({
    masters: { failures: section([]), orders: section([{ id: 'OT-0042', unit: 'DZ203', status: 'Abierta' }]) },
    orders: [order('DZ203', 'OT-0042', 'Completado')],
  });
  const restrictions = await verifyUnitsReadiness(store, new Set(['DZ203']), { acceptReturnFor: 'OT-0042' });
  assert.equal(restrictions.get('DZ203')?.level, 'blocked');
  assert.match(restrictions.get('DZ203')?.reason ?? '', /por conciliar/i);
});

test('una sesión de campo puede ver un bloqueo de su unidad sin recibir folios ni el detalle de Gerencia', async () => {
  const store = sheetsWith({
    masters: {
      failures: section([{ id: 'TMF-42', order: 'OT-0042', unit: 'DZ203', status: 'Cerrada', last: date }]),
      orders: section([{ id: 'OT-0080', unit: 'EX401', status: 'Abierta' }]),
    },
    failures: [fault('DZ203', 'OT-0042', 'Abierta')],
    orders: [order('EX401', 'OT-0080', 'Completado')],
  });
  const operator = { ...manager, role: 'operador', allUnits: false, assignedUnits: ['DZ203'] };
  const { body } = await readiness(store, operator);
  assert.equal(body.workshop, undefined);
  assert.deepEqual(body.masterRestrictions.map(row => [row.unitId, row.label]), [['DZ203', 'Por conciliar']]);
  assert.doesNotMatch(JSON.stringify(body), /TMF-42|OT-0042|OT-0080|EX401/);
});

test('el lector conserva el corte privado si la lectura del Maestro falla o pierde sus columnas', async () => {
  assert.equal(typeof panamaMaster.readPanamaWorkshopMasters, 'function');
  const review = await panamaMaster.readPanamaWorkshopMasters({
    allowSnapshot: true,
    readLive: async ({ key }) => {
      if (key === 'failures') return [['Hoja movida']];
      throw new Error('Maestro no disponible');
    },
    readCut: async ({ key }) => ({
      rows: key === 'failures'
        ? [['CASO', 'EQUIPO', 'FALLA REPORTADA', 'ESTADO', 'ÚLTIMO REPORTE', 'OT VINCULADA'],
          ['TMF-42', 'DZ203', 'Fuga', 'DETENIDO REPORTADO', '14-nov-2026 07:32', '']]
        : [['Nº OT', 'EQUIPO', 'FALLA / TRABAJO A REALIZAR', 'ESTADO', 'CONTROL INTEGRIDAD OT'],
          ['OT-0042', 'DZ203', 'Revisar', 'Abierta', 'APERTURA INCOMPLETA']],
      captured_at: capturedAt,
    }),
  });
  assert.equal(review.failures.capturedAt, capturedAt);
  assert.equal(review.failures.records[0].status, 'DETENIDO REPORTADO');
  assert.equal(review.orders.capturedAt, capturedAt);
  assert.equal(review.orders.records[0].priority, undefined);
});

test('la consulta de Taller prioriza el corte y la verificación operativa prioriza la hoja', async () => {
  const failures = [['CASO', 'EQUIPO', 'FALLA REPORTADA', 'ESTADO', 'ÚLTIMO REPORTE', 'OT VINCULADA'],
    ['TMF-42', 'DZ203', 'Revisar', 'DETENIDO REPORTADO', '14-nov-2026 07:32', '']];
  const orders = [['Nº OT', 'EQUIPO', 'FALLA / TRABAJO A REALIZAR', 'ESTADO', 'CONTROL INTEGRIDAD OT'],
    ['OT-0042', 'DZ203', 'Revisar', 'Abierta', 'Pendiente']];
  const reads = [];
  const options = {
    allowSnapshot: true,
    readLive: async ({ key }) => { reads.push('live'); return key === 'failures' ? failures : orders; },
    readCut: async ({ key }) => { reads.push('cut'); return { captured_at: capturedAt, rows: key === 'failures' ? failures : orders }; },
  };
  const display = await panamaMaster.readPanamaWorkshopMasters({ ...options, preferPublished: true });
  assert.deepEqual(reads, ['cut', 'cut']);
  assert.equal(display.failures.capturedAt, capturedAt);
  reads.length = 0;
  const operational = await panamaMaster.readPanamaWorkshopMasters(options);
  assert.deepEqual(reads, ['live', 'live']);
  assert.equal(operational.failures.capturedAt, null);

  const store = sheetsWith({ masters: display });
  const preferences = [];
  store.readWorkshopMasters = async ({ preferPublished = false } = {}) => {
    preferences.push(preferPublished);
    return preferPublished ? display : operational;
  };
  const { body } = await readiness(store);
  assert.equal(body.workshop.failures.capturedAt, capturedAt);
  await readiness(store, { ...manager, role: 'operador' });
  assert.equal((await verifyUnitsReadiness(store, new Set(['DZ203']))).get('DZ203')?.level, 'blocked');
  assert.deepEqual(preferences, [true, false, false]);
});

test('un detenido oficial bloquea esa unidad y un estado por verificar no se cuenta como detenido', async () => {
  const store = sheetsWith({
    masters: {
      failures: section([
        { id: 'TMF-41', unit: 'DZ203', status: 'DETENIDO REPORTADO', last: date },
        { id: 'TMF-42', unit: 'EX401', status: 'POR VERIFICAR', last: date },
      ]),
      orders: section([]),
    },
  });
  const { body } = await readiness(store);
  assert.deepEqual(body.masterRestrictions.map(row => [row.unitId, row.level]), [['DZ203', 'blocked']]);
  assert.equal(body.workshop.alertsToday, 2);
});

test('un folio asignado a equipos diferentes exige conciliación en ambos, incluso por unidad', async () => {
  const store = sheetsWith({
    masters: { failures: section([]), orders: section([{ id: 'OT-0042', unit: 'EX401', status: 'Cerrada' }]) },
    orders: [order('DZ203', 'OT-0042', 'Completado')],
  });
  assert.equal((await verifyUnitsReadiness(store, new Set(['DZ203']))).get('DZ203')?.label, 'Por conciliar');
  assert.equal((await verifyUnitsReadiness(store, new Set(['EX401']))).get('EX401')?.label, 'Por conciliar');
  const { body } = await readiness(store);
  assert.equal(body.workshop.orders.records.find(row => row.unit === 'EX401')?.operationalStatus, undefined);
});

test('un libro operativo caído no convierte cero críticas conocidas en cero verificadas', async () => {
  const { body } = await readiness(sheetsWith({
    masters: { failures: section([]), orders: section([{ id: 'OT-0042', unit: 'DZ203', status: 'Cerrada' }], capturedAt) },
    unavailable: ['ORDENES_TRABAJO'],
  }));
  assert.equal(body.workshop.criticalOTs, null);
});

test('prioridades distintas en la misma orden requieren conciliación antes de contar', async () => {
  const { body } = await readiness(sheetsWith({
    masters: { failures: section([]), orders: section([
      { id: 'OT-0042', unit: 'DZ203', status: 'Abierta', priority: 'Alta' },
    ], capturedAt) },
    orders: [order('DZ203', 'OT-0042', 'Abierta')],
  }));
  assert.equal(body.workshop.criticalOTs, null);
  assert.deepEqual(body.workshop.ordersWithoutPriority.map(row => row.id), ['OT-0042']);
});

test('una prioridad de Hermes no reemplaza la prioridad ausente de una OT oficial', async () => {
  const { body } = await readiness(sheetsWith({
    masters: {
      failures: section([]),
      orders: section([{ id: 'OT-0042', unit: 'DZ203', status: 'Abierta' }], capturedAt),
    },
    orders: [order('DZ203', 'OT-0042', 'Abierta')],
  }));
  assert.equal(body.workshop.openOrders, 1);
  assert.equal(body.workshop.criticalOTs, null);
});
