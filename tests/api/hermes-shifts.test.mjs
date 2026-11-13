import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';

const account = (role, id, units = ['EX401'], project = 'tmf-panama') => ({
  role, userId: id, userName: `QA ${id}`, assignedUnits: units, allUnits: false, project,
});
const operator = account('operador', 'operator');
const supervisor = account('supervisor', 'supervisor');
const coordinator = account('coordinador', 'coordinator');
const input = (changes = {}) => ({
  mutationId: randomUUID(), unit: 'EX401', date: '2026-11-12', shift: 'Día',
  initialHours: '5520', finalHours: '5528', equipmentStatus: 'Operativo',
  support: 'Parte EX401-20261112-D', trips: '2', tonnes: '30.5', stops: 'Sin paradas', client: 'TMF QA', ...changes,
});

function isolatedGateway() {
  const tabs = new Map([['01 Inventario', [[], [], ['#', 'COD1'], ['1', 'EX401'], ['2', 'EX405']]]]);
  const receipts = new Map();
  const guards = new Set();
  let failCommit = false;
  const sheets = {
    async read(tab) { return structuredClone(tabs.get(tab) ?? []); },
    async replay({ key, fingerprint }) {
      const receipt = receipts.get(key);
      if (!receipt) return null;
      if (receipt.fingerprint !== fingerprint) throw Object.assign(new Error('Operación distinta'), { status: 409 });
      return structuredClone(receipt.result);
    },
    async commit({ key, fingerprint, guard, guards: additionalGuards = [], writes, result }) {
      const replayed = await sheets.replay({ key, fingerprint });
      if (replayed) return { replayed: true, result: replayed };
      if (failCommit) throw Object.assign(new Error('Escritura no confirmada'), { status: 503 });
      const allGuards = [guard, ...additionalGuards].filter(Boolean);
      if (allGuards.some(value => guards.has(value))) throw Object.assign(new Error('Conflicto de versión'), { status: 409 });
      for (const value of allGuards) guards.add(value);
      for (const { tab, append } of writes) {
        assert.ok(['HERMES_PA_TURNOS', 'HERMES_PA_DESPACHO'].includes(tab));
        tabs.set(tab, [...(tabs.get(tab) ?? []), ...structuredClone(append)]);
      }
      receipts.set(key, { fingerprint, result: structuredClone(result) });
      return { replayed: false, result };
    },
  };
  const gateway = createHermesGateway({ sheets, writeEnabled: true, enablePanamaOperations: true,
    sessionReader: async req => req.session,
    listShiftOperators: async (_session, unit) => !unit || operator.assignedUnits.includes(unit) ? [operator] : [] });
  async function request(endpoint, session, body) {
    const output = {};
    const res = { setHeader() {}, status(value) { output.status = value; return this; }, json(value) { output.body = value; return this; } };
    await gateway({ query: { path: `api/panama/turnos${endpoint ? '/' + endpoint : ''}` }, session, method: body ? 'POST' : 'GET', body }, res);
    return output;
  }
  return { request, tabs, fail: value => { failCommit = value; } };
}

test('entrega un parte F07 con ocho horas, soporte y folio que Supervisión puede aceptar una vez', async () => {
  const { request } = isolatedGateway();
  const body = input({ createdBy: 'Falso', status: 'Aceptado' });
  const sent = await request('entregar', operator, body);
  assert.equal(sent.status, 201);
  const { record } = sent.body;
  assert.equal(record.status, 'Pendiente de revisión');
  assert.equal(record.hours, 8);
  assert.equal(record.trips, 2);
  assert.equal(record.tonnes, 30.5);
  assert.equal(record.support, body.support);
  assert.equal(record.createdBy.name, 'QA operator');
  assert.equal(record.officialStatus, 'Pendiente de conciliación en REGISTRO');
  assert.equal((await request('entregar', operator, body)).body.record.id, record.id);
  assert.equal((await request('entregar', operator, { ...body, finalHours: '5529' })).status, 409);
  assert.equal((await request('entregar', operator, input({ shift: ' dia ' }))).status, 409);
  assert.equal((await request('', supervisor)).body.records[0].id, record.id);
  const review = { mutationId: randomUUID(), id: record.id, version: record.version, action: 'accept', comment: '' };
  assert.equal((await request('revisar', coordinator, review)).status, 403);
  assert.equal((await request('revisar', account('supervisor', 'operator'), review)).status, 403);
  const accepted = await request('revisar', supervisor, review);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.record.status, 'Aceptado por Supervisión');
  assert.equal(accepted.body.record.reviewedBy.name, 'QA supervisor');
  assert.ok(Date.parse(accepted.body.record.reviewedAt));
  assert.equal(accepted.body.record.officialStatus, record.officialStatus);
  assert.deepEqual((await request('revisar', supervisor, review)).body, accepted.body);
  assert.equal((await request('revisar', supervisor, { ...review, mutationId: randomUUID() })).status, 409);
  assert.equal((await request('', coordinator)).body.records[0].status, accepted.body.record.status);
});

test('devuelve una discrepancia con motivo y conserva el folio al recibir la corrección', async () => {
  const { request } = isolatedGateway();
  assert.equal((await request('entregar', operator, input({ finalHours: '5518' }))).status, 400);
  assert.equal((await request('entregar', operator, input({ finalHours: '' }))).status, 400);
  assert.equal((await request('entregar', operator, input({ support: '' }))).status, 400);
  assert.equal((await request('entregar', operator, input({ date: '2026-02-30' }))).status, 400);
  const { body: { record } } = await request('entregar', operator, input());
  const review = { mutationId: randomUUID(), id: record.id, version: record.version, action: 'return' };
  assert.equal((await request('revisar', supervisor, review)).status, 400);
  const returned = await request('revisar', supervisor, { ...review, comment: 'Adjunta el parte actualizado' });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.record.status, 'Devuelto');
  const correction = input({ id: record.id, version: returned.body.record.version, finalHours: '5529', support: 'Parte revisado' });
  assert.equal((await request('entregar', account('operador', 'other'), correction)).status, 403);
  assert.equal((await request('entregar', operator, { ...correction, date: '2026-11-11' })).status, 409);
  const corrected = await request('entregar', operator, correction);
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.record.id, record.id);
  assert.equal(corrected.body.record.hours, 9);
  assert.equal(corrected.body.record.status, 'Pendiente de revisión');
  assert.equal(corrected.body.record.history.length, 3);
  assert.equal(corrected.body.record.history[1].comment, 'Adjunta el parte actualizado');
});

test('limita captura, lectura y aceptación a Panamá, al rol y a sus unidades', async () => {
  const { request } = isolatedGateway();
  assert.equal((await request('entregar', operator, input({ unit: 'EX405' }))).status, 403);
  assert.equal((await request('entregar', coordinator, input())).status, 403);
  assert.equal((await request('entregar', account('operador', 'mexico', ['EX401'], 'mx'), input())).status, 403);
  const { body: { record } } = await request('entregar', operator, input());
  const otherSupervisor = account('supervisor', 'other-supervisor', ['EX405']);
  assert.deepEqual((await request('', otherSupervisor)).body.records, []);
  assert.equal((await request('revisar', otherSupervisor, { mutationId: randomUUID(), id: record.id, version: record.version, action: 'accept' })).status, 403);
  assert.equal((await request('', account('mecanico', 'mechanic'))).status, 403);
});

test('no devuelve folio confirmado cuando falla la escritura y permite reintentar el mismo parte', async () => {
  const { request, fail } = isolatedGateway();
  const body = input();
  fail(true);
  assert.equal((await request('entregar', operator, body)).status, 503);
  assert.deepEqual((await request('', supervisor)).body.records, []);
  fail(false);
  assert.equal((await request('entregar', operator, body)).status, 201);
  assert.equal((await request('', supervisor)).body.records.length, 1);
});

test('rechaza una diferencia superior a un día y una lectura anterior a otro parte previo', async () => {
  const { request } = isolatedGateway();
  const impossible = await request('entregar', operator, input({ initialHours: '390', finalHours: '12000' }));
  assert.equal(impossible.status, 400);
  assert.match(impossible.body.error, /24 horas/);
  assert.equal((await request('entregar', operator, input())).status, 201);
  assert.equal((await request('entregar', operator, input({ date: '2026-11-13', initialHours: '5526', finalHours: '5534' }))).status, 409);
  assert.equal((await request('entregar', operator, input({ date: '2026-11-13', initialHours: '5528', finalHours: '5534' }))).status, 201);
});

test('despacho bloquea averías vigentes, registra al operador elegido y reaplica alcance al listar', async () => {
  const { request, tabs } = isolatedGateway();
  const dispatch = { mutationId: randomUUID(), unit: 'EX401', date: '2026-11-12', shift: 'Día', site: 'Frente QA', operatorId: operator.userId };
  const failure = ['12/11/2026', '07:00', 'EX401', 'Hidráulica', '', 'CRITICA', '', '', '', 'Abierta'];
  tabs.set('Averias', [failure]);
  assert.equal((await request('despacho', operator, dispatch)).status, 403);
  const blocked = await request('despacho', supervisor, dispatch);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /avería/i);
  assert.deepEqual(tabs.get('HERMES_PA_DESPACHO'), undefined);
  failure[9] = 'Completado';
  const saved = await request('despacho', supervisor, dispatch);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.assignment.operator.id, operator.userId);
  assert.equal(saved.body.assignment.assignedBy.id, supervisor.userId);
  assert.equal((await request('despacho', supervisor, dispatch)).body.assignment.id, saved.body.assignment.id);
  assert.equal((await request('despacho', supervisor, { ...dispatch, mutationId: randomUUID() })).status, 409);
  assert.equal((await request('despacho', operator)).body.assignments[0].id, saved.body.assignment.id);
  assert.deepEqual((await request('despacho', account('operador', 'other'))).body.assignments, []);
  failure[9] = 'Abierta';
  const { assignment } = (await request('despacho', supervisor, dispatch)).body;
  assert.equal(assignment.readiness.level, 'blocked');
  const [visible] = (await request('despacho', operator)).body.assignments;
  assert.equal(visible.id, saved.body.assignment.id);
  assert.equal(visible.readiness.level, 'blocked');
});
