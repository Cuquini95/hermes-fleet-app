import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';
import { createPanamaOperationalStore } from '../../api/_lib/hermes-operational-store.js';
import { readPanamaReportFleet } from '../../api/_lib/hermes-panama.js';

test('Panamá records a failure and its order once, and a new gateway can read both', async () => {
  const tables = new Map([
    ['Averías', [['FECHA', 'HORA', 'UNIDAD']]],
    ['ORDENES_TRABAJO', [['ROW_ID', 'OT_ID', 'FECHA', 'UNIDAD']]],
    ['OT_STATUS_LOG', [['FECHA', 'OT_ID']]],
    ['HERMES_PA_ESTADO_UNIDAD', [['UNIDAD', 'REVISION', 'FECHA']]],
  ]);
  const receipts = new Map();
  const capturedAt = '2026-04-02T12:00:00Z';
  let sheetReads = 0;
  let cutReads = 0;
  const unavailableSheet = async () => { sheetReads++; throw new Error('Sheets unavailable'); };
  const readReportFleet = () => readPanamaReportFleet({
    allowSnapshot: true,
    readLive: unavailableSheet,
    readCut: async ({ key }) => {
      assert.equal(key, 'fleet');
      cutReads++;
      return { captured_at: capturedAt, rows: [['Código', 'Equipo', 'Modelo', 'Clase contractual', 'Activo'],
        ['DZ203', 'Dozer', 'D155AX-6', 'Dozer', 'Sí'], ['EX401', 'Excavadora', 'DX360', 'Excavadora', 'Sí']] };
    },
  });
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
    sheets: createPanamaOperationalStore({ request, readInventory: unavailableSheet, readReportFleet }),
    sessionReader: async () => session, panamaOnly: true, enablePanamaOperations: true,
    writeEnabled: true, panamaWriteGroups: new Set(['taller']),
  });
  async function call(handler, method, path, body) {
    const response = { code: 0, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.body = data; } };
    await handler({ method, query: { path }, body }, response);
    return response;
  }
  const input = { mutationId: randomUUID(), unit: 'DZ203', type: 'Hidráulica', description: 'Prueba de guardado', canMove: true };
  const listUnits = await call(gateway(actor), 'GET', 'api/workshop/reportunits');
  assert.equal(listUnits.code, 200);
  assert.deepEqual(listUnits.body, { units: [{ code: 'DZ203', model: 'D155AX-6' }], capturedAt });
  assert.equal((await call(gateway({ ...actor, role: 'almacen' }), 'GET', 'api/workshop/reportunits')).code, 401);
  assert.equal((await call(gateway({ ...actor, project: 'tcm' }), 'GET', 'api/workshop/reportunits')).code, 403);
  assert.equal((await call(gateway(actor), 'POST', 'api/workshop/report', { ...input, unit: 'EX401' })).code, 403);
  assert.equal(cutReads, 1);
  assert.equal((await call(gateway({ ...actor, allUnits: true }), 'POST', 'api/workshop/report', { ...input, unit: 'EX999' })).code, 404);
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
  assert.equal(cutReads, 3);
  assert.equal(sheetReads, 0);
});

test('the operational read treats missing tables as unavailable and catalog rows retain their offset', async () => {
  const store = createPanamaOperationalStore({ request: async (_path, { query }) => Response.json(query.name === 'eq.12 Inventario Rep.'
    ? [{ rows: [[], [], [], [], ['SKU'], ['F-1', 'Filtro']] }] : []) });
  await assert.rejects(store.read('Averías'), { status: 503 });
  assert.deepEqual((await store.read('12 Inventario Rep.')).slice(5), [['F-1', 'Filtro']]);
});

test('the print response includes a private signature for the matching current approval only', async () => {
  const folio = 'OC-SIGNATURE-QA';
  const approver = '00000000-0000-4000-8000-000000000031';
  const approvedAt = '2026-11-14T17:38:21.711Z';
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
  const issuer = JSON.stringify({ id: 'TP_PA_QA', name: 'Trans Plus QA', currency: 'USD', template: 'transplus' });
  const order = [folio, '14/11/2026', 'Proveedor QA', '', '', 'DZ203', '30.00', '2.10', '0.00', '0.00', '32.10',
    'Aprobada', '', 'Gerencia QA', '', 'version-qa', issuer, approver, approvedAt, '', '', '', '', '', '', '0.00', 'catalog', '3001'];
  const tables = [
    { name: 'Órdenes de Compra', rows: [['OC_ID'], order, ['OC-OTHER-QA', ...order.slice(1, 27), '3002']] },
    { name: 'OC_Lineas', rows: [['OC_ID'], [folio, '1', 'Filtro QA', '1', '30.00', '30.00']] },
  ];
  let signatureReads = 0;
  let signatureValue = png;
  const sheets = createPanamaOperationalStore({ request: async (path, { query }) => {
    if (path === '/rest/v1/hermes_panama_purchase_signatures') {
      signatureReads++;
      if (signatureValue === null) return new Response(null, { status: 503 });
      if (query.folio === 'eq.' + folio && query.approved_by_id === 'eq.' + approver && query.approved_at === 'eq.' + approvedAt) {
        return Response.json([{ png_base64: signatureValue }]);
      }
      return Response.json([]);
    }
    if (path === '/rest/v1/hermes_panama_operational_tables') {
      return Response.json(query.name === 'eq.Proveedores' ? [{ rows: [['Nombre']] }] : tables);
    }
    throw new Error('Unexpected request');
  } });
  const reader = { project: 'tmf-panama', userId: randomUUID(), userName: 'Gerencia QA', role: 'gerencia', allUnits: true };
  async function read(action = 'order', target = folio, session = reader) {
    const handler = createHermesGateway({ sheets, sessionReader: async () => session, panamaOnly: true, enablePanamaOperations: true });
    const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.body = data; } };
    await handler({ method: 'GET', query: { path: 'api/purchasing/' + action, folio: target } }, response);
    return response;
  }

  const approved = await read();
  assert.equal(approved.code, 200);
  assert.equal(approved.body.order.number, '3001');
  const numberLookup = await read('order', '3001');
  assert.equal(numberLookup.code, 200);
  assert.equal(numberLookup.body.order.folio, folio);
  assert.equal(numberLookup.body.approvalSignature, png);
  assert.equal(approved.headers['Cache-Control'], 'no-store');
  assert.equal(approved.body.approvalSignature, png);
  assert.equal((await read('orders')).body.orders[0].approvalSignature, undefined);
  assert.equal((await read('order', 'OC-OTHER-QA')).body.approvalSignature, undefined);
  assert.equal(signatureReads, 3);

  order[17] = randomUUID();
  assert.equal((await read()).body.approvalSignature, undefined);
  order[17] = approver;
  order[18] = '2026-11-14T17:40:00.000Z';
  assert.equal((await read()).body.approvalSignature, undefined);
  order[18] = approvedAt;
  order[11] = 'Rechazada';
  assert.equal((await read()).body.approvalSignature, undefined);
  order[11] = 'Aprobada';
  assert.equal((await read('order', folio, { ...reader, role: 'supervisor' })).code, 403);
  assert.equal((await read('order', folio, { ...reader, allUnits: false, assignedUnits: ['DZ205'] })).code, 403);
  assert.equal(signatureReads, 5);

  for (const unavailable of ['bm90IGEgcG5n', null]) {
    signatureValue = unavailable;
    const existing = await read();
    assert.equal(existing.code, 200);
    assert.equal(existing.body.order.approvedBy, 'Gerencia QA');
    assert.equal(existing.body.approvalSignature, undefined);
  }
});

test('a purchase creation response and its retry report the number assigned by the database', async () => {
  const folio = 'OC-SIGNATURE-QA';
  const stored = { folio, total: '32.10', version: 'version-qa' };
  const header = [folio, ...Array(26).fill(''), '3002'];
  const keys = { key: 'qa-created', fingerprint: 'fingerprint-qa' };
  const store = createPanamaOperationalStore({ request: async (path, { query }) => {
    if (path === '/rest/v1/rpc/hermes_panama_commit') return Response.json({ result: stored, replayed: false });
    if (path === '/rest/v1/hermes_panama_commit_receipts') return Response.json([{ fingerprint: keys.fingerprint, result: stored }]);
    if (path === '/rest/v1/hermes_panama_operational_tables' && query.name === 'eq.Órdenes de Compra') {
      return Response.json([{ rows: [['OC_ID'], header] }]);
    }
    throw new Error('Unexpected request');
  } });
  const expected = { ...stored, number: '3002' };
  assert.deepEqual((await store.commit({ ...keys, writes: [], result: stored, includePurchaseNumber: true })).result, expected);
  assert.deepEqual(await store.replay({ ...keys, includePurchaseNumber: true }), expected);
  assert.deepEqual(await store.replay(keys), stored);
});
