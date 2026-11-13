import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const proof = `/hermes-api/api/evidence?id=${'a'.repeat(64)}`;
const session = { userId: id, userName: 'Nombre compartido', role: 'operador', project: 'tmf-panama', assignedUnits: ['CA20'] };
const row = (columns, fields) => Object.assign(Array(columns).fill(''), fields);
const inspect = ({ owner, unit, folio }) => row(29, { 1: folio, 2: '12/11/2026', 3: '07:00', 4: unit, 6: session.userName, 22: 'aprobado', 28: owner });
const data = {
  '14 Inspecciones': [
    inspect({ owner: id, unit: 'CA20', folio: 'INS-1' }),
    inspect({ owner: other, unit: 'CA20', folio: 'INS-2' }),
    inspect({ owner: id, unit: 'CV20', folio: 'INS-3' }),
    inspect({ owner: '', unit: 'CA20', folio: 'INS-LEGACY' }),
  ],
  Inspeccion_Stickers: [
    row(21, { 1: 'STICKER-1', 3: '12/11/2026', 4: '06:00', 5: 'CA20', 10: 'pendiente_supervisor', 16: proof, 18: id }),
    row(21, { 1: 'STICKER-2', 3: '12/11/2026', 4: '06:30', 5: 'CA20', 10: 'aprobado_supervisor', 16: proof, 18: other }),
  ],
  'ORDENES_TRABAJO': [row(20, { 1: 'OT-1', 3: 'CA20', 19: id })],
  'Averías': [row(15, { 0: '12/11/2026', 1: '07:45', 2: 'CA20', 4: 'Falla de prueba', 13: 'OT-1' })],
};

async function call(gate, path, body) {
  const result = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
  await gate({ method: body ? 'POST' : 'GET', query: { path }, body }, result);
  return result;
}

test('personal history reports only records attributable to the session and available units', async () => {
  const gate = createHermesGateway({
    sheets: { read: async tab => {
      if (tab === '04B Registro Horómetros') throw new Error('Offline fixture');
      return data[tab] || [];
    } },
    sessionReader: async () => session,
    enablePanamaOperations: true,
  });
  const res = await call(gate, 'api/profile/history');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.records.map(item => item.folio), ['OT-1', 'INS-1', 'STICKER-1']);
  assert.deepEqual(res.body.records.find(item => item.folio === 'STICKER-1')?.evidence, [proof]);
  assert.ok(res.body.unavailable.includes('Horómetros'));
  assert.ok(!Object.values(res.body).flat().some(item => item?.folio === 'INS-LEGACY'));
});

test('capture assigns an actor ID from the authenticated session to the fuel row', async () => {
  const commits = [];
  const gate = createHermesGateway({
    sheets: { commit: async write => { commits.push(write); } },
    sessionReader: async () => session,
    enablePanamaOperations: true,
    enablePanamaFuelCapture: true,
    writeEnabled: true,
  });
  const values = row(14, { 0: 'F-QA', 1: '12/11/2026', 3: 'CA20', 4: 'Input', 13: other });
  const res = await call(gate, 'api/sheets/append', { tab: 'Combustible', values });
  assert.equal(res.statusCode, 200);
  assert.equal(commits[0].writes[0].append[0][13], id);
});
