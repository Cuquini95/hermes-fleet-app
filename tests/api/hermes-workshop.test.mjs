import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';

const account = (userId, role, units = ['CA20']) => ({
  userId, userName: `QA ${role}`, role, projects: ['QA'], allUnits: false, assignedUnits: units,
});
const operator = account('operator-qa', 'operador');
const workshop = account('workshop-qa', 'jefe_taller');
const coordinator = account('coordinator-qa', 'coordinador');
const mechanic = account('mechanic-qa', 'mecanico');
const secondMechanic = account('mechanic-qa-2', 'mecanico');
const supervisor = account('supervisor-qa', 'supervisor');
const manager = account('manager-qa', 'gerencia');

function fixture() {
  const data = new Map([['01 Inventario', [[], [], [], ['', 'CA20', '', 'Cat', '745', '', '', '', '', '4000']]]]);
  const mutations = new Map();
  const guards = new Set();
  let fail = false;
  const sheets = {
    async read(tab) { return structuredClone(data.get(tab) || []); },
    async replay({ key, fingerprint }) {
      const mutation = mutations.get(key);
      if (mutation && mutation.fingerprint !== fingerprint) throw Object.assign(new Error('Operación distinta'), { status: 409 });
      return mutation ? structuredClone(mutation.result) : null;
    },
    async commit({ key, fingerprint, guard, writes, result }) {
      const replayed = await sheets.replay({ key, fingerprint });
      if (replayed) return { replayed: true, result: replayed };
      if (fail) throw Object.assign(new Error('Falló confirmación simulada'), { status: 503 });
      if (guard && guards.has(guard)) throw Object.assign(new Error('Orden actualizada'), { status: 409 });
      const newData = structuredClone(data);
      for (const write of writes) {
        const table = newData.get(write.tab) || [];
        if (write.append) table.push(...write.append.map(row => [...row]));
        else {
          table[write.row] ??= [];
          write.values.forEach((value, index) => { table[write.row][(write.col || 0) + index] = value; });
        }
        newData.set(write.tab, table);
      }
      for (const [key, value] of newData) data.set(key, value);
      if (guard) guards.add(guard);
      mutations.set(key, { fingerprint, result });
      return { replayed: false, result };
    },
  };
  const request = (path, session, body = undefined) => dispatchWorkshop({
    path: `api/workshop/${path}`, method: body === undefined ? 'GET' : 'POST', body,
    query: {}, session, sheets,
    listMechanics: async () => [mechanic, secondMechanic],
    storageOrigin: 'https://storage-qa.supabase.co',
  });
  return { sheets, request, fail: value => { fail = value; } };
}

const report = (changes = {}) => ({
  mutationId: randomUUID(), unit: 'CA20', type: 'Neumáticos', description: 'Llanta QA',
  canMove: false, customer: 'QA', location: 'QA', downtime: '<1 hora', photos: [], ...changes,
});

test('una falla confirma un mismo folio para avería, OT y bandejas después de persistir', async () => {
  const { request, sheets, fail } = fixture();
  const body = report({ photos: ['https://storage-qa.supabase.co/storage/v1/object/public/falla-photos/qa.jpg'] });
  fail(true);
  assert.equal((await request('report', operator, body)).status, 503);
  assert.deepEqual(await sheets.read('Averias'), []);
  assert.deepEqual(await sheets.read('ORDENES_TRABAJO'), []);
  fail(false);
  const created = await request('report', operator, body);
  assert.equal(created.status, 201);
  const { otId } = created.body;
  assert.equal((await request('report', operator, body)).body.otId, otId);
  assert.equal((await request('report', operator, { ...body, description: 'Otro reporte' })).status, 409);
  const [averia] = await sheets.read('Averias');
  assert.equal(averia[13], otId);
  assert.equal(averia[14], body.photos[0]);
  for (const actor of [coordinator, workshop, supervisor, manager]) {
    const list = await request('orders', actor);
    assert.equal(list.body.orders.length, 1);
    assert.equal(list.body.orders[0][1], otId);
    assert.equal(list.body.orders[0][11], otId);
  }
  assert.deepEqual((await request('orders', mechanic)).body.orders, []);
  assert.equal((await request('report', operator, report({ unit: 'OTRA' }))).status, 403);
});

test('asigna por identidad, persiste avances y cierra OT y avería con actor, fecha e historial', async () => {
  const { request, sheets } = fixture();
  const { body: { otId } } = await request('report', operator, report());
  const change = (actor, field, value) => request('transition', actor, { mutationId: randomUUID(), otId, field, value });
  assert.equal((await change(mechanic, 'progreso', '25')).status, 403);
  assert.equal((await change(workshop, 'mecanico_asignado', mechanic.userId)).status, 200);
  assert.equal((await change(mechanic, 'estado', 'En Reparación')).status, 200);
  assert.equal((await change(mechanic, 'progreso', '75')).status, 200);
  assert.equal((await change(mechanic, 'costo_estimado', '99.90')).status, 403);
  assert.equal((await change(workshop, 'costo_estimado', '99.90')).status, 200);
  assert.equal((await change(coordinator, 'mecanico_asignado', secondMechanic.userId)).status, 200);
  assert.equal((await change(mechanic, 'observaciones', 'QA')).status, 403);
  assert.equal((await change(secondMechanic, 'estado', 'Resuelta')).status, 200);
  assert.equal((await change(secondMechanic, 'estado', 'Completado')).status, 403);
  const close = { mutationId: randomUUID(), otId, field: 'estado', value: 'Completado' };
  assert.equal((await request('transition', supervisor, close)).status, 200);
  assert.equal((await request('transition', supervisor, close)).body.replayed, true);
  const list = await request('orders', manager);
  const [order] = list.body.orders;
  assert.equal(order[9], 'Completado');
  assert.match(order[14], /\d{4}-\d{2}-\d{2}T/);
  assert.equal(order[17], secondMechanic.userId);
  assert.equal((await sheets.read('Averias'))[0][9], 'Completado');
  const history = list.body.history.filter(row => row[2] === 'estado' && row[4] === 'Completado');
  assert.equal(history.length, 1);
  assert.equal(history[0][7], supervisor.userId);
});

test('DVIR reprobado y PM dejan sus filas ligadas a la orden y al calendario', async () => {
  const { request, sheets } = fixture();
  const inspection = await request('dvir', operator, {
    mutationId: randomUUID(), unit: 'CA20', date: '2026-11-12', time: '07:00', type: 'pre-operacion', meter: '4000',
    checks: Array.from({ length: 12 }, (_, i) => ({ status: i === 2 ? 'falla' : 'ok', notes: i === 2 ? 'Prueba' : '' })), observations: 'QA', photos: [],
  });
  assert.equal(inspection.status, 201);
  const [dvir] = await sheets.read('14 Inspecciones');
  assert.equal(dvir[25], inspection.body.otId);
  assert.equal((await sheets.read('ORDENES_TRABAJO'))[0][1], inspection.body.otId);

  const body = { mutationId: randomUUID(), unit: 'CA20', level: 'PM250', includedLevels: 'PM250', hours: 2,
    mechanicId: mechanic.userId, scheduledDate: '2026-11-12', parts: 'QA x1', notes: 'QA' };
  const pm = await request('pm', workshop, body);
  assert.equal(pm.status, 201);
  assert.equal((await request('pm', workshop, body)).body.otId, pm.body.otId);
  assert.equal((await sheets.read('Ordenes Mantenimiento'))[0][0], pm.body.otId);
  assert.equal((await sheets.read('05 Historial PM'))[0][1], pm.body.otId);
  const reschedule = { mutationId: randomUUID(), otId: pm.body.otId, date: '2026-11-13', hours: 1.5, notes: 'Reprogramación QA' };
  const moved = await request('schedule', coordinator, reschedule);
  assert.equal(moved.body.schedule[9], mechanic.userId);
  assert.equal((await request('schedule', coordinator, reschedule)).body.replayed, true);
  const schedule = await request('schedule', coordinator);
  assert.equal(schedule.body.schedule.length, 1);
  assert.equal(schedule.body.schedule[0][2], pm.body.otId);
  assert.equal(schedule.body.schedule[0][1], reschedule.date);
  const mechanicOrders = (await request('orders', mechanic)).body;
  assert.equal(mechanicOrders.orders.length, 1);
  assert.equal(mechanicOrders.history.find((row) => row[2] === 'programacion')[7], coordinator.userId);
});

test('un sticker mantiene el bloqueo y exige aprobación identificada', async () => {
  const { request, sheets } = fixture();
  const { getStickerTemplate } = await import('../../src/data/sticker-inspection-templates.js');
  const template = getStickerTemplate('camion_articulado');
  const checklist = template.items.map((item) => ({ itemId: item.id, status: 'cumple', canOperate: true }));
  const body = { mutationId: randomUUID(), unit: 'CA20', templateId: template.id, company: 'QA', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()),
    time: '08:00', checks: checklist, finalColor: 'green', approve: false, photos: [] };
  assert.equal((await request('sticker', operator, { ...body, approve: true })).status, 403);
  const receipt = await request('sticker', operator, body);
  assert.equal(receipt.status, 201);
  assert.equal(receipt.body.approvalState, 'pendiente_supervisor');
  assert.equal(receipt.body.canDispatch, false);
  const review = { mutationId: randomUUID(), folio: receipt.body.folio };
  assert.equal((await request('stickerreview', coordinator, review)).status, 403);
  assert.equal((await request('stickers', supervisor)).body.stickers[0].folio, review.folio);
  assert.equal((await request('stickerreview', supervisor, review)).body.canDispatch, true);
  assert.equal((await request('stickerreview', supervisor, review)).body.replayed, true);
  const [sticker] = await sheets.read('Inspeccion_Stickers');
  assert.equal(sticker[18], operator.userId);
  assert.equal(sticker[19], supervisor.userId);

  const hardStop = template.items.find((item) => item.hardStop);
  const photo = 'https://storage-qa.supabase.co/storage/v1/object/public/sticker-inspection-photos/freno.jpg';
  const fail = { ...body, mutationId: randomUUID(), photos: [photo], checks: checklist.map((item) => item.itemId === hardStop.id
    ? { ...item, status: 'no_cumple', canOperate: false, comment: 'Evidencia QA', photos: [photo] }
    : item) };
  assert.equal((await request('sticker', operator, fail)).status, 400);
  const red = await request('sticker', operator, { ...fail, finalColor: 'red' });
  assert.equal(red.status, 201);
  assert.equal(red.body.canDispatch, false);
  const [finding] = await sheets.read('Inspeccion_Hallazgos');
  assert.equal(finding[1], red.body.folio);
  assert.equal(finding[7], hardStop.id);
  const readiness = await request('readiness', operator);
  assert.equal(readiness.body.stickers.length, 2);
  assert.equal(readiness.body.stickers[1][12], 'red');
});
