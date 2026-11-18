import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatchPanama } from '../../api/_lib/hermes-panama.js';
import { buildPanamaPmReview } from '../../api/_lib/hermes-panama-pm-review.js';

const captured = '2026-11-17T20:00:00Z';
const plan = { unit: 'EX401', model: 'Komatsu D65EX-16', active: 'Sí', approved: 'No', cycle: '250', level2: '500', level3: '1000',
  checklist: 'https://docs.google.com/spreadsheets/d/1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw/edit#gid=102' };
const equipment = { unit: 'EX401', project: 'TMF', model: 'D65EX-16', serial: 'SERIE-FICTICIA', country: 'Panamá' };
const reading = { unit: 'EX401', model: plan.model, due: '1250', hours: '1290', remaining: '-40' };
const catalog = { captured_at: captured, rows: [{ id: '102', name: 'D65EX-16', rows: [
  ['▸', 'PREPARACIÓN Y SEGURIDAD'], ['1', 'Preparación ficticia'],
  ['▸', 'PM 250 h'], ['2', 'Tarea ficticia 250'], ['▸', 'PM 500 h'], ['3', 'Tarea ficticia 500'],
  ['▸', 'PM 1000 h'], ['4', 'Tarea ficticia 1000'], ['▸', 'CIERRE Y PRUEBA'], ['5', 'Cierre ficticio'],
] }] };
const sources = () => Object.fromEntries(Object.entries({ fleet: [{ unit: 'EX401', model: plan.model }],
  maintenancePlan: [plan], maintenance: [reading], equipmentDetails: [equipment],
}).map(([name, records]) => [name, { records: structuredClone(records), capturedAt: captured }]));
const codes = row => row.issues.map(issue => issue.code);

test('review identifies an unapproved applicable plan without changing records or inventing approval', () => {
  const original = sources();
  const before = structuredClone(original);
  const [row] = buildPanamaPmReview(original, catalog);
  assert.deepEqual(codes(row), ['approval']);
  assert.equal(row.serial, equipment.serial);
  assert.match(row.revision, /^[a-f0-9]{16}$/);
  assert.deepEqual(row.intervals, [250, 500, 1000]);
  assert.equal(row.approved, false);
  assert.deepEqual(original, before);
  original.maintenancePlan.records[0].approved = 'Sí';
  assert.deepEqual(codes(buildPanamaPmReview(original, catalog)[0]), []);
});

test('review preserves model conflicts and unsupported intervals without substituting another model', () => {
  const data = sources();
  Object.assign(data.maintenancePlan.records[0], { model: 'Mack Granite', approved: 'Sí', level4: '2000' });
  data.equipmentDetails.records[0].serial = 'Por verificar';
  const [row] = buildPanamaPmReview(data, catalog);
  assert.equal(row.serial, null);
  assert(codes(row).includes('serial'));
  assert(codes(row).includes('model'));
  assert(codes(row).includes('schedule_model'));
  assert.deepEqual(row.unsupportedIntervals, [250, 500, 1000, 2000]);
  assert.equal(row.revision, null);
});

test('duplicate plan, identity and fleet codes remain review issues, never an arbitrary winning row', () => {
  const data = sources();
  for (const name of ['maintenancePlan', 'equipmentDetails', 'fleet']) data[name].records.push({ ...data[name].records[0] });
  const [row] = buildPanamaPmReview(data, catalog);
  assert.equal(row.approved, false);
  assert.equal(row.serial, null);
  assert(codes(row).includes('plan_duplicate'));
  assert(codes(row).includes('identity'));
  assert(codes(row).includes('fleet_duplicate'));
});

test('invalid intervals, conflicting balances and missing sources remain visible', () => {
  for (const changes of [{ cycle: '0' }, { cycle: '-250' }, { level2: '251' }, { level2: '250' }, { level2: 'texto' }]) {
    const data = sources(); Object.assign(data.maintenancePlan.records[0], changes);
    assert(codes(buildPanamaPmReview(data, catalog)[0]).includes('intervals'));
  }
  const data = sources();
  data.maintenance.records[0].remaining = '-20';
  data.equipmentDetails = null;
  const [row] = buildPanamaPmReview(data, null);
  assert(codes(row).includes('balance'));
  assert(codes(row).includes('identity_source'));
  assert(codes(row).includes('catalog'));
  data.maintenancePlan.records = [];
  assert(codes(buildPanamaPmReview(data, null)[0]).includes('plan_missing'));
});

function reader(data) {
  return async spec => {
    if (!data[spec.key]) throw new Error('Fuente ficticia ausente');
    const columns = Object.entries({ ...spec.columns, ...spec.optionalColumns });
    if (spec.country) columns.push(['country', spec.country]);
    return { captured_at: captured, rows: [columns.map(([, name]) => name),
      ...data[spec.key].records.map(row => columns.map(([name]) => row[name] ?? ''))] };
  };
}
const args = data => ({ path: 'api/panama/pm-review', method: 'GET',
  session: { project: 'tmf-panama', role: 'coordinador', assignedUnits: ['EX401'], allUnits: false },
  read: reader(data), readPmChecklists: async () => catalog });

test('review API applies project, role, country and equipment scope before returning serials', async () => {
  const data = sources();
  for (const name of Object.keys(data)) data[name].records.push({ ...data[name].records[0], unit: 'EX402', serial: 'NO-EXPORTAR' });
  data.equipmentDetails.records.push({ ...equipment, country: 'México', serial: 'NO-EXPORTAR-MX' });
  const result = await dispatchPanama(args(data));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.rows.map(row => row.unit), ['EX401']);
  assert.equal(result.body.rows[0].serial, equipment.serial);
  assert.doesNotMatch(JSON.stringify(result), /NO-EXPORTAR/);
  for (const role of ['operador', 'mecanico', 'almacen']) {
    assert.equal((await dispatchPanama({ ...args(data), session: { ...args(data).session, role },
      read: () => { throw new Error('No debe leer fuentes'); } })).status, 403);
  }
  assert.equal((await dispatchPanama({ ...args(data), session: { ...args(data).session, project: 'tcm' } })).status, 403);
  assert.equal((await dispatchPanama({ ...args(data), method: 'POST' })).status, 405);
});

test('review API distinguishes partial coverage and complete source failure', async () => {
  const data = sources(); data.equipmentDetails = null;
  const partial = await dispatchPanama({ ...args(data), readPmChecklists: async () => { throw new Error('Catálogo no disponible'); } });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.sources.equipmentDetails.available, false);
  assert.equal(partial.body.catalog.available, false);
  assert(codes(partial.body.rows[0]).includes('identity_source'));
  assert(codes(partial.body.rows[0]).includes('catalog'));
  assert.equal((await dispatchPanama(args({}))).status, 503);
});
