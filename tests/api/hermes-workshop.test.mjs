import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';

const account = (userId, role, units = ['CA20']) => ({
  userId, userName: `QA ${role}`, role, project: 'tmf-panama', projects: ['tmf-panama'], allUnits: false, assignedUnits: units,
});
const operator = account('operator-qa', 'operador');
const workshop = account('workshop-qa', 'jefe_taller');
const coordinator = account('coordinator-qa', 'coordinador');
const mechanic = account('mechanic-qa', 'mecanico');
const secondMechanic = account('mechanic-qa-2', 'mecanico');
const supervisor = { ...account('supervisor-qa', 'supervisor'), canReviewPanamaHse: true };
const manager = account('manager-qa', 'gerencia');

function fixture(pmChecklists = []) {
  const data = new Map([['01 Inventario', [[], [], [], ['', 'CA20', '', 'Cat', '745', '', '', '', '', '4000']]]]);
  const mutations = new Map();
  const evidence = new Map();
  const attach = (kind, operationId, session, unit = 'CA20') => {
    const id = randomUUID().replaceAll('-', '').repeat(2);
    evidence.set(id, { ready: true, actor_id: session.userId, kind, operation_id: operationId,
      units: [unit], record_id: '', preview_demo: false });
    return `/hermes-api/api/evidence?id=${id}`;
  };
  const guards = new Set();
  let fail = false;
  let beforeCommit;
  const sheets = {
    async read(tab) { return structuredClone(data.get(tab) || []); },
    async replay({ key, fingerprint }) {
      const mutation = mutations.get(key);
      if (mutation && mutation.fingerprint !== fingerprint) throw Object.assign(new Error('Operación distinta'), { status: 409 });
      return mutation ? structuredClone(mutation.result) : null;
    },
    async commit({ key, fingerprint, guard, guards: extraGuards = [], writes, result }) {
      const hook = beforeCommit;
      beforeCommit = undefined;
      if (hook) await hook();
      const replayed = await sheets.replay({ key, fingerprint });
      if (replayed) return { replayed: true, result: replayed };
      if (fail) throw Object.assign(new Error('Falló confirmación simulada'), { status: 503 });
      const versions = [guard, ...extraGuards].filter(Boolean);
      if (versions.some(item => guards.has(item))) throw Object.assign(new Error('Orden actualizada'), { status: 409 });
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
      for (const item of versions) guards.add(item);
      mutations.set(key, { fingerprint, result });
      return { replayed: false, result };
    },
  };
  const request = (path, session, body = undefined, query = {}) => dispatchWorkshop({
    path: `api/workshop/${path}`, method: body === undefined ? 'GET' : 'POST', body,
    query, session, sheets, pmChecklists,
    listMechanics: async () => [mechanic, secondMechanic],
    evidenceStorage: { find: async id => evidence.get(id) },
  });
  return { sheets, request, attach, fail: value => { fail = value; }, interrupt: hook => { beforeCommit = hook; } };
}

const report = (changes = {}) => ({
  mutationId: randomUUID(), unit: 'CA20', type: 'Neumáticos', description: 'Llanta QA',
  canMove: false, customer: 'QA', location: 'QA', downtime: '<1 hora', photos: [], ...changes,
});

const transition = (request, actor, otId, value, execution) => request('transition', actor, {
  mutationId: randomUUID(), otId, field: 'estado', value, execution,
});
const executionProof = { functionalTest: 'Prueba funcional registrada, sin fuga y con respuesta normal.' };

async function startRepair(request) {
  const { body: { otId } } = await request('report', operator, report());
  await request('transition', workshop, { mutationId: randomUUID(), otId, field: 'mecanico_asignado', value: mechanic.userId });
  await transition(request, mechanic, otId, 'En Reparación');
  return otId;
}

test('una falla confirma un mismo folio para avería, OT y bandejas después de persistir', async () => {
  const { request, sheets, attach, fail } = fixture();
  const body = report();
  assert.equal((await request('report', operator, { ...body, photos: ['https://storage-qa.supabase.co/storage/v1/object/public/falla-photos/qa.jpg'] })).status, 400);
  body.photos = [attach('report', body.mutationId, operator)];
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
  assert.equal((await transition(request, secondMechanic, otId, 'Resuelta', executionProof)).status, 200);
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

test('una OT cerrada sigue inmovilizada hasta el retorno de Operaciones por un tercero', async () => {
  const { request, sheets } = fixture();
  const otId = await startRepair(request);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta')).status, 400);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', executionProof)).status, 200);
  assert.equal((await transition(request, supervisor, otId, 'Completado')).status, 200);
  assert.deepEqual((await request('readiness', operator)).body.returns.map((entry) => entry.otId), [otId]);
  assert.deepEqual((await request('readiness', secondMechanic)).body.returns.map((entry) => entry.otId), [otId]);
  assert.deepEqual((await request('readiness', account('out-of-scope', 'operador', ['CA99']))).body.returns, []);
  assert.equal((await request('returns', supervisor)).body.returns[0].technicalBy, supervisor.userName);

  const otherSupervisor = account('operations-qa', 'supervisor');
  const body = { mutationId: randomUUID(), otId, decision: 'accepted', notes: 'Equipo recibido en patio' };
  assert.equal((await request('returns', workshop, body)).status, 403);
  assert.equal((await request('returns', supervisor, body)).status, 403);
  assert.equal((await request('returns', account('other-site', 'supervisor', ['CA99']), body)).status, 403);
  assert.equal((await request('returns', otherSupervisor, body)).status, 200);
  assert.equal((await request('returns', otherSupervisor, body)).body.replayed, true);
  assert.deepEqual((await request('readiness', operator)).body.returns, []);
  assert.equal((await sheets.read('OT_STATUS_LOG')).filter(row => row[2] === 'retorno_operativo' && row[7] === otherSupervisor.userId).length, 1);
});

test('Operaciones devuelve la entrega con fecha y motivo y el equipo queda en reparación', async () => {
  const { request, sheets } = fixture();
  const otId = await startRepair(request);
  await transition(request, mechanic, otId, 'Resuelta', executionProof);
  await transition(request, workshop, otId, 'Completado');
  const body = { mutationId: randomUUID(), otId, decision: 'returned', notes: 'Repetir prueba bajo carga' };
  assert.equal((await request('returns', supervisor, body)).status, 400);
  assert.equal((await request('returns', supervisor, { ...body, dueDate: '2099-01-01' })).status, 200);
  assert.equal((await sheets.read('ORDENES_TRABAJO'))[0][9], 'En Reparación');
  assert.equal((await sheets.read('Averias'))[0][9], 'En Reparación');
  assert.equal((await transition(request, workshop, otId, 'Completado')).status, 409);
});

test('el retorno de una OT no libera otra avería abierta de la misma unidad', async () => {
  const { request, sheets } = fixture();
  const otId = await startRepair(request);
  await transition(request, mechanic, otId, 'Resuelta', executionProof);
  await transition(request, workshop, otId, 'Completado');
  const independent = await request('report', operator, report({ type: 'Hidráulica', description: 'Otra avería del mismo equipo' }));
  const payload = { mutationId: randomUUID(), otId, decision: 'accepted', notes: 'Validación QA de retorno' };
  const blocked = await request('returns', supervisor, payload);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /avería/i);
  assert.equal((await sheets.read('ORDENES_TRABAJO')).find(row => row[1] === otId)[22], undefined);
  assert.equal((await sheets.read('Averias')).find(row => row[13] === independent.body.otId)[9], 'Abierta');
});

test('una reincidencia conserva el cierre original y queda vinculada a una nueva OT', async () => {
  const { request, sheets } = fixture();
  const otId = await startRepair(request);
  await transition(request, mechanic, otId, 'Resuelta', executionProof);
  await transition(request, workshop, otId, 'Completado');
  const payload = report({ previousOtId: otId, description: 'Reincidencia declarada QA' });
  const recurrence = await request('report', operator, payload);
  assert.equal(recurrence.status, 201);
  assert.equal(recurrence.body.previousOtId, otId);
  assert.notEqual(recurrence.body.otId, otId);
  assert.equal((await request('report', operator, payload)).body.otId, recurrence.body.otId);
  const [first, second] = await sheets.read('ORDENES_TRABAJO');
  assert.equal(first[9], 'Completado');
  assert.equal(second[24], otId);
  const log = await sheets.read('OT_STATUS_LOG');
  assert.equal(log.filter(row => row[1] === recurrence.body.otId && row[2] === 'reincidencia' && row[4] === otId).length, 1);
  assert.equal((await request('report', operator, report({ previousOtId: recurrence.body.otId }))).status, 400);
});

test('un DVIR fallido mantiene el bloqueo aunque Taller cierre la reparación', async () => {
  const { request } = fixture();
  const checks = Array.from({ length: 12 }, (_, index) => ({ status: index === 2 ? 'falla' : 'ok', notes: 'Prueba QA' }));
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date());
  const inspection = { unit: 'CA20', date, type: 'pre-operacion', meter: '4000', photos: [], observations: '', time: '07:00' };
  const { body: { otId } } = await request('dvir', operator, { ...inspection, mutationId: randomUUID(), checks });
  await request('transition', workshop, { mutationId: randomUUID(), otId, field: 'mecanico_asignado', value: mechanic.userId });
  await transition(request, mechanic, otId, 'En Reparación');
  await transition(request, mechanic, otId, 'Resuelta', executionProof);
  await transition(request, workshop, otId, 'Completado');
  const body = { mutationId: randomUUID(), otId, decision: 'accepted', notes: 'Equipo recibido en patio' };
  assert.equal((await request('returns', supervisor, body)).status, 409);
  const before = (await request('readiness', operator)).body;
  assert.equal(before.inspections[0][22], 'reprobado');
  assert.equal(before.returns[0].otId, otId);
  await request('dvir', operator, { ...inspection, time: '08:00', mutationId: randomUUID(), checks: checks.map(() => ({ status: 'ok' })) });
  assert.equal((await request('returns', supervisor, body)).status, 200);
});

test('el PM requiere el checklist de su modelo, horómetro y aceptación independiente antes de sincronizar', async () => {
  const { request, sheets, fail } = fixture([
    { model: 'Cat 745', level: 'PM250', reference: 'S03 QA Cat 745 revisión 1', tasks: [{ id: 'oil', label: 'Tarea QA de lubricación' }, { id: 'filter', label: 'Tarea QA de filtro' }] },
    { model: 'Komatsu D65', level: 'PM250', reference: 'S03 QA Komatsu', tasks: [{ id: 'track', label: 'Tarea QA de rodaje' }] },
  ]);
  const { status, body: { otId } } = await request('pm', workshop, {
    mutationId: randomUUID(), unit: 'CA20', level: 'PM-250', includedLevels: 'PM-250', hours: 2,
    mechanicId: mechanic.userId, scheduledDate: '2026-11-12', parts: 'QA', notes: 'QA',
  });
  assert.equal(status, 201);
  const checklist = (await request('pmchecklist', mechanic, undefined, { otId })).body.checklist;
  assert.equal(checklist.reference, 'S03 QA Cat 745 revisión 1');
  assert.deepEqual(checklist.tasks.map(task => task.id), ['oil', 'filter']);
  assert.equal((await request('pmchecklist', secondMechanic, undefined, { otId })).status, 403);
  await transition(request, mechanic, otId, 'En Reparación');
  const execution = { ...executionProof, performedOn: '2026-11-12', meter: '4010', completedItems: ['oil'] };
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', execution)).status, 400);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', { ...execution, completedItems: ['oil', 'track'] })).status, 400);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', { ...execution, meter: 3999, completedItems: ['oil', 'filter'] })).status, 400);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', { ...execution, completedItems: ['oil', 'filter'] })).status, 200);
  assert.equal((await sheets.read('Ordenes Mantenimiento'))[0][11], 'Programada');
  assert.equal((await transition(request, mechanic, otId, 'Completado')).status, 403);
  fail(true);
  assert.equal((await transition(request, supervisor, otId, 'Completado')).status, 503);
  assert.equal((await sheets.read('05 Historial PM'))[0][10], 'Programada');
  fail(false);
  assert.equal((await transition(request, supervisor, otId, 'Completado')).status, 200);
  const [pm] = await sheets.read('Ordenes Mantenimiento');
  const [history] = await sheets.read('05 Historial PM');
  const [schedule] = await sheets.read('WORKSHOP_SCHEDULE');
  assert.equal(pm[11], 'Completada');
  assert.equal(history[10], 'Completada');
  assert.equal(schedule[7], 'Completado');
  assert.equal(history[6], '4010');
  assert.equal(history[13], '2026-11-12');
  assert.equal(history[14], supervisor.userId);
});

test('un PM sin checklist autorizado puede programarse pero conserva explícitamente el bloqueo de entrega', async () => {
  const { request } = fixture();
  const { body: { otId } } = await request('pm', workshop, {
    mutationId: randomUUID(), unit: 'CA20', level: 'PM250', includedLevels: 'PM250', hours: 2,
    mechanicId: mechanic.userId, scheduledDate: '2026-11-12', parts: '', notes: '',
  });
  assert.equal((await request('pmchecklist', mechanic, undefined, { otId })).body.checklist, null);
  await transition(request, mechanic, otId, 'En Reparación');
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', executionProof)).status, 409);
});

test('el taller de México conserva su cierre y permisos previos', async () => {
  const { request } = fixture();
  const mexico = actor => ({ ...actor, project: 'mexico', projects: ['mexico'] });
  const { body: { otId } } = await request('report', mexico(operator), report());
  const lead = mexico(workshop);
  const supervisorMexico = mexico(account('supervisor-mx', 'supervisor'));
  assert.equal((await transition(request, lead, otId, 'En Reparación')).status, 200);
  assert.equal((await transition(request, lead, otId, 'Resuelta')).status, 200);
  assert.equal((await transition(request, lead, otId, 'Completado')).status, 200);
  assert.equal((await request('stickers', supervisorMexico)).status, 200);
  assert.equal((await request('returns', supervisorMexico)).status, 404);
  assert.deepEqual((await request('readiness', mexico(operator))).body.returns, []);
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
  const { request, sheets, attach } = fixture();
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
  const fieldSupervisor = account('field-supervisor-qa', 'supervisor');
  assert.equal((await request('stickers', fieldSupervisor)).status, 403);
  assert.equal((await request('stickerreview', fieldSupervisor, review)).status, 403);
  assert.equal((await request('sticker', fieldSupervisor, { ...body, mutationId: randomUUID(), approve: true })).status, 403);
  assert.equal((await request('stickers', supervisor)).body.stickers[0].folio, review.folio);
  assert.equal((await request('stickerreview', supervisor, review)).body.canDispatch, true);
  assert.equal((await request('stickerreview', supervisor, review)).body.replayed, true);
  const [sticker] = await sheets.read('Inspeccion_Stickers');
  assert.equal(sticker[18], operator.userId);
  assert.equal(sticker[19], supervisor.userId);

  const hardStop = template.items.find((item) => item.hardStop);
  const mutationId = randomUUID();
  const photo = attach('sticker', mutationId, operator);
  const fail = { ...body, mutationId, photos: [photo], checks: checklist.map((item) => item.itemId === hardStop.id
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

test('Panamá exige otro revisor HSE aunque quien capture ya tenga facultad HSE', async () => {
  const { request } = fixture();
  const { getStickerTemplate } = await import('../../src/data/sticker-inspection-templates.js');
  const template = getStickerTemplate('camion_articulado');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date());
  const body = { mutationId: randomUUID(), unit: 'CA20', templateId: template.id, company: 'QA', date,
    time: '07:00', finalColor: 'green', checks: template.items.map(({ id }) => ({ itemId: id, status: 'cumple' })) };
  assert.equal((await request('sticker', supervisor, { ...body, approve: true })).status, 403);
  const pending = await request('sticker', supervisor, body);
  assert.equal(pending.status, 201);
  assert.equal(pending.body.canDispatch, false);
  const review = { mutationId: randomUUID(), folio: pending.body.folio };
  assert.equal((await request('stickerreview', supervisor, review)).status, 403);
  assert.deepEqual((await request('stickers', supervisor)).body.stickers, []);
  const independent = { ...account('hse-independent', 'supervisor'), canReviewPanamaHse: true };
  assert.equal((await request('stickerreview', independent, review)).body.canDispatch, true);
});

test('Taller puede comprobar el checklist exacto por unidad y nivel antes de programar', async () => {
  const { request } = fixture([{ model: 'Cat 745', level: 'PM250', reference: 'QA revisión 1', tasks: [{ id: 'oil', label: 'Tarea QA' }] }]);
  const expected = { model: 'Cat 745', level: 'PM-250', checklist: { reference: 'QA revisión 1', tasks: [{ id: 'oil', label: 'Tarea QA' }] } };
  assert.deepEqual(await request('pmtemplate', workshop, undefined, { unit: 'CA20', level: 'PM-250' }), { status: 200, body: expected });
  assert.equal((await request('pmtemplate', workshop, undefined, { unit: 'CA20', level: 'PM-500' })).body.checklist, null);
  assert.equal((await request('pmtemplate', { ...workshop, assignedUnits: ['DZ203'] }, undefined, { unit: 'CA20', level: 'PM-250' })).status, 403);
  assert.equal((await request('pmtemplate', operator, undefined, { unit: 'CA20', level: 'PM-250' })).status, 403);
});


test('un retorno no se confirma si otra avería se guarda entre la validación y el commit', async () => {
  const { request, sheets, interrupt } = fixture();
  const otId = await startRepair(request);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', executionProof)).status, 200);
  assert.equal((await transition(request, workshop, otId, 'Completado')).status, 200);
  const body = { mutationId: randomUUID(), otId, decision: 'accepted', notes: 'Prueba de retorno concurrente' };
  interrupt(async () => {
    assert.equal((await request('report', operator, report({ description: 'Otra avería concurrente' }))).status, 201);
  });
  assert.equal((await request('returns', supervisor, body)).status, 409);
  assert.match((await request('returns', supervisor, body)).body.error, /Retorno bloqueado/);
  assert.equal((await sheets.read('OT_STATUS_LOG')).filter(row => row[2] === 'retorno_operativo').length, 0);
});


test('Taller puede revisar las horas reales del mecánico después de guardar la entrega', async () => {
  const { request } = fixture();
  const otId = await startRepair(request);
  const invalid = await transition(request, mechanic, otId, 'Resuelta', { ...executionProof, laborHours: '-2' });
  assert.equal(invalid.status, 400);
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', { ...executionProof, laborHours: '2.25' })).status, 200);
  const { body } = await request('orders', workshop);
  const row = body.orders.find(item => item[1] === otId);
  assert.equal(JSON.parse(row[20]).laborHours, 2.25);
  assert.match(body.history.find(item => item[2] === 'entrega_tecnica')[4], /2.25 h de trabajo/);
});
