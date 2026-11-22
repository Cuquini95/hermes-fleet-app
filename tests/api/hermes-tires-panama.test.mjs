import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dispatchPanamaTires } from '../../api/_lib/hermes-panama-tires.js';

const manager = { userId: 'qa-gerencia', userName: 'Gerencia QA', role: 'gerencia', allUnits: true, project: 'tmf-panama' };
const assigned = { ...manager, userId: 'qa-origen', allUnits: false, assignedUnits: ['CA20'] };

function fixture() {
  const rows = [['ID','UNIDAD','MODELO','POSICIÓN']];
  const receipts = new Map(), guards = new Set();
  let beforeCommit;
  const sheets = {
    read: async tab => structuredClone(tab === '01 Inventario' ? [[], [], [], ['', 'CA20', 'Camión articulado'], ['', 'CA21', 'Cargador']] : rows),
    replay: async ({ key, fingerprint }) => {
      const previous = receipts.get(key);
      if (previous && fingerprint !== previous.fingerprint) throw Object.assign(Error('distinta'), { status: 409 });
      return previous?.result ?? null;
    },
    commit: async input => {
      const before = beforeCommit; beforeCommit = undefined;
      if (before) await before();
      const previous = await sheets.replay(input);
      if (previous) return { result: previous, replayed: true };
      if (guards.has(input.guard)) throw Object.assign(Error('guarda'), { status: 409 });
      guards.add(input.guard);
      rows.push(...structuredClone(input.writes[0].append));
      receipts.set(input.key, input);
      return { result: input.result };
    },
  };
  const get = (serial, session = manager) => dispatchPanamaTires({ method: 'GET', query: { serial }, session, sheets });
  const byUnit = (unit, session = manager) => dispatchPanamaTires({ method: 'GET', query: { unit }, session, sheets });
  const post = (body, session = manager) => dispatchPanamaTires({ method: 'POST', body: { mutationId: randomUUID(), serial: 'F-01', ...body }, session, sheets });
  return { rows, get, byUnit, post, interrupt: callback => { beforeCommit = callback; } };
}

test('el mismo número de fuego conserva origen, destino, medidas y costo por uso entre dos equipos', async () => {
  const { get, post } = fixture();
  const mounted = await post({ action: 'mount', unit: 'CA20', position: 'I1', meter: '1000', basis: 'h',
    amount: '850.00', currency: 'USD', reference: 'Factura QA' });
  assert.equal(mounted.status, 201);
  const inspected = await post({ action: 'inspect', expected: mounted.body.id, meter: '1050', depth: '11.5', pressure: '0' });
  assert.equal(inspected.status, 201);
  assert.equal((await post({ action: 'move', expected: inspected.body.id, meter: '1100', unit: 'CA21', position: 'D2', arrivalMeter: '600', arrivalBasis: 'km' })).status, 400);
  const moved = await post({ action: 'move', expected: inspected.body.id, meter: '1100', unit: 'CA21', position: 'D2', arrivalMeter: '600', arrivalBasis: 'h' });
  assert.equal(moved.status, 201);
  assert.equal((await post({ action: 'inspect', expected: moved.body.id, meter: '640', depth: '10', pressure: '105' })).status, 201);
  const { body } = await get(' f-01 ');
  assert.deepEqual(body.history.map(e => e.action), ['inspect','move','inspect','mount']);
  assert.deepEqual(body.history[1].from, { unit: 'CA20', position: 'I1' });
  assert.deepEqual(body.history[1].location, { unit: 'CA21', position: 'D2' });
  assert.deepEqual([body.history[2].pressure, body.history[2].depth], [0, 11.5]);
  assert.deepEqual(body.totals, { basis: 'h', usage: 140, amount: 850, currency: 'USD', rate: 6.0714, reference: 'Factura QA' });
  const scoped = (await get('F-01', assigned)).body;
  assert.equal(scoped.totals, null);
  assert.equal(JSON.stringify(scoped).includes('CA21'), false);
  assert.equal((await get('F-01', { ...assigned, role: 'operador' })).status, 403);
});

test('el montaje y traslado protegen la ocupación, alcance y recuperación concurrente', async () => {
  const { get, post, interrupt } = fixture();
  const mount = { action: 'mount', unit: 'CA20', position: 'I1', meter: '5000', basis: 'km', mutationId: randomUUID() };
  let first;
  interrupt(async () => { first = await post(mount); });
  assert.equal((await post({ ...mount, serial: 'F-02', mutationId: randomUUID() })).status, 409);
  assert.equal(first.status, 201);
  assert.equal((await post(mount)).body.id, first.body.id);
  assert.equal((await post({ action: 'move', expected: first.body.id, meter: '5020', unit: 'CA21', position: 'D2', arrivalMeter: '3000' }, assigned)).status, 403);
  assert.equal((await post({ action: 'inspect', expected: first.body.id, meter: '4900', depth: '10', pressure: '99' })).status, 400);
  const end = await post({ action: 'remove', expected: first.body.id, meter: '5200' });
  assert.equal(end.status, 201);
  assert.equal((await post({ action: 'cost', expected: end.body.id, amount: '120', currency: 'PAB', reference: 'Factura tardía QA' })).status, 201);
  const { body } = await get('F-01');
  assert.equal(body.current, null);
  assert.deepEqual(body.totals, { basis: 'km', usage: 200, amount: 120, currency: 'PAB', rate: 0.6, reference: 'Factura tardía QA' });
});

test('una inspección anterior requiere confirmar el montaje y protege la posición hasta entonces', async () => {
  const { rows, get, post } = fixture();
  const legacy = Array(26).fill('');
  Object.assign(legacy, { 0: 'anterior', 1: 'CA20', 3: 'I1', 7: 'F-OLD', 10: '1100', 16: '0', 17: '13/11/2026' });
  const superseded = [...legacy];
  Object.assign(superseded, { 0: 'anterior-2', 7: '#121', 17: '12/11/2026' });
  rows.push(legacy, superseded);
  const newMount = { action: 'mount', unit: 'CA20', position: 'I1', meter: '1000', basis: 'h' };
  assert.equal((await post(newMount)).status, 409);
  assert.equal((await post({ ...newMount, serial: 'F-OLD', unit: 'CA21', position: 'D2', confirmBaseline: 'yes' },
    { ...manager, allUnits: false, assignedUnits: ['CA21'] })).status, 403);
  assert.equal((await post({ ...newMount, serial: 'F-OLD' })).status, 409);
  assert.equal((await post({ ...newMount, serial: 'F-OLD', confirmBaseline: 'yes' })).status, 400);
  assert.equal((await post({ ...newMount, serial: 'F-OLD', confirmBaseline: 'yes', meter: '1100' })).status, 201);
  const { body } = await get('F-OLD');
  assert.equal(body.legacy[0].pressure, '0');
  assert.equal(body.totals.usage, 0);
  assert.equal((await get('#121')).body.legacy.length, 1);
});

test('el destino respeta el equipo y un remontaje no vuelve a sumar lecturas ya registradas', async () => {
  const { post, get } = fixture();
  const mount = { action: 'mount', unit: 'CA20', position: 'I1', meter: '1000', basis: 'h' };
  assert.equal((await post({ ...mount, unit: 'CA21', position: 'LE12' })).status, 400);
  assert.equal((await post({ ...mount, unit: 'CA21', basis: 'km' })).status, 400);
  const first = await post(mount);
  const removed = await post({ action: 'remove', meter: '1100', expected: first.body.id });
  assert.equal((await post({ ...mount, meter: '1050', expected: removed.body.id })).status, 400);
  const second = await post({ ...mount, meter: '1120', expected: removed.body.id });
  assert.equal(second.status, 201);
  assert.equal((await post({ action: 'inspect', expected: second.body.id, meter: '1150', pressure: '90', depth: '9' })).status, 201);
  assert.equal((await get('F-01')).body.totals.usage, 130);
});

test('tablero por unidad muestra sólo llantas montadas, posición y última inspección local', async () => {
  const { byUnit, post } = fixture();
  const mounted = await post({ action: 'mount', unit: 'CA20', position: 'I1', meter: '1000', basis: 'h' });
  const inspected = await post({ action: 'inspect', expected: mounted.body.id, meter: '1030', pressure: '108', depth: '12.5' });
  const first = await byUnit('CA20', assigned);
  assert.equal(first.status, 200);
  assert.equal(first.body.mounted.length, 1);
  assert.deepEqual([first.body.mounted[0].serial, first.body.mounted[0].position], ['F-01', 'I1']);
  assert.deepEqual([first.body.mounted[0].inspection.pressure, first.body.mounted[0].inspection.depth], [108, 12.5]);
  const moved = await post({ action: 'move', expected: inspected.body.id, meter: '1100',
    unit: 'CA21', position: 'D2', arrivalMeter: '600', arrivalBasis: 'h' });
  assert.equal(moved.status, 201);
  assert.equal((await byUnit('CA20', assigned)).body.mounted.length, 0);
  assert.equal((await byUnit('CA21')).body.mounted[0].position, 'D2');
  assert.equal((await byUnit('CA21')).body.mounted[0].inspection, undefined);
  assert.equal((await byUnit('CA21', assigned)).status, 403);
  assert.equal((await byUnit('CA20', { ...assigned, role: 'operador' })).status, 403);
});
