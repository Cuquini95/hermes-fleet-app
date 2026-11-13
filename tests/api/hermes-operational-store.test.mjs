import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';
import { createPanamaOperationalStore } from '../../api/_lib/hermes-operational-store.js';

test('Panamá records a failure and its order once, and a new gateway can read both', async () => {
  const tables = new Map([
    ['Averías', [['FECHA', 'HORA', 'UNIDAD']]],
    ['ORDENES_TRABAJO', [['ROW_ID', 'OT_ID', 'FECHA', 'UNIDAD']]],
    ['OT_STATUS_LOG', [['FECHA', 'OT_ID']]],
    ['HERMES_PA_ESTADO_UNIDAD', [['UNIDAD', 'REVISION', 'FECHA']]],
  ]);
  const receipts = new Map();
  const readInventory = async () => [[], [], ['#', 'COD1'], ['1', 'DZ203', 'Dozer', 'Komatsu', 'D155AX-6']];
  async function request(path, { query, body } = {}) {
    switch (path) {
      case '/rest/v1/hermes_panama_operational_tables': {
        if (query.name.startsWith('in.')) {
          const names = JSON.parse('[' + query.name.slice(4, -1) + ']');
          return Response.json(names.filter(name => tables.has(name)).map(name => ({ name, rows: tables.get(name) })));
        }
        const name = query.name.slice(3);
        const rows = tables.get(name);
        return Response.json(rows ? [{ rows }] : []);
      }
      case '/rest/v1/hermes_panama_commit_receipts': {
        const receipt = receipts.get(query.operation_key.slice(3));
        return Response.json(receipt ? [receipt] : []);
      }
      case '/rest/v1/rpc/hermes_panama_commit': {
        const { operation_key: key, operation_fingerprint: fingerprint, changes, outcome: result } = body;
        const prior = receipts.get(key);
        if (prior) return Response.json({ result: prior.result, replayed: true });
        for (const change of changes) tables.get(change.tab).push(...change.append);
        receipts.set(key, { fingerprint, result });
        // Vercel never receives the successful database response.
        throw new Error('transport interrupted');
      }
      default: throw new Error('unexpected request');
    }
  }
  const actor = { project: 'tmf-panama', userId: randomUUID(), userName: 'Operador QA', role: 'operador', assignedUnits: ['DZ203'] };
  const coordinator = { ...actor, userId: randomUUID(), role: 'coordinador', userName: 'Coordinación QA' };
  const gateway = session => createHermesGateway({
    sheets: createPanamaOperationalStore({ request, readInventory }),
    sessionReader: async () => session, panamaOnly: true, enablePanamaOperations: true,
    writeEnabled: true, panamaWriteGroups: new Set(['taller']),
  });
  async function call(handler, method, path, body) {
    const response = { code: 0, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.body = data; } };
    await handler({ method, query: { path }, body }, response);
    return response;
  }
  const input = { mutationId: randomUUID(), unit: 'DZ203', type: 'Hidráulica', description: 'Prueba de guardado', canMove: true };
  const mismatchedActor = await call(gateway(actor), 'POST', 'api/workshop/report', { ...input, expectedUserId: coordinator.userId });
  assert.equal(mismatchedActor.code, 403);
  assert.equal(receipts.size, 0);
  const create = await call(gateway(actor), 'POST', 'api/workshop/report', input);
  assert.equal(create.code, 200);
  const replay = await call(gateway(actor), 'POST', 'api/workshop/report', input);
  assert.deepEqual(replay.body, create.body);
  const list = await call(gateway(coordinator), 'GET', 'api/workshop/orders');
  assert.equal(list.code, 200);
  assert.deepEqual(list.body.orders.map(row => row.slice(1, 6)), [[create.body.otId, list.body.orders[0][2], 'DZ203', 'Hidráulica', 'Prueba de guardado']]);
  assert.equal(tables.get('Averías').length, 2);
  assert.equal(tables.get('ORDENES_TRABAJO').length, 2);
  assert.equal((await call(gateway(actor), 'POST', 'api/workshop/report', { ...input, description: 'Cambiada' })).code, 409);
  const stale = await call(gateway(coordinator), 'POST', 'api/workshop/transition', {
    mutationId: randomUUID(), otId: create.body.otId, field: 'progreso', value: '20', expectedVersion: 'older-version',
  });
  assert.equal(stale.code, 409);
  assert.equal(receipts.size, 1);
});

test('the operational read treats missing tables as unavailable and catalog rows retain their offset', async () => {
  const store = createPanamaOperationalStore({ request: async (_path, { query }) => Response.json(query.name === 'eq.12 Inventario Rep.'
    ? [{ rows: [[], [], [], [], ['SKU'], ['F-1', 'Filtro']] }] : []) });
  await assert.rejects(store.read('Averías'), { status: 503 });
  assert.deepEqual((await store.read('12 Inventario Rep.')).slice(5), [['F-1', 'Filtro']]);
});
