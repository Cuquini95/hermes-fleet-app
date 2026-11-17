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

test('an order can read the revision for an assigned unit without returning serial-specific documents of other units', async () => {
  const general = JSON.parse(docs)[0];
  const catalog = [general, { ...general, title: 'Manual por serie', revision: 'R3', serials: ['QA-123'],
    url: 'https://drive.google.com/file/d/test-assigned/view' },
  { ...general, title: 'Manual serie distinta', revision: 'R4', serials: ['QA-456'],
    url: 'https://drive.google.com/file/d/test-unassigned/view' }];
  const gateway = createHermesGateway({
    sessionReader: async () => ({ userId: 'qa', project: 'tmf-panama', role: 'mecanico', assignedUnits: ['DZ203'] }),
    sheets: { read: async () => [['', 'DZ203', '', '', 'D155AX-6', '', 'QA-123'], ['', 'DZ205', '', '', 'D155AX-6', '', 'QA-456']] },
    enablePanamaOperations: true, panamaTechnicalCatalog: () => JSON.stringify(catalog),
  });
  const call = async unit => {
    const res = response();
    await gateway({ method: 'GET', query: { path: 'api/panama/documentos-tecnicos', kind: 'manual', unit } }, res);
    return res;
  };
  const scoped = await call('DZ203');
  assert.equal(scoped.code, 200);
  assert.deepEqual(scoped.body.documents.map(row => [row.title, row.revision]), [['Manual de taller', undefined], ['Manual por serie', 'R3']]);
  assert.doesNotMatch(JSON.stringify(scoped.body), /QA-123|QA-456/);
  assert.equal((await call('DZ205')).code, 403);
  assert.deepEqual((await call(undefined)).body.documents.map(row => row.title), ['Manual de taller']);
});
