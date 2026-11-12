import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchPanama } from '../../api/_lib/hermes-panama.js';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';

const teamMember = { userId: 'qa-panama', project: 'tmf-panama', role: 'jefe_taller', assignedUnits: ['dz203'], allUnits: false };
const fixtures = {
  fleet: [['Código', 'Equipo', 'Modelo', 'Clase contractual', 'Activo'],
    ['DZ203', 'QA Dozer', 'D155', 'Dozer', 'Sí'], ['EX401', 'QA Excavadora', 'DX360', 'Excavadora', 'Sí']],
  failures: [['CASO','EQUIPO','FALLA REPORTADA','ESTADO','ÚLTIMO REPORTE','OT VINCULADA','Remitente privado'],
    ['QA-F1','DZ203','Falla de prueba','DETENIDO REPORTADO','11/11/2026','OT-QA-1','No exportar']],
  orders: [['Nº OT','EQUIPO','FALLA / TRABAJO A REALIZAR','ESTADO','CONTROL INTEGRIDAD OT'],
    ['OT-QA-1','DZ203','Diagnóstico','Abierta','APERTURA INCOMPLETA']],
  maintenance: [['EQUIPO','¿CÓMO ESTÁ?','PRÓXIMO PM','HORAS QUE LE QUEDAN','LECTURA','PLAN'],
    ['DZ203','VENCIDO · PROVISIONAL','PM 500','-20','AL DÍA','Propuesto']],
};
const read = async spec => fixtures[spec.key];
const query = { path: 'api/panama/summary', method: 'GET', session: teamMember, read };

test('Panama reads only authorized units, preserving OT and PM source states', async () => {
  const { status, body } = await dispatchPanama(query);
  assert.equal(status, 200);
  assert.deepEqual(body.sections.fleet.map(row => row.unit), ['DZ203']);
  assert.equal(body.sections.failures[0].order, 'OT-QA-1');
  assert.equal(body.sections.orders[0].check, 'APERTURA INCOMPLETA');
  assert.match(body.sections.maintenance[0].status, /PROVISIONAL/);
  assert.doesNotMatch(JSON.stringify(body), /No exportar/);
});

test('operators and mechanics do not receive management sections, and malformed sources are unavailable', async () => {
  for (const role of ['operador', 'mecanico']) {
    const { body } = await dispatchPanama({ ...query, session: { ...teamMember, role }, read: async spec => {
      assert.ok(['fleet','failures','shifts'].includes(spec.key));
      if (spec.key === 'shifts') return [];
      return spec.key === 'fleet' ? [['Unknown column']] : fixtures.failures;
    } });
    assert.deepEqual(Object.keys(body.sections).sort(), ['failures', 'fleet', 'shifts']);
    assert.equal(body.sections.fleet, null);
    assert.equal(body.sections.failures.length, 1);
  }
});

test('shared purchasing source excludes rows of other countries even when the unit matches', async () => {
  const { body } = await dispatchPanama({ ...query, session: { ...teamMember, role: 'gerencia' }, read: async spec => {
    if (spec.key !== 'purchases') return fixtures[spec.key] ?? [];
    return [
      ['ID', 'País', 'Equipo / Item', 'Descripción', 'Monto', 'Moneda', 'Estado operativo', 'OC', 'Control recepción'],
      ['1', 'Panamá', 'DZ203', 'Compra PA', '20', 'USD', 'Pendiente', '', 'Sin detalle'],
      ['2', 'México', 'DZ203', 'Compra MX', '50', 'MXN', 'Pendiente', '', 'Sin detalle'],
      ['3', '', 'DZ203', 'País no acreditado', '60', 'USD', 'Pendiente', '', 'Sin detalle'],
    ];
  } });
  assert.deepEqual(body.sections.purchases.map(row => row.description), ['Compra PA']);
});

test('gateway keeps Panama in its own read routes and never writes its source', async () => {
  let project = 'tmf-panama';
  let legacyReads = 0;
  const gate = createHermesGateway({
    sheets: { read: async () => { legacyReads++; return []; } },
    sessionReader: async () => ({ ...teamMember, project }), writeEnabled: true, readPanama: read,
  });
  async function call(method, path, extra) {
    const result = {};
    const res = { setHeader() {}, status(code) { result.code = code; return this; }, json(body) { result.body = body; } };
    await gate({ method, query: { path, ...extra } }, res);
    return result;
  }
  assert.equal((await call('GET', 'api/panama/summary')).code, 200);
  assert.equal((await call('POST', 'api/panama/summary')).code, 405);
  assert.equal((await call('GET', 'api/sheets/read', { tab: '01 Inventario' })).code, 404);
  assert.equal((await call('POST', 'api/workshop/report')).code, 404);
  assert.equal(legacyReads, 0);
  project = 'tcm';
  assert.equal((await call('GET', 'api/panama/summary')).code, 403);
  assert.equal((await call('GET', 'api/sheets/read', { tab: '01 Inventario' })).code, 200);
  assert.equal(legacyReads, 1);
});
