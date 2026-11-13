import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';

function response() {
  return { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const docs = JSON.stringify([
  { title: 'Manual de taller', kind: 'manual', model: 'D155AX-6', source: 'Biblioteca de prueba', url: 'https://drive.google.com/file/d/test-manual/view' },
  { title: 'Diagrama eléctrico', kind: 'diagram', model: 'HM400-3', source: 'Biblioteca de prueba', url: 'https://drive.google.com/file/d/test-diagram/view' },
]);
async function lookup(role, query, catalog = () => docs) {
  const gateway = createHermesGateway({
    sessionReader: async () => ({ userId: 'qa-' + role, project: 'tmf-panama', role }),
    enablePanamaOperations: true, panamaTechnicalCatalog: catalog,
  });
  const res = response();
  await gateway({ method: 'GET', query: { path: 'api/panama/documentos-tecnicos', ...query } }, res);
  return res;
}
test('mechanic can retrieve approved technical documents by model and kind', async () => {
  const res = await lookup('mecanico', { kind: 'manual', q: 'd155ax-6' });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.documents.map(row => row.title), ['Manual de taller']);
});
test('technical library denies unauthorized roles and explains missing configuration', async () => {
  assert.equal((await lookup('operador', {})).code, 403);
  assert.equal((await lookup('mecanico', {}, () => '')).code, 503);
});
test('technical library rejects links outside the approved document service', async () => {
  const response = await lookup('mecanico', {}, () => docs.replace('drive.google.com', 'external.invalid'));
  assert.equal(response.code, 503);
});
