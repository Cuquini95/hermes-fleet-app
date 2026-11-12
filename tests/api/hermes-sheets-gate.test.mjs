import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';
import { createHermesSheets } from '../../api/_lib/hermes-google-sheets.js';

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

const operator = { userId: 'qa-operador', userName: 'Operador QA', role: 'operador', assignedUnits: ['CA20'], allUnits: false };

test('legacy data reads respect assigned units and role', async () => {
  const sheets = { read: async () => [['fecha', 'hora', 'UNIDAD'], ['2026-11-11', '22:01', 'CA20'], ['2026-11-11', '22:02', 'CV100']] };
  const gate = createHermesGateway({ sheets, sessionReader: async () => operator });
  const ok = response();
  await gate({ method: 'GET', query: { path: 'api/sheets/read', tab: 'Averias' } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data[1][2], 'CA20');
  assert.deepEqual(ok.body.data[2], []);
  const denied = response();
  await gate({ method: 'GET', query: { path: 'api/sheets/read', tab: 'Órdenes de Compra' } }, denied);
  assert.equal(denied.statusCode, 403);
});

test('production workflow writes are restricted to their named handlers, preview permits reads', async () => {
  let writes = 0;
  const sheets = { commit: async () => { writes += 1; } };
  const sessionReader = async () => ({ ...operator, role: 'gerencia', allUnits: true });
  const request = { method: 'POST', query: { path: 'api/sheets/append' }, body: { tab: 'Órdenes de Compra', values: ['OC-QA'] } };
  const protectedResult = response();
  await createHermesGateway({ sheets, sessionReader, writeEnabled: true })(request, protectedResult);
  assert.equal(protectedResult.statusCode, 403);
  const preview = response();
  await createHermesGateway({ sheets, sessionReader, writeEnabled: false })({ ...request, query: { path: 'api/workshop/report' } }, preview);
  assert.equal(preview.statusCode, 503);
  assert.equal(writes, 0);
});

test('mechanics must use the assignment-scoped workshop read for orders and history', async () => {
  const gate = createHermesGateway({
    sheets: { read: async () => assert.fail('No broad source query for a mechanic') },
    sessionReader: async () => ({ ...operator, role: 'mecanico', allUnits: true }),
  });
  for (const tab of ['ORDENES_TRABAJO', 'OT_STATUS_LOG']) {
    const result = response();
    await gate({ method: 'GET', query: { path: 'api/sheets/read', tab } }, result);
    assert.equal(result.statusCode, 403);
  }
});

test('original intake appends bind actor and unit and use a stable receipt on retry', async () => {
  const received = [];
  const gate = createHermesGateway({ sheets: { commit: async x => { received.push(x); return { result: x.result }; } }, sessionReader: async () => operator, writeEnabled: true });
  const body = { tab: 'Combustible', values: ['qa-1', '11/11/2026', '22:01', 'CA20', 'Valor del formulario', 'Diésel', '35'] };
  const first = response();
  const again = response();
  await gate({ method: 'POST', query: { path: 'api/sheets/append' }, body }, first);
  await gate({ method: 'POST', query: { path: 'api/sheets/append' }, body }, again);
  assert.equal(first.statusCode, 200);
  assert.equal(again.statusCode, 200);
  assert.equal(received[0].key, received[1].key);
  assert.equal(received[0].writes[0].append[0][4], operator.userName);
});

function transport() {
  const existing = new Map([
    ['Averías', { properties: { sheetId: 11, title: 'Averías', gridProperties: { rowCount: 1000, columnCount: 26 } }, rows: [['folio']] }],
    ['ORDENES_TRABAJO', { properties: { sheetId: 12, title: 'ORDENES_TRABAJO', gridProperties: { rowCount: 1000, columnCount: 26 } }, rows: [['folio']] }],
  ]);
  let sheets = existing;
  let markers = new Map();
  let loseResponse = false;
  let failBeforeCommit = false;
  const apiError = (status) => Object.assign(new Error('Respuesta sintética de Sheets'), { response: { status } });
  const request = async ({ url, method, data }) => {
    const path = new URL(url).pathname.split('/').slice(4).join('/');
    if (path.startsWith('developerMetadata/')) {
      const row = markers.get(Number(path.split('/')[1]));
      if (!row) throw apiError(404);
      return { data: row };
    }
    if (path.startsWith('values/')) {
      const tab = decodeURIComponent(path.slice(7)).replace(/^'|'$/g, '');
      if (!sheets.has(tab)) throw apiError(400);
      return { data: { values: structuredClone(sheets.get(tab).rows) } };
    }
    if (method === 'GET') return { data: { sheets: [...sheets.values()].map(({ properties }) => ({ properties })) } };
    if (failBeforeCommit) { failBeforeCommit = false; throw apiError(503); }
    const next = structuredClone(sheets);
    const nextMarkers = structuredClone(markers);
    for (const command of data.requests) {
      if (command.createDeveloperMetadata) {
        const row = command.createDeveloperMetadata.developerMetadata;
        if (nextMarkers.has(row.metadataId)) throw apiError(400);
        nextMarkers.set(row.metadataId, row);
      }
      if (command.addSheet) {
        const { properties } = command.addSheet;
        if (next.has(properties.title)) throw apiError(400);
        next.set(properties.title, { properties, rows: [] });
      }
      if (command.appendCells) {
        const { sheetId, rows } = command.appendCells;
        const sheet = [...next.values()].find(entry => entry.properties.sheetId === sheetId);
        sheet.rows.push(...rows.map(({ values }) => values.map(value => Object.values(value.userEnteredValue)[0])));
      }
    }
    sheets = next;
    markers = nextMarkers;
    if (loseResponse) { loseResponse = false; throw apiError(503); }
    return { data: {} };
  };
  return { request, rows: tab => sheets.get(tab)?.rows, loseResponse: () => { loseResponse = true; }, fail: () => { failBeforeCommit = true; } };
}

const save = (key, folio, guards) => ({ key, fingerprint: `fp-${folio}`, guards, result: { folio }, writes: [{ tab: 'Averias', append: [[folio]] }, { tab: 'ORDENES_TRABAJO', append: [[folio]] }] });

test('a rejected batch leaves both sheets unchanged and a retry commits both with the same receipt', async () => {
  const fake = transport();
  const sheets = createHermesSheets({ spreadsheetId: 'isolated_fixture', request: fake.request });
  fake.fail();
  await assert.rejects(sheets.commit(save('a', 'OT-QA-1')));
  assert.equal(fake.rows('Averías').length, 1);
  assert.equal(fake.rows('ORDENES_TRABAJO').length, 1);
  const created = await sheets.commit(save('a', 'OT-QA-1'));
  assert.deepEqual(created, { replayed: false, result: { folio: 'OT-QA-1' } });
  const repeated = await sheets.commit(save('a', 'OT-QA-1'));
  assert.deepEqual(repeated, { replayed: true, result: { folio: 'OT-QA-1' } });
  assert.equal(fake.rows('Averías').length, 2);
  assert.equal(fake.rows('ORDENES_TRABAJO').length, 2);
  await assert.rejects(sheets.commit(save('a', 'OT-QA-2')), { status: 409 });
});

test('a lost acknowledgment is reconciled from the persisted receipt', async () => {
  const fake = transport();
  const sheets = createHermesSheets({ spreadsheetId: 'isolated_fixture', request: fake.request });
  fake.loseResponse();
  assert.deepEqual(await sheets.commit(save('b', 'OT-QA-2')), { replayed: true, result: { folio: 'OT-QA-2' } });
  assert.equal(fake.rows('Averías').length, 2);
});

test('overlapping versions prevent a concurrent second commit', async () => {
  const fake = transport();
  const sheets = createHermesSheets({ spreadsheetId: 'isolated_fixture', request: fake.request });
  const outcomes = await Promise.allSettled([
    sheets.commit(save('one', 'OT-QA-1', ['pedido:A:0', 'pedido:B:0'])),
    sheets.commit(save('two', 'OT-QA-2', ['pedido:B:0', 'pedido:C:0'])),
  ]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(x => x.status === 'rejected').reason.status, 409);
  assert.equal(fake.rows('ORDENES_TRABAJO').length, 2);
});
