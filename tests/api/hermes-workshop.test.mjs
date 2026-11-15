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
const secondMechanic = { ...account('mechanic-qa-2', 'mecanico'), userName: 'QA segundo mecánico' };
const supervisor = { ...account('supervisor-qa', 'supervisor'), canReviewPanamaHse: true };
const manager = account('manager-qa', 'gerencia');

function fixture(pmChecklists = [], triggers = {}) {
  const data = new Map([['01 Inventario', [[], [], [], ['', 'CA20', '', 'Cat', '745', '', '', '', '', '4000']]]]);
  const mutations = new Map();
  const evidence = new Map();
  const attach = (kind, operationId, session, unit = 'CA20', recordId = '') => {
    const id = randomUUID().replaceAll('-', '').repeat(2);
    evidence.set(id, { ready: true, actor_id: session.userId, kind, operation_id: operationId,
      units: [unit], record_id: recordId, preview_demo: false });
    return `/hermes-api/api/evidence?id=${id}`;
  };
  const guards = new Set();
  let fail = false;
  let beforeCommit;
  const sheets = {
    async read(tab) { return structuredClone(data.get(tab) || []); },
    seed(tab, rows) { data.set(tab, structuredClone(rows)); },
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
  if (triggers.workshopMaster) sheets.readWorkshopMasters = async () => triggers.workshopMaster;
  const request = (path, session, body = undefined, query = {}) => dispatchWorkshop({
    path: `api/workshop/${path}`, method: body === undefined ? 'GET' : 'POST', body,
    query, session, sheets, pmChecklists, ...triggers,
    listMechanics: triggers.listMechanics ?? (async () => [mechanic, secondMechanic]),
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

test('tiempo caído une dos OT superpuestas y reparte el intervalo una vez entre turnos de Panamá', async () => {
  const { request, sheets } = fixture([], {
    now: new Date('2026-11-14T02:00:00Z'),
    downtimeShiftStarts: { day: '06:00', night: '18:00' },
    workshopMaster: { failures: { records: [{ id: 'AV-QA', order: 'OT-0102', unit: 'CA20', last: '13-Nov-2026', status: 'Detenido reportado' }] } },
  });
  const failure = (id, unit, start, cause) => {
    const row = Array(17).fill('');
    Object.assign(row, { 0: '13/11/2026', 2: unit, 3: cause, 11: 'Puede moverse: No', 13: id, 15: 'operator-qa',
      16: JSON.stringify({ stopped: true, startedAt: start }) });
    return row;
  };
  sheets.seed('Averias', [
    failure('OT-FIRST', 'CA20', '2026-11-13T21:30:00Z', 'Hidráulica'),
    failure('OT-SECOND', 'CA20', '2026-11-13T22:00:00Z', 'Motor'),
    failure('OT-OTHER', 'EX401', '2026-11-13T20:00:00Z', 'Eléctrica'),
    failure('OT-CORRUPT', 'CA20', '2026-11-13T17:00:00Z', 'Frenos'),
    failure('OT-SAME-ACTOR', 'CA20', '2026-11-13T18:00:00Z', 'Frenos'),
    Object.assign(failure('OT-FUTURE', 'CA20', '2026-11-12T19:00:00Z', 'Frenos'), { 0: '12/11/2026' }),
    ['13/11/2026', '', 'CA20', 'Transmisión', '', '', '', '>8 horas', '', 'Abierta', '', 'Puede moverse: No | OT: OT-LEGACY', '', 'foto-legada'],
  ]);
  const order = (id, unit, end, folio) => {
    const row = Array(26).fill('');
    Object.assign(row, { 1: id, 3: unit, 4: 'Avería', 9: end ? 'Completado' : 'En Reparación', 25: folio });
    if (end) {
      row[20] = JSON.stringify({ userId: 'mechanic-qa', functionalTest: 'Prueba funcional QA' });
      row[21] = JSON.stringify({ userId: 'workshop-qa', acceptedAt: end });
      row[22] = JSON.stringify({ decision: 'accepted', userId: 'supervisor-qa', returnedAt: end, recordedAt: end });
    }
    return row;
  };
  const corrupt = order('OT-CORRUPT', 'CA20', '2026-11-14T00:30:00Z', 'OT-0106');
  corrupt[22] = '{"decision":';
  const sameActor = order('OT-SAME-ACTOR', 'CA20', '2026-11-14T00:30:00Z', 'OT-0107');
  sameActor[21] = JSON.stringify({ userId: 'mechanic-qa', acceptedAt: '2026-11-14T00:30:00Z' });
  const future = order('OT-FUTURE', 'CA20', '2026-11-14T00:30:00Z', 'OT-0108');
  future[22] = JSON.stringify({ ...JSON.parse(future[22]), recordedAt: '2026-11-14T03:00:00Z' });
  sheets.seed('ORDENES_TRABAJO', [
    order('OT-FIRST', 'CA20', '2026-11-14T00:30:00Z', 'OT-0102'),
    order('OT-SECOND', 'CA20', '2026-11-14T01:30:00Z', 'OT-0103'),
    order('OT-OTHER', 'EX401', null, 'OT-0104'), order('OT-LEGACY', 'CA20', null, 'OT-0105'), corrupt, sameActor, future,
  ]);
  const query = { from: '2026-11-13', through: '2026-11-13' };
  assert.equal((await request('downtime', mechanic, undefined, query)).status, 403);
  const response = await request('downtime', workshop, undefined, query);
  assert.equal(response.status, 200);
  assert.equal(response.body.intervals.length, 1);
  const [interval] = response.body.intervals;
  assert.deepEqual([interval.unit, interval.seconds, interval.open, interval.causes], ['CA20', 14400, false, ['Hidráulica', 'Motor']]);
  assert.deepEqual(interval.orders.map(order => order.folio), ['OT-0102', 'OT-0103']);
  assert.deepEqual(interval.segments.map(row => [row.date, row.shift, row.seconds]), [
    ['2026-11-13', 'Día', 5400], ['2026-11-13', 'Noche', 9000],
  ]);
  assert.deepEqual(response.body.pending.map(row => row.folio), ['OT-0106', 'OT-0107', 'OT-0108', 'OT-0105', 'OT-0102']);
  assert.deepEqual(response.body.pending.at(-1), { date: '2026-11-13', unit: 'CA20', folio: 'OT-0102',
    reason: 'Hermes registra el retorno y el Maestro de Taller aún indica parada' });
});

test('el filtro recorta las horas y atribuye la madrugada al turno que comenzó la víspera', async () => {
  const { request, sheets } = fixture([], {
    now: new Date('2026-11-14T12:00:00Z'),
    downtimeShiftStarts: { day: '06:00', night: '18:00' },
  });
  const failure = Array(17).fill('');
  Object.assign(failure, { 0: '13/11/2026', 2: 'CA20', 3: 'Hidráulica', 13: 'OT-NOCHE',
    16: JSON.stringify({ stopped: true, startedAt: '2026-11-14T04:00:00Z' }) });
  sheets.seed('Averias', [failure]);
  sheets.seed('ORDENES_TRABAJO', [['', 'OT-NOCHE', '', 'CA20', 'Avería', '', '', '', '', 'Abierta']]);
  const { body } = await request('downtime', workshop, undefined, { from: '2026-11-14', through: '2026-11-14' });
  assert.equal(body.seconds, 7 * 3600);
  assert.deepEqual(body.intervals[0].segments.map(({ date, shift, seconds }) => [date, shift, seconds]), [
    ['2026-11-13', 'Noche', 6 * 3600], ['2026-11-14', 'Día', 3600],
  ]);
  assert.equal((await request('downtime', workshop, undefined, { from: '2026-10-14', through: '2026-11-14' })).status, 400);
  assert.equal((await request('downtime', workshop, undefined, { unit: 'EX401' })).status, 403);
});

test('una hora automática futura permite reportar y queda pendiente, igual que un comprobante dañado', async () => {
  const { request, sheets } = fixture();
  const created = await request('report', operator, report({ stopReportedAt: new Date(Date.now() + 3_600_000).toISOString() }));
  assert.equal(created.status, 201);
  const saved = (await sheets.read('Averias'))[0];
  assert.deepEqual(JSON.parse(saved[16]), { stopped: true, startedAt: null, source: 'pending' });
  saved[0] = '12/11/2026';
  saved[16] = '{"stopped":';
  sheets.seed('Averias', [saved]);
  const result = await request('downtime', workshop, undefined, { from: '2026-11-13', through: '2026-11-13' });
  assert.equal(result.body.seconds, 0);
  assert.deepEqual(result.body.pending.map(row => row.folio), [created.body.otId]);
});

test('una falla con movilidad puede registrar una parada explícita y un retorno técnico no la cierra', async () => {
  const { request, sheets } = fixture();
  const data = report({ canMove: true, stopped: true, stopStartedAt: new Date(Date.now()-10*60_000).toISOString() });
  const created = await request('report', operator, data);
  assert.equal(created.status, 201);
  const [row] = await sheets.read('Averias');
  assert.deepEqual(JSON.parse(row[16]), { stopped: true, startedAt: data.stopStartedAt, source: 'operator' });
  assert.equal((await request('report', operator, data)).body.otId, created.body.otId);
  assert.equal((await sheets.read('Averias')).length, 1);
  assert.equal((await request('report', operator, report({ canMove: false, stopped: false }))).status, 400);
  await request('transition', workshop, { mutationId: randomUUID(), otId: created.body.otId, field: 'mecanico_asignado', value: mechanic.userId });
  assert.equal((await transition(request, mechanic, created.body.otId, 'En Reparación')).status, 200);
  assert.equal((await transition(request, mechanic, created.body.otId, 'Resuelta', { ...executionProof, diagnosis: 'Manguera rota' })).status, 200);
  assert.equal((await transition(request, workshop, created.body.otId, 'Completado')).status, 200);
  const open = await request('downtime', workshop);
  assert.equal(open.body.intervals[0].open, true);
  assert.equal(open.body.intervals[0].segments.length, 0);
  assert.equal(open.body.shiftStarts, null);
  const returned = await request('returns', supervisor, { mutationId: randomUUID(), otId: created.body.otId, decision: 'accepted', notes: 'Operación confirmó el retorno.' });
  assert.equal(returned.status, 200);
  const closed = await request('downtime', workshop);
  assert.equal(closed.body.intervals[0].open, false);
  assert.equal(closed.body.intervals[0].endedAt, returned.body.receipt.returnedAt);
  assert.deepEqual(closed.body.intervals[0].causes, ['Manguera rota']);
});

test('un servicio PM conserva los tres disparadores y dos confirmaciones producen una sola OT', async () => {
  const sources = { sections: {
    maintenance: [{ unit: 'CA20', next: 'PM-250', hours: '4000', due: '3990', reading: 'Actualizada' }],
    maintenancePlan: [{ unit: 'CA20', active: 'Sí', approved: 'Sí' }],
    dozers: [{ unit: 'CA20', critical: '2', noData: '0' }],
  }, snapshots: { maintenance: '2026-11-13T13:00:00Z' } };
  const pmTriggerRules = [{ unit: 'CA20', level: 'PM-250', reference: 'Plan QA rev1',
    dueDate: '2026-11-12', condition: { source: 'dozers', minCritical: 1 } }];
  const { request, sheets } = fixture([], { readPmSources: async () => sources, pmTriggerRules });
  const preflight = await request('pmtriggers', workshop, undefined, { unit: 'CA20', level: 'PM250' });
  assert.equal(preflight.status, 200);
  assert.deepEqual(preflight.body.rules.map(r => [r.kind,r.state,r.actual,r.threshold]), [
    ['hours','due',4000,3990],['date','due',preflight.body.today,'2026-11-12'],['condition','due',2,1],
  ]);
  assert.equal((await request('pmtriggers', operator, undefined, { unit: 'CA20', level: 'PM250' })).status, 403);
  const base = { unit: 'CA20', level: 'PM-250', includedLevels: 'PM-250', scheduledDate: '2026-11-16', hours: '2' };
  const [one,two] = await Promise.all([workshop,coordinator].map(actor => request('pm', actor, { ...base, mutationId: randomUUID() })));
  assert.deepEqual([one.status,two.status].sort(), [200,201]);
  assert.equal(one.body.otId,two.body.otId);
  assert.equal((await sheets.read('WORKSHOP_SCHEDULE')).length,1);
  const [order] = await sheets.read('ORDENES_TRABAJO');
  const reasons = JSON.parse(order[23]).triggers;
  assert.deepEqual(reasons.map(reason => reason.kind), ['hours','date','condition']);
  assert.equal(reasons[0].cut,'2026-11-13T13:00:00Z');
  order[9] = 'Completado';
  sheets.seed('ORDENES_TRABAJO',[order]);
  const stale = await request('pm', workshop, { ...base, mutationId: randomUUID() });
  assert.equal(stale.body.otId,order[1]);
  sources.sections.maintenance[0].due = '4220';
  sources.sections.maintenance[0].hours = '4221';
  const next = await request('pm', workshop, { ...base, mutationId: randomUUID() });
  assert.equal(next.status,201);
  assert.notEqual(next.body.otId,order[1]);
  assert.deepEqual(JSON.parse((await sheets.read('ORDENES_TRABAJO'))[1][23]).triggers.map(reason => reason.kind), ['hours']);
});

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

test('reasignar una OT actualiza su calendario, conserva el trabajo y transfiere el acceso', async () => {
  const { request } = fixture();
  const otId = await startRepair(request);
  const change = (actor, field, value) => request('transition', actor, { mutationId: randomUUID(), otId, field, value });
  assert.equal((await change(mechanic, 'progreso', '75')).status, 200);
  const scheduled = await request('schedule', workshop, {
    mutationId: randomUUID(), otId, date: '2026-11-18', hours: '2.5', notes: 'Revisar mangueras',
  });
  assert.equal(scheduled.status, 200);
  const reassign = { mutationId: randomUUID(), otId, field: 'mecanico_asignado', value: secondMechanic.userId };
  assert.equal((await request('transition', coordinator, reassign)).status, 200);
  assert.equal((await request('transition', coordinator, reassign)).body.replayed, true);
  assert.equal((await change(mechanic, 'progreso', '80')).status, 403);
  assert.deepEqual((await request('orders', mechanic)).body.orders, []);

  const { orders, history } = (await request('orders', secondMechanic)).body;
  assert.equal(orders[0][1], otId);
  assert.equal(orders[0][16], '75');
  assert.equal(orders[0][17], secondMechanic.userId);
  assert.deepEqual(history.filter(entry => entry[2] === 'mecanico_asignado' && entry[3])
    .map(entry => [entry[3], entry[4], entry[7]]), [[mechanic.userName, secondMechanic.userName, coordinator.userId]]);

  const { body: { schedule } } = await request('schedule', workshop);
  assert.equal(schedule.length, 1);
  assert.deepEqual(schedule[0].slice(1, 10), [
    '2026-11-18', otId, 'CA20', secondMechanic.userName, '2.5', 'CRITICA', 'Programado', 'Revisar mangueras', secondMechanic.userId,
  ]);
  assert.equal((await transition(request, secondMechanic, otId, 'Resuelta',
    { ...executionProof, diagnosis: 'Manguera dañada', laborHours: 2.5 })).status, 200);
  const [resolved] = (await request('orders', secondMechanic)).body.orders;
  assert.equal(JSON.parse(resolved[20]).diagnosis, 'Manguera dañada');
  assert.equal(JSON.parse(resolved[20]).laborHours, 2.5);
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
  await transition(request, mechanic, otId, 'Resuelta', { ...executionProof, diagnosis: 'Daño confirmado en banda lateral.' });
  await transition(request, workshop, otId, 'Completado');
  const previous = await sheets.read('ORDENES_TRABAJO');
  while (previous[0].length <= 25) previous[0].push('');
  previous[0][25] = 'OT-0100';
  sheets.seed('ORDENES_TRABAJO', previous);
  const payload = report({ previousOtId: 'OT-0100', description: 'Reincidencia declarada QA' });
  const recurrence = await request('report', operator, payload);
  assert.equal(recurrence.status, 201);
  assert.equal(recurrence.body.previousOtId, otId);
  assert.notEqual(recurrence.body.otId, otId);
  assert.equal((await request('report', operator, payload)).body.otId, recurrence.body.otId);
  const [first, second] = await sheets.read('ORDENES_TRABAJO');
  assert.equal(first[9], 'Completado');
  assert.equal(JSON.parse(first[20]).diagnosis, 'Daño confirmado en banda lateral.');
  assert.equal(second[24], otId);
  const log = await sheets.read('OT_STATUS_LOG');
  assert.equal(log.filter(row => row[1] === recurrence.body.otId && row[2] === 'reincidencia' && row[4] === otId).length, 1);
  assert.equal((await request('report', operator, report({ previousOtId: recurrence.body.otId }))).status, 400);
});

test('reintentar un DVIR reprobado conserva su única OT y evidencia en dos familias', async () => {
  const { request, sheets, attach } = fixture();
  const units = ['CA20', 'EX401'];
  sheets.seed('01 Inventario', [[], [], [],
    ['', 'CA20', 'Camión articulado', 'Cat', '745'],
    ['', 'EX401', 'Excavadora', 'Develon', 'DX360'],
  ]);
  const inspector = account('operator-dvir-qa', 'operador', units);
  const reviewer = account('coordinator-dvir-qa', 'coordinador', units);
  const checks = Array.from({ length: 12 }, (_, index) => index === 2
    ? { status: 'falla', notes: 'Hallazgo QA' } : { status: 'ok' });
  for (const [unit, model] of [['CA20', 'Cat 745'], ['EX401', 'Develon DX360']]) {
    const mutationId = randomUUID();
    const photo = attach('dvir', mutationId, inspector, unit);
    const body = { mutationId, unit, date: '2026-11-15', time: '07:20', type: 'pre-operacion', meter: 4000, checks, photos: [photo] };
    const initial = await request('dvir', inspector, body);
    assert.equal(initial.status, 201);
    const { otId, inspectionId } = initial.body;
    const retry = await request('dvir', inspector, body);
    assert.equal(retry.status, 200);
    assert.deepEqual([retry.body.otId, retry.body.inspectionId, retry.body.replayed], [otId, inspectionId, true]);
    const inspections = (await sheets.read('14 Inspecciones')).filter(row => row[4] === unit);
    assert.deepEqual(inspections.map(row => [row[1], row[5], row[24], row[25]]), [[inspectionId, model, photo, otId]]);
    const orders = (await request('orders', reviewer)).body.orders.filter(row => row[3] === unit);
    assert.deepEqual(orders.map(row => [row[1], row[4], row[10]]), [[otId, 'DVIR', photo]]);
    assert.equal((await sheets.read('Averias')).filter(row => row[13] === otId).length, 1);
  }
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

async function pmBatchFixture() {
  const sources = { sections: {
    maintenance: [
      { unit: 'CA20', next: 'PM-250', hours: '4000', due: '3990', reading: 'Actualizada' },
      { unit: 'DZ203', next: 'PM-500', hours: '1500', due: '1520', reading: 'Actualizada' },
    ],
    maintenancePlan: ['CA20', 'DZ203'].map(unit => ({ unit, active: 'Sí', approved: 'Sí' })),
  }, snapshots: { maintenance: '2026-11-15T17:00:00Z', maintenancePlan: '2026-11-15T17:00:00Z' } };
  const checklists = [
    { model: 'Cat 745', level: 'PM-250', reference: 'QA articulado', tasks: [{ id: 'oil', label: 'Aceite QA' }] },
    { model: 'Komatsu D155AX-6', level: 'PM-500', reference: 'QA variante por PIN', serial: 'PIN-QA', tasks: [{ id: 'filter', label: 'Filtro QA' }] },
  ];
  const env = fixture(checklists, { readPmSources: async () => sources,
    listMechanics: async () => [{ ...mechanic, assignedUnits: ['CA20', 'DZ203', 'EX410'] }] });
  env.sheets.seed('01 Inventario', [...await env.sheets.read('01 Inventario'), ['', 'DZ203', '', 'Komatsu', 'D155AX-6', '', 'PIN-QA']]);
  const lead = { ...workshop, assignedUnits: ['CA20', 'DZ203'] };
  const batch = { items: [{ unit: 'CA20', hours: '2' }, { unit: 'DZ203', hours: '3' }],
    scheduledDate: '2026-11-16', shift: 'Día', partsStatus: 'not_required' };
  return { ...env, sources, lead, batch };
}

test('PM por lote conserva folio, checklist y vencimiento propios en una sola escritura y al reintentar', async () => {
  const { request, sheets, lead, batch, sources } = await pmBatchFixture();
  const review = await request('pmbatchcheck', lead, batch);
  assert.equal(review.status, 200);
  assert.deepEqual(review.body.items.map(row => [row.unit, row.level, row.dueAt, row.checklistReference]), [
    ['CA20', 'PM-250', 3990, 'QA articulado'], ['DZ203', 'PM-500', 1520, 'QA variante por PIN'],
  ]);
  assert.deepEqual(await sheets.read('ORDENES_TRABAJO'), []);
  const save = { ...batch, mutationId: randomUUID(), confirmation: review.body.confirmation };
  const result = await request('pmbatch', lead, save);
  assert.equal(result.status, 201);
  const orderIds = result.body.orders.map(row => row.otId);
  assert.equal(new Set(orderIds).size, 2);
  assert.deepEqual((await sheets.read('WORKSHOP_SCHEDULE')).map(row => [row[2], row[3], row[5], row[11]]), [
    [orderIds[0], 'CA20', '2', 'Día'], [orderIds[1], 'DZ203', '3', 'Día'],
  ]);
  for (const [index, otId] of orderIds.entries()) {
    const reopened = await request('pmchecklist', lead, undefined, { otId });
    assert.deepEqual(
      [reopened.body.level, reopened.body.initialMeter, reopened.body.dueAt, reopened.body.checklist.reference],
      index === 0 ? ['PM-250', '4000', 3990, 'QA articulado'] : ['PM-500', '1500', 1520, 'QA variante por PIN'],
    );
  }
  sources.sections.maintenance = null;
  const replay = await request('pmbatch', lead, save);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.deepEqual(replay.body.orders, result.body.orders);
  assert.equal((await request('pmbatch', workshop, save)).status, 403);
  assert.equal((await sheets.read('ORDENES_TRABAJO')).length, 2);
});

test('PM por lote rechaza roles, unidades repetidas y vencimientos cambiados sin guardar una parte', async () => {
  const { request, sheets, lead, batch, sources } = await pmBatchFixture();
  assert.equal((await request('pmbatchcheck', operator, batch)).status, 403);
  assert.equal((await request('pmbatchcheck', workshop, batch)).status, 403);
  assert.equal((await request('pmbatchcheck', lead, { ...batch, items: [batch.items[0], { unit: 'ca20', hours: '3' }] })).status, 400);
  const review = await request('pmbatchcheck', lead, batch);
  assert.equal(review.status, 200);
  sources.sections.maintenance[1].due = '1530';
  const saved = await request('pmbatch', lead, { ...batch, mutationId: randomUUID(), confirmation: review.body.confirmation });
  assert.equal(saved.status, 409);
  for (const tab of ['ORDENES_TRABAJO', 'Ordenes Mantenimiento', 'WORKSHOP_SCHEDULE']) assert.deepEqual(await sheets.read(tab), []);
  sources.sections.maintenancePlan[1].approved = 'No';
  const unapproved = await request('pmbatchcheck', lead, batch);
  assert.equal(unapproved.status, 409);
  assert.match(unapproved.body.error, /DZ203/);
});

test('PM por lote se puede programar con una lectura directa del maestro sin fecha de corte publicada', async () => {
  const { request, lead, batch, sources } = await pmBatchFixture();
  sources.snapshots = {};
  const review = await request('pmbatchcheck', lead, batch);
  assert.equal(review.status, 200);
  const saved = await request('pmbatch', lead, { ...batch, mutationId: randomUUID(), confirmation: review.body.confirmation });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.body.orders.map(row => row.dueAt), [3990, 1520]);
});

test('una programación individual concurrente impide guardar un lote parcialmente', async () => {
  const { request, sheets, lead, batch, interrupt } = await pmBatchFixture();
  const review = await request('pmbatchcheck', lead, batch);
  assert.equal(review.status, 200);
  interrupt(async () => {
    const single = await request('pm', lead, {
      mutationId: randomUUID(), unit: 'DZ203', level: 'PM-500', includedLevels: 'PM-500', hours: 3, scheduledDate: batch.scheduledDate,
    });
    assert.equal(single.status, 201);
  });
  const result = await request('pmbatch', lead, { ...batch, mutationId: randomUUID(), confirmation: review.body.confirmation });
  assert.equal(result.status, 409);
  assert.deepEqual((await sheets.read('ORDENES_TRABAJO')).map(row => row[3]), ['DZ203']);
  assert.deepEqual((await sheets.read('WORKSHOP_SCHEDULE')).map(row => row[3]), ['DZ203']);
});

test('el mismo lote recupera el comprobante si se guardó mientras la segunda solicitud revisaba los datos', async () => {
  const { request, sheets, lead, batch } = await pmBatchFixture();
  const review = await request('pmbatchcheck', lead, batch);
  const save = { ...batch, mutationId: randomUUID(), confirmation: review.body.confirmation };
  const readOrders = sheets.read.bind(sheets);
  let competing;
  sheets.read = async tab => {
    if (tab === 'ORDENES_TRABAJO') {
      sheets.read = readOrders;
      competing = await request('pmbatch', lead, save);
    }
    return readOrders(tab);
  };
  const duplicate = await request('pmbatch', lead, save);
  assert.equal(competing.status, 201);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(duplicate.body.orders, competing.body.orders);
  assert.equal((await sheets.read('ORDENES_TRABAJO')).length, 2);
});

test('una programación concurrente obliga a revisar la sobrecarga conjunta antes de confirmar el lote', async () => {
  const { request, sheets, lead, batch: input, interrupt } = await pmBatchFixture();
  sheets.seed('01 Inventario', [...await sheets.read('01 Inventario'), ['', 'EX410', '', 'Mack', 'Granite']]);
  const scheduler = { ...lead, assignedUnits: [...lead.assignedUnits, 'EX410'] };
  const batch = { ...input, mechanicId: mechanic.userId };
  const review = await request('pmbatchcheck', scheduler, batch);
  assert.equal(review.status, 200);
  assert.deepEqual(review.body.warnings, []);
  interrupt(async () => {
    const single = await request('pm', scheduler, { mutationId: randomUUID(), unit: 'EX410',
      level: 'PM-500', includedLevels: 'PM-500', hours: '4', mechanicId: mechanic.userId, scheduledDate: batch.scheduledDate });
    assert.equal(single.status, 201);
  });
  const original = { ...batch, mutationId: randomUUID(), confirmation: review.body.confirmation };
  assert.equal((await request('pmbatch', scheduler, original)).status, 409);
  assert.equal((await sheets.read('WORKSHOP_SCHEDULE')).length, 1);
  const recheck = await request('pmbatchcheck', scheduler, batch);
  assert.match(recheck.body.warnings[0].message, /9 h/);
  assert.equal((await request('pmbatch', scheduler, { ...original, confirmation: recheck.body.confirmation })).status, 201);
  assert.equal((await sheets.read('WORKSHOP_SCHEDULE')).length, 3);
});

test('el PM conserva la revisión por PIN y exige evidencia privada vinculada al paso', async () => {
  const general = { model: 'Cat 745', level: 'PM250', reference: 'QA modelo', tasks: [{ id: 'general', label: 'Tarea general QA' }] };
  const specific = { ...general, serial: 'PIN-123', reference: 'QA revisión específica', tasks: [{ id: 'oil', label: 'Tarea QA', evidence: 'photo' }] };
  const { request, sheets, attach } = fixture([general, specific]);
  const [,,, equipment] = await sheets.read('01 Inventario');
  equipment[6] = 'PIN-123';
  sheets.seed('01 Inventario', [equipment]);
  const definition = await request('pmtemplate', workshop, undefined, { unit: 'CA20', level: 'PM-250' });
  assert.equal(definition.body.checklist?.reference, 'QA revisión específica');
  const created = await request('pm', workshop, {
    mutationId: randomUUID(), unit: 'CA20', level: 'PM250', includedLevels: 'PM250', hours: 2,
    mechanicId: mechanic.userId, scheduledDate: '2026-11-12',
  });
  assert.equal(created.status, 201);
  const { otId } = created.body;
  equipment[6] = 'PIN-999';
  sheets.seed('01 Inventario', [equipment]);
  assert.equal((await request('pmchecklist', mechanic, undefined, { otId })).body.checklist?.reference, 'QA revisión específica');
  assert.equal((await request('pmtemplate', workshop, undefined, { unit: 'CA20', level: 'PM-250' })).body.checklist?.reference, 'QA modelo');
  equipment[6] = '';
  sheets.seed('01 Inventario', [equipment]);
  assert.equal((await request('pmtemplate', workshop, undefined, { unit: 'CA20', level: 'PM-250' })).body.checklist, null);
  assert.equal((await transition(request, mechanic, otId, 'En Reparación')).status, 200);
  const execution = { ...executionProof, performedOn: '2026-11-12', meter: '4100', completedItems: ['oil'] };
  assert.equal((await transition(request, mechanic, otId, 'Resuelta', execution)).status, 400);
  const mutationId = randomUUID();
  const photo = attach('order', mutationId, mechanic, 'CA20', otId);
  const save = { mutationId, otId, field: 'estado', value: 'Resuelta' };
  const wrongPhoto = attach('order', mutationId, mechanic, 'CA20', 'OT-OTRA');
  assert.equal((await request('transition', mechanic, { ...save, execution: { ...execution, taskEvidence: { oil: wrongPhoto } } })).status, 400);
  assert.equal((await request('transition', mechanic, { ...save, execution: { ...execution, taskEvidence: { oil: photo } } })).status, 200);
  const [order] = await sheets.read('ORDENES_TRABAJO');
  assert.deepEqual(JSON.parse(order[20]).taskEvidence, { oil: photo });
  assert.ok(order[10].includes(photo));
});

test('la programación advierte sobrecarga y repuestos pendientes antes de guardar', async () => {
  const { request, sheets } = fixture();
  sheets.seed('WORKSHOP_SCHEDULE', [
    ['a','2026-11-12','OT-QA-1','CA20',mechanic.userName,'7','MEDIA','Programado','',mechanic.userId],
    ['b','2026-11-12','OT-QA-2','CA20',mechanic.userName,'8','MEDIA','Completado','',mechanic.userId],
  ]);
  const resourcePlan = { mechanicId: mechanic.userId, hours: '2', shift: 'Día', partsStatus: 'pending', partsDetail: 'Filtro QA' };
  const check = await request('schedulecheck', workshop, undefined, { unit: 'CA20', date: '2026-11-12', ...resourcePlan });
  assert.equal(check.status, 200);
  assert.deepEqual(check.body.warnings.map(item => item.code), ['capacity', 'parts']);
  assert.equal(check.body.plannedHours, 9);
  const pm = { mutationId: randomUUID(), unit: 'CA20', level: 'PM250', includedLevels: 'PM250', scheduledDate: '2026-11-12', ...resourcePlan };
  assert.equal((await request('pm', workshop, pm)).status, 409);
  assert.deepEqual(await sheets.read('ORDENES_TRABAJO'), []);
  const scheduled = await request('pm', workshop, { ...pm, scheduleConfirmation: check.body.confirmation });
  assert.equal(scheduled.status, 201);
  assert.deepEqual(scheduled.body.schedule.slice(11), ['Día', 'pending', 'Filtro QA']);
  const recheck = await request('schedulecheck', workshop, undefined, { otId: scheduled.body.otId, date: '2026-11-12', hours: '1' });
  assert.equal(recheck.body.plannedHours, 8);
  assert.deepEqual(recheck.body.warnings.map(item => item.code), ['parts']);
  const scheduledRows = await sheets.read('WORKSHOP_SCHEDULE');
  sheets.seed('WORKSHOP_SCHEDULE', [...scheduledRows, ['c','2026-11-12','OT-QA-3','CA20',mechanic.userName,'1','MEDIA','Programado','',mechanic.userId]]);
  const update = { mutationId: randomUUID(), otId: scheduled.body.otId, date: '2026-11-12', hours: '1' };
  assert.equal((await request('schedule', workshop, { ...update, scheduleConfirmation: recheck.body.confirmation })).status, 409);
  assert.equal((await sheets.read('WORKSHOP_SCHEDULE')).find(row => row[2] === scheduled.body.otId)[5], '2');
  const current = await request('schedulecheck', workshop, undefined, { otId: update.otId, date: update.date, hours: update.hours });
  assert.equal((await request('schedule', workshop, { ...update, scheduleConfirmation: current.body.confirmation })).status, 200);
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
