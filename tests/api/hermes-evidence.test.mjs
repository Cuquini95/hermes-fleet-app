import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { dispatchEvidence, verifyEvidence } from '../../api/_lib/hermes-evidence.js';

const firstActor = '0f664260-06f9-479a-bfc5-82bc09c10f5d';
const secondActor = '31b365a7-cb50-4aae-bc36-ee8916d4de2b';
const sessionFor = (userId = firstActor, role = 'operador', assignedUnits = ['DZ203']) => ({
  userId, userName: 'Persona QA', role, project: 'tmf-panama', assignedUnits,
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
const bodyFor = (patch = {}) => ({
  kind: 'report', operationId: randomUUID(), units: ['DZ203'], slot: 0,
  expectedUserId: firstActor, mimeType: 'image/png', data: png.toString('base64'), ...patch,
});

function fixture() {
  const objects = new Map();
  const metadata = new Map();
  const tables = new Map([['01 Inventario', [[], [], [], ['1', 'DZ203'], ['2', 'EX401']]]]);
  const sheets = { read: async tab => structuredClone(tables.get(tab) ?? []) };
  const storage = {
    async reserve(row) {
      if (!metadata.has(row.id)) metadata.set(row.id, { ...row, ready: false });
      return metadata.get(row.id);
    },
    async find(id) { return metadata.get(id); },
    async markReady(id) { metadata.set(id, { ...metadata.get(id), ready: true }); },
    async write(row, bytes) { if (!objects.has(row.id)) objects.set(row.id, bytes); },
    async read(row) { return objects.get(row.id); },
  };
  const request = async ({ body, url, session = sessionFor(), canUpload = true, origin }) => {
    const req = { method: body ? 'POST' : 'GET', body, query: url ? Object.fromEntries(new URL(url, 'https://hermes.example').searchParams) : {},
      headers: { host: 'hermes.example', ...(origin && { origin }) } };
    const result = { status: 200, headers: {}, body: null };
    const res = {
      setHeader(name, value) { result.headers[name.toLowerCase()] = value; return this; },
      status(status) { result.status = status; return this; },
      json(data) { result.body = data; return this; },
      send(data) { result.body = data; return this; },
    };
    await dispatchEvidence({ req, res, session, sheets, storage, canUpload: () => canUpload });
    return result;
  };
  return { request, sheets, objects, metadata, storage, tables };
}

function orderRow({ otId = 'OT-QA', operationId, userId = firstActor, url, assigned = '' }) {
  const row = [];
  Object.assign(row, { 0: operationId, 1: otId, 3: 'DZ203', 9: 'Abierta', 10: url, 17: assigned, 19: userId });
  return row;
}

test('reserves one private attachment per operation slot and refuses a changed replay', async () => {
  const { request, metadata, objects } = fixture();
  const body = bodyFor();
  const [one, two] = await Promise.all([request({ body }), request({ body })]);
  assert.equal(one.status, 200);
  assert.match(one.body.url, /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/);
  assert.deepEqual(two.body, one.body);
  assert.equal(metadata.size, 1);
  assert.equal(objects.size, 1);
  const changedPng = Buffer.from(png);
  changedPng[43] ^= 1;
  const changed = await request({ body: { ...body, data: changedPng.toString('base64') } });
  assert.equal(changed.status, 409);
  assert.deepEqual([...objects.values()][0], png);
});

test('requires the matching active project, actor, role, unit, and enabled operation before upload', async () => {
  const { request, metadata } = fixture();
  assert.equal((await request({ body: bodyFor(), session: null })).status, 401);
  assert.equal((await request({ body: bodyFor(), session: { ...sessionFor(), project: 'mexico' } })).status, 403);
  assert.equal((await request({ body: bodyFor(), session: sessionFor(secondActor) })).status, 403);
  assert.equal((await request({ body: bodyFor({ kind: 'receipt' }) })).status, 403);
  assert.equal((await request({ body: bodyFor({ units: ['EX401'] }) })).status, 403);
  assert.equal((await request({ body: bodyFor(), origin: 'https://otra.example' })).status, 403);
  assert.equal((await request({ body: bodyFor(), canUpload: false })).status, 503);
  assert.equal((await request({ body: bodyFor({ units: ['NO-REGISTRADA'] }), session: { ...sessionFor(), allUnits: true } })).status, 404);
  assert.equal(metadata.size, 0);
});

test('rejects unsupported, mislabeled, malformed, and oversized evidence before storage', async () => {
  const { request, objects } = fixture();
  assert.equal((await request({ body: bodyFor({ mimeType: 'image/svg+xml' }) })).status, 415);
  assert.equal((await request({ body: bodyFor({ mimeType: 'image/jpeg' }) })).status, 415);
  assert.equal((await request({ body: bodyFor({ data: 'Ñ' }) })).status, 400);
  assert.equal((await request({ body: bodyFor({ data: Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64') }) })).status, 413);
  assert.equal(objects.size, 0);
});

test('checks exact evidence ownership, kind, record, operation, and scope before linking', async () => {
  const { request, storage } = fixture();
  const body = bodyFor();
  const { body: { url } } = await request({ body });
  const expected = { kind: 'report', operationId: body.operationId, units: ['DZ203'], session: sessionFor(), storage };
  assert.deepEqual(await verifyEvidence([url], expected), [url]);
  for (const patch of [{ kind: 'dvir' }, { recordId: 'OT-001' }, { operationId: randomUUID() }, { units: ['EX401'] }, { session: sessionFor(secondActor) }]) {
    await assert.rejects(verifyEvidence([url], { ...expected, ...patch }), { status: 400 });
  }
  await assert.rejects(verifyEvidence(['https://public.example/file.jpg'], expected), { status: 400 });
  await assert.rejects(verifyEvidence([`${url}&extra=1`], expected), { status: 400 });
});

test('serves only actively linked evidence under current unit and role scope', async () => {
  const { request, tables } = fixture();
  const body = bodyFor();
  const { body: { url } } = await request({ body });
  assert.equal((await request({ url })).status, 404);
  tables.set('ORDENES_TRABAJO', [orderRow({ operationId: body.operationId, url, assigned: secondActor })]);
  assert.equal((await request({ url, session: null })).status, 401);
  assert.equal((await request({ url, session: sessionFor(secondActor) })).status, 404);
  assert.equal((await request({ url, session: sessionFor(secondActor, 'jefe_taller', ['EX401']) })).status, 404);
  assert.equal((await request({ url, session: { ...sessionFor(), previewDemo: true } })).status, 404);
  assert.equal((await request({ url, session: sessionFor(secondActor, 'mecanico') })).status, 200);
  tables.get('ORDENES_TRABAJO')[0][17] = firstActor;
  assert.equal((await request({ url, session: sessionFor(secondActor, 'mecanico') })).status, 404);
  const allowed = await request({ url, session: sessionFor(secondActor, 'jefe_taller') });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['cache-control'], 'private, no-store');
  assert.equal(allowed.headers['content-type'], 'image/png');
  assert.deepEqual(allowed.body, png);
});

test('leaves staged attachments unreadable after a failed storage write and recovers on retry', async () => {
  const { request, storage, metadata } = fixture();
  const body = bodyFor();
  const write = storage.write;
  storage.write = async () => { throw new Error('storage unavailable'); };
  assert.equal((await request({ body })).status, 503);
  const [pending] = metadata.values();
  assert.equal(pending.ready, false);
  const expected = { kind: body.kind, operationId: body.operationId, units: body.units, session: sessionFor(), storage };
  await assert.rejects(verifyEvidence([`/hermes-api/api/evidence?id=${pending.id}`], expected), { status: 400 });
  storage.write = write;
  assert.equal((await request({ body })).status, 200);
  assert.equal(metadata.get(pending.id).ready, true);
});

test('requires a matching open OT for upload and all linked allocation units for receipt download', async () => {
  const { request, tables } = fixture();
  const me = sessionFor(firstActor, 'jefe_taller', ['DZ203', 'EX401']);
  const body = bodyFor({ kind: 'order', recordId: 'OT-QA' });
  assert.equal((await request({ body, session: me })).status, 404);
  tables.set('ORDENES_TRABAJO', [orderRow({ otId: body.recordId })]);
  assert.equal((await request({ body, session: sessionFor(firstActor, 'mecanico') })).status, 404);
  assert.equal((await request({ body, session: me })).status, 200);
  tables.get('ORDENES_TRABAJO')[0][9] = 'Completado';
  assert.equal((await request({ body: { ...body, operationId: randomUUID() }, session: me })).status, 409);

  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n');
  const receipt = bodyFor({ kind: 'receipt', units: ['EX401', 'DZ203'], mimeType: 'application/pdf', data: pdf.toString('base64') });
  const { body: { url } } = await request({ body: receipt, session: me });
  const rows = receipt.units.map(unit => {
    const row = [];
    Object.assign(row, { 0: `GST-QA-${unit}`, 10: unit, 15: url, 16: 'Pendiente', 17: 'GST-QA', 18: firstActor, 20: receipt.operationId });
    return row;
  });
  tables.set('02 Gastos', rows);
  assert.equal((await request({ url, session: sessionFor(secondActor, 'gerencia', ['DZ203']) })).status, 404);
  assert.equal((await request({ url, session: sessionFor(firstActor, 'operador', ['DZ203', 'EX401']) })).status, 404);
  const allowed = await request({ url, session: sessionFor(secondActor, 'gerencia', ['DZ203', 'EX401']) });
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers['content-disposition'], /^attachment/);
  assert.deepEqual(allowed.body, pdf);
  rows[1][16] = 'Eliminado';
  assert.equal((await request({ url, session: me })).status, 404);
});
