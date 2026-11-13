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

test('fleet projection joins the official equipment master by Panama TMF code without borrowing Mexican rows', async () => {
  const { readPanamaInventory } = await import('../../api/_lib/hermes-panama.js');
  const inventory = await readPanamaInventory(async spec => {
    if (spec.key === 'fleet') return fixtures.fleet;
    assert.equal(spec.key, 'equipmentDetails');
    return [
      ['CÓDIGO','TIPO','MARCA','MODELO','SERIE','PAÍS','PROYECTO','ESTADO','MEDIDOR'],
      ['DZ203','Dozer','Komatsu','D155AX-6','PA-203','Panamá','TMF','Activo','Horómetro'],
      ['DZ203','Dozer','Otra','MX','MX-203','México','TMF','Activo','Horómetro'],
      ['EX401','Excavadora','Otra','OTRO','PA-X','Panamá','Otro','Activo','Horómetro'],
    ];
  });
  assert.deepEqual(inventory[3].slice(1,7), ['DZ203','Dozer','Komatsu','D155AX-6','','PA-203']);
  assert.equal(inventory[3][8], '');
  assert.equal(inventory[4][6], '');
});

test('maintenance exposes PM FLOTA and its scoped interval and component sources independently', async () => {
  const result = await dispatchPanama({ ...query, path: 'api/panama/maintenance', read: async spec => {
    if (spec.key === 'maintenance') return [
      ['EQUIPO','MODELO','¿CÓMO ESTÁ?','PRÓXIMO PM','TOCA A LAS (h)','HORÓMETRO HOY','HORAS QUE LE QUEDAN','ÚLTIMO PM ANOTADO','LECTURA','PLAN'],
      ['DZ203','Komatsu D155AX-6','VENCIDO · PROVISIONAL','PM 500','2,225','2,280','-55','PM 250 a 1,975.0 h','AL DÍA','Propuesto'],
      ['EX401','Develon DX360','VENCIDO','PM 250','8,300','8,399','-99','PM 500 a 8,050 h','AL DÍA','Aprobado'],
    ];
    if (spec.key === 'maintenancePlan') return [
      ['EQUIPO','MODELO','¿ACTIVO?','PM CADA (h)','NIVEL 2 (h)','NIVEL 3 (h)','NIVEL 4 (h)','NIVEL 5 (h)','NIVEL 6 (h)','¿PLAN APROBADO?','PAQUETE / CHECKLIST (link)'],
      ['DZ203','Komatsu D155AX-6','Sí','250','500','1,000','2,000','4,000','8,000','Sí','https://docs.google.com/spreadsheets/d/checklist/edit#gid=101'],
    ];
    if (spec.key === 'dozers') return [
      ['EQUIPO','TIPO','🔴','🟠','⚪ sin dato'], ['DZ203','Tractor','2','0','1'],
    ];
    throw new Error('no disponible');
  } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.sections.maintenance, [{
    unit: 'DZ203', model: 'Komatsu D155AX-6', status: 'VENCIDO · PROVISIONAL', next: 'PM 500',
    due: '2,225', hours: '2,280', remaining: '-55', last: 'PM 250 a 1,975.0 h', reading: 'AL DÍA', plan: 'Propuesto',
  }]);
  assert.equal(result.body.sections.maintenancePlan[0].cycle, '250');
  assert.equal(result.body.sections.dozers[0].critical, '2');
  assert.equal(result.body.sections.excavators, null);
  assert.equal((await dispatchPanama({ ...query, path: 'api/panama/maintenance', session: { ...teamMember, role: 'operador' } })).status, 403);
});

test('maintenance reads the current PM FLOTA header without losing unit scope or the official status', async () => {
  const read = async ({ key }) => {
    if (key !== 'maintenance') throw new Error('Unavailable');
    return [
      ['#', 'EQUIPO', 'MODELO', 'Estado', 'PRÓXIMO PM', 'TOCA A LAS (h)', 'HORÓMETRO HOY', 'HORAS QUE LE QUEDAN', '¿CUÁNDO TOCA?', 'FECHA APROX.', 'ÚLTIMO PM ANOTADO', 'LECTURA', 'PLAN', 'CHECKLIST'],
      ['1', 'DZ203', 'Komatsu D155AX-6', 'Al día', 'PM 250', '3,200', '3,100', '100', '', '', 'PM 250 a 2,950.0 h · por confirmar', 'Al día', 'Por aprobar', 'Abrir'],
      ['2', 'EX401', 'Develon DX360LCA-7M', 'Vencido', 'PM 500', '2,553', '3,061', '-508', '', '', '', 'Al día', 'Por aprobar', 'Abrir'],
    ];
  };
  const { body } = await dispatchPanama({ ...query, path: 'api/panama/maintenance', read });
  assert.deepEqual(body.sections.maintenance, [{
    unit: 'DZ203', model: 'Komatsu D155AX-6', status: 'Al día', next: 'PM 250',
    due: '3,200', hours: '3,100', remaining: '100', last: 'PM 250 a 2,950.0 h · por confirmar', reading: 'Al día', plan: 'Por aprobar',
  }]);
});

test('snapshot sections retain their timestamp and scope; unavailable sources stay unknown', async () => {
  const captured_at = '2026-11-13T19:30:00.000Z';
  const read = async ({ key }) => {
    if (!fixtures[key]) throw new Error('Unavailable');
    return { rows: fixtures[key], captured_at };
  };
  const { body } = await dispatchPanama({ ...query, read });
  assert.deepEqual(body.sections.fleet.map(({ unit }) => unit), ['DZ203']);
  assert.equal(body.snapshots.fleet, captured_at);
  assert.equal(body.sections.shifts, null);
  assert.equal(body.snapshots.shifts, undefined);
});

test('a focused master consultation reads only the requested source permitted by the session', async () => {
  const result = await dispatchPanama({ ...query, query: { sections: 'failures,costs' }, read: async ({ key }) => {
    assert.equal(key, 'failures');
    return fixtures.failures;
  } });
  assert.deepEqual(Object.keys(result.body.sections), ['failures']);
  assert.equal(result.body.sections.failures[0].order, 'OT-QA-1');
});
