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

test('Panama mock profiles use the isolated source for health, inventory and writes', async () => {
  let session = { ...operator, project: 'tmf-panama', previewDemo: true, assignedUnits: ['QA-DZ203'] };
  const calls = [];
  const demoSheets = { read: async () => [['#', 'UNIDAD'], ['1', 'QA-DZ203'], ['2', 'QA-EX999']] };
  const gate = createHermesGateway({
    sheets: { read: async () => { throw new Error('Sheets unconfigured'); } }, demoSheets,
    sessionReader: async () => session, enablePanamaOperations: true, writeEnabled: false,
    dispatchWorkshop: async ({ sheets }) => {
      calls.push(sheets);
      return { status: 201, body: { otId: 'QA-OT-1' } };
    },
  });
  const health = response();
  await gate({ method: 'GET', query: { path: 'health' } }, health);
  assert.equal(health.statusCode, 200);
  assert.equal(health.body.dataMode, 'demo');
  const fleet = response();
  await gate({ method: 'GET', query: { path: 'api/sheets/read', tab: '01 Inventario' } }, fleet);
  assert.deepEqual(fleet.body.data, [['#', 'UNIDAD'], ['1', 'QA-DZ203'], []]);
  const demoWrite = response();
  await gate({ method: 'POST', query: { path: 'api/workshop/report' } }, demoWrite);
  assert.equal(demoWrite.statusCode, 201);
  session = { ...session, previewDemo: false };
  const realWrite = response();
  await gate({ method: 'POST', query: { path: 'api/workshop/report' } }, realWrite);
  assert.equal(realWrite.statusCode, 503);
  assert.deepEqual(calls, [demoSheets]);
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

test('Panamá verifica cronología y horas del horómetro individual antes de guardar', async () => {
  const saved = [];
  const receipts = new Map();
  const readings = [['12/11/2026', '07:00:00', 'CA20', 'Equipo QA', 'QA', 'inicio', '390']];
  const sheets = { read: async () => readings, replay: async ({ key }) => receipts.get(key) ?? null,
    commit: async change => {
      saved.push(change);
      receipts.set(change.key, change.result);
      readings.push(change.writes[0].append[0]);
      return { result: change.result };
    } };
  const gate = createHermesGateway({ sheets, sessionReader: async () => ({ ...operator, project: 'tmf-panama' }),
    writeEnabled: true, enablePanamaOperations: true });
  const submit = async (hours, time = '19:00:00') => {
    const res = response();
    await gate({ method: 'POST', query: { path: 'api/sheets/append' }, body: {
      tab: '04B Registro Horómetros', values: ['12/11/2026', time, 'CA20', 'Equipo QA', 'Operador QA', 'final', hours],
    } }, res);
    return res;
  };
  assert.equal((await submit('389')).statusCode, 409);
  assert.equal((await submit('12000')).statusCode, 409);
  assert.equal((await submit('396')).statusCode, 200);
  assert.equal((await submit('396')).statusCode, 200);
  assert.equal((await submit('395')).statusCode, 409);
  assert.equal(saved.length, 1);
});

test('Panamá blocks TMF fuel capture until explicitly enabled in the isolated fixture', async () => {
  let writes = 0;
  const session = { ...operator, project: 'tmf-panama' };
  const options = { sheets: { commit: async () => { writes += 1; } }, sessionReader: async () => session,
    writeEnabled: true, enablePanamaOperations: true };
  const body = { tab: 'Combustible', values: ['qa-1', '11/11/2026', '22:01', 'CA20', 'QA', 'Diésel', '35'] };
  const request = { method: 'POST', query: { path: 'api/sheets/append' }, body };
  for (const enabled of [false, true]) {
    const gateway = createHermesGateway({ ...options, enablePanamaFuelCapture: enabled });
    const capabilities = response();
    await gateway({ method: 'GET', query: { path: 'api/panama/capacidades' } }, capabilities);
    assert.equal(capabilities.statusCode, 200);
    assert.equal(capabilities.body.fuelCapture, enabled);
    const receipt = response();
    await gateway(request, receipt);
    assert.equal(receipt.statusCode, enabled ? 200 : 403);
  }
  assert.equal(writes, 1);
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

test('formula reads bypass the cache of evaluated sheet values', async () => {
  const requests = [];
  const sheets = createHermesSheets({ spreadsheetId: 'isolated_fixture', request: async ({ url }) => {
    const mode = new URL(url).searchParams.get('valueRenderOption');
    requests.push(mode);
    return { data: { values: [['SKU-QA', '', '', '', '', mode === 'FORMULA' ? '=SUM(F10:F20)' : 4]] } };
  } });
  const catalog = '12 Inventario Rep.';
  assert.equal((await sheets.read(catalog, { cached: true }))[0][5], '4');
  assert.equal((await sheets.read(catalog, { cached: true, valueRenderOption: 'FORMULA' }))[0][5], '=SUM(F10:F20)');
  assert.equal((await sheets.read(catalog, { cached: true }))[0][5], '4');
  assert.deepEqual(requests, ['UNFORMATTED_VALUE', 'FORMULA']);
});

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

test('Panamá health distinguishes the official fleet from its writable workbook', async () => {
  const checks = [];
  const gateway = createHermesGateway({
    sessionReader: async () => ({ ...operator, project: 'tmf-panama' }),
    sheets: { read: async (tab, options) => {
      checks.push([tab, options]);
      if (tab === 'ORDENES_TRABAJO' && options?.requireExisting) throw new Error('fixture: unavailable workbook');
      return [['fleet header']];
    } },
    enablePanamaOperations: true, writeEnabled: true,
  });
  const result = response();
  await gateway({ method: 'GET', query: { path: 'health' } }, result);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'degraded');
  assert.equal(result.body.writeEnabled, false);
  assert.deepEqual(result.body.checks, { identity: 'up', fleet: 'up', operations: 'down' });
  assert.deepEqual(checks, [
    ['01 Inventario', { cached: true }],
    ['ORDENES_TRABAJO', { cached: true, requireExisting: true }],
  ]);
});

test('the Panama inventory sheet read preserves layout while filtering parts to the assigned units', async () => {
  const own = ['QA-FILTRO-001', 'Filtro QA', '', '', 'pza', '8', '3', '75', '', '', 'Komatsu D65EX-16'];
  const other = ['QA-SIN-ALCANCE', 'Otro filtro QA', '', '', 'pza', '8', '3', '75', '', '', 'QA-EX401'];
  const header = [[], [], [], [], ['SKU']];
  const sheets = { read: async tab => tab === '01 Inventario'
    ? [[], [], [], ['1', 'QA-DZ203', '', 'Komatsu', 'D65EX-16'], ['2', 'QA-EX401', '', 'Doosan', 'DX360LC-7']]
    : [...header, own, other] };
  const gate = createHermesGateway({
    sheets, enablePanamaOperations: true,
    sessionReader: async () => ({ ...operator, role: 'jefe_taller', project: 'tmf-panama', assignedUnits: ['QA-DZ203'] }),
  });
  const result = response();
  await gate({ method: 'GET', query: { path: 'api/sheets/read', tab: '12 Inventario Rep.' } }, result);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.data, [...header, own, []]);
});

test('the Panama release enables only accepted write groups and preserves consultation when they are empty', async () => {
  const sheets = { read: async () => [], commit: async ({ result }) => ({ result }) };
  const actor = { ...operator, project: 'tmf-panama', role: 'gerencia' };
  const calls = [];
  for (const groups of [new Set(), new Set(['taller'])]) {
    const gate = createHermesGateway({
      sheets, enablePanamaOperations: true, panamaWriteGroups: groups, writeEnabled: true,
      sessionReader: async () => actor,
      dispatchWorkshop: async () => { calls.push('taller'); return { status: 201, body: { otId: 'OT-QA' } }; },
      dispatchPurchasing: async () => { calls.push('compras'); return { status: 201, body: {} }; },
    });
    const request = async (method, path) => {
      const res = response();
      await gate({ method, query: { path }, body: {} }, res);
      return res;
    };
    assert.equal((await request('POST', 'api/workshop/report')).statusCode, groups.size ? 201 : 503);
    assert.equal((await request('POST', 'api/purchasing/order-save')).statusCode, 503);
    assert.equal((await request('POST', 'api/workshop/future-route')).statusCode, 503);
    const health = await request('GET', 'health');
    assert.equal(health.body.writeEnabled, groups.size > 0);
    assert.deepEqual(health.body.operationGroups, [...groups]);
  }
  assert.deepEqual(calls, ['taller']);
});
