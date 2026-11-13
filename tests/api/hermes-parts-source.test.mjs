import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartsHandler } from '../../api/parts/import.js';

const catalog = [
  ['QA-FILTRO-001', 'Filtro hidráulico de prueba', 'OEM-QA-001', '', 'pza', '8', '3', '75', '', '', 'QA-DZ203'],
  ['QA-OTRA-UNIDAD', 'Filtro de otra unidad', '', '', 'pza', '4', '1', '80', '', '', 'QA-EX401'],
];
const fleet = [['1', 'QA-DZ203', '', 'Komatsu', 'D65EX-16'], ['2', 'QA-EX401', '', 'Doosan', 'DX360LC-7']];
const session = { project: 'tmf-panama', role: 'jefe_taller', assignedUnits: ['QA-DZ203'], allUnits: false, previewDemo: true };

function fixture(identity = session, withDemo = true) {
  let operationalReads = 0;
  const handler = createPartsHandler({
    panama: true, sessionReader: async () => identity, readFleet: async () => fleet,
    readRows: async () => { operationalReads++; return catalog; },
    demoSheets: withDemo ? { read: async tab => tab === '01 Inventario' ? fleet : [[], [], [], [], [], ...catalog] } : undefined,
  });
  const search = async q => {
    const result = {};
    await handler({ method: 'GET', query: { q } }, {
      setHeader() {}, status(code) { result.status = code; return this; }, json(body) { result.body = body; },
    });
    return result;
  };
  return { search, reads: () => operationalReads };
}

test('Preview consulta el SKU y OEM de prueba, respeta unidades y evita el libro operativo', async () => {
  const { search, reads } = fixture();
  for (const value of ['QA-FILTRO-001', 'OEM-QA-001', 'Filtro hidráulico']) {
    const { status, body } = await search(value);
    assert.equal(status, 200);
    assert.deepEqual(body.map(part => part.part_number), ['QA-FILTRO-001']);
    assert.equal(body[0].stock_quantity, 8);
  }
  assert.deepEqual(await search('QA-OTRA-UNIDAD'), { status: 200, body: [] });
  assert.equal(reads(), 0);
});

test('una fuente Preview indisponible se distingue del SKU inexistente sin usar Production', async () => {
  const { search, reads } = fixture(session, false);
  assert.equal((await search('QA-FILTRO-001')).status, 503);
  assert.equal(reads(), 0);
});

test('una sesión operativa consulta su fuente y conserva el alcance en el catálogo', async () => {
  const { search, reads } = fixture({ ...session, previewDemo: false });
  assert.deepEqual((await search('filtro')).body.map(part => part.part_number), ['QA-FILTRO-001']);
  assert.equal(reads(), 1);
});
