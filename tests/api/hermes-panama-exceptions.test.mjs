import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';

const session = {
  userId: 'supervisor-fixture', userName: 'Revisión QA', role: 'supervisor', project: 'tmf-panama',
  allUnits: false, assignedUnits: ['DZ203'],
};
const order = (substitute = {}) => Object.assign(Array(26).fill(''), {
  1: 'OT-EXCEPTION-QA', 2: '14/11/2026', 3: 'DZ203', 4: 'PM', 5: 'PM pendiente', 7: 'CRITICA', 8: 'Mecánico QA',
  9: 'En Reparación', 23: JSON.stringify({ dueAt: 1500 }), 25: 'OT-0892', ...substitute,
});

function read(rows, options = {}) {
  const { authorizedSession = session, native = true, history = [] } = options;
  return dispatchWorkshop({
    method: 'GET', path: 'api/workshop/exceptions', session: authorizedSession,
    sheets: { nativeOperations: native, read: async tab => tab === 'ORDENES_TRABAJO' ? rows : history },
    now: new Date('2026-11-16T02:00:00.000Z'),
  });
}

test('la excepción abre la OT exacta y conserva responsable y horómetro oficiales para la unidad autorizada', async () => {
  const response = await read([order(), order({ 1: 'OT-OUT-QA', 3: 'EX401' })]);
  assert.equal(response.status, 200);
  assert.equal(response.body.observedAt, '2026-11-16T02:00:00.000Z');
  assert.deepEqual(response.body.units, ['DZ203']);
  assert.equal(response.body.assignmentsChecked, true);
  assert.deepEqual(response.body.records, [{
    id: 'OT-EXCEPTION-QA', unit: 'DZ203', state: 'active', kind: 'critical', folio: 'OT-0892',
    owner: 'Mecánico QA', dueHours: 1500, status: 'En Reparación', description: 'PM pendiente',
    openedOn: '2026-11-14', unassigned: false, critical: true,
  }]);
  assert.equal((await read([order()], { authorizedSession: { ...session, role: 'operador' } })).status, 403);
  assert.equal((await read([order()], { authorizedSession: { ...session, project: 'mx' } })).status, 404);
});

test('solo estados vigentes confirman retiro y una OT técnicamente cerrada conserva retorno hasta la recepción', async () => {
  const response = await read([
    order({ 1: 'OT-PM-OK', 9: 'Completado' }),
    order({ 1: 'OT-RETURN-PENDING', 4: 'Avería', 9: 'Completado', 8: 'Mecánico anterior', 23: '' }),
    order({ 1: 'OT-RETURN-ACCEPTED', 4: 'Avería', 9: 'Completado', 22: JSON.stringify({ decision: 'accepted' }) }),
    order({ 1: 'OT-PART', 4: 'Avería', 9: 'Esperando Pieza', 7: 'MEDIA', 8: '', 23: '' }),
    order({ 1: 'OT-UNKNOWN', 9: 'Revisión del dato' }),
    order({ 1: 'OT-OPEN', 9: 'Abierta', 7: '' }),
    order({ 1: 'OT-REASSIGNED', 9: 'En Reparación', 7: 'MEDIA' }),
  ]);
  assert.deepEqual(response.body.records.map(record => [record.id, record.state, record.kind, record.owner, record.dueHours]), [
    ['OT-PM-OK', 'resolved', undefined, undefined, undefined],
    ['OT-RETURN-PENDING', 'active', 'return', null, null],
    ['OT-RETURN-ACCEPTED', 'resolved', undefined, undefined, undefined],
    ['OT-PART', 'active', 'parts', null, null],
    ['OT-UNKNOWN', 'unknown', undefined, undefined, undefined],
    ['OT-OPEN', 'unknown', undefined, undefined, undefined],
    ['OT-REASSIGNED', 'resolved', undefined, undefined, undefined],
  ]);
});

test('un folio operativo duplicado exige conciliación y un historial anterior a la fila nativa no borra el pendiente', async () => {
  const dup = await read([order(), order({ 9: 'Completado' })]);
  assert.deepEqual(dup.body.records, [{ id: 'OT-EXCEPTION-QA', unit: 'DZ203', state: 'unknown' }]);
  const history = [['2026-11-15T23:00:00Z', 'OT-EXCEPTION-QA', 'estado', 'En Reparación', 'Completado']];
  const legacy = await read([order()], { native: false, history });
  assert.equal(legacy.body.records[0].state, 'resolved');
  const native = await read([order()], { history });
  assert.equal(native.body.records[0].state, 'active');
});


test('marca solo las órdenes activas sin asignar y conserva un solo registro para las que esperan repuesto', async () => {
  const response = await read([
    order({ 1: 'OT-OPEN', 7: '', 8: 'Sin asignar', 9: 'En Espera de Asignación' }),
    order({ 1: 'OT-PARTS', 8: '', 9: 'Esperando repuesto' }),
    order({ 1: 'OT-NAMED', 7: 'ALTA', 8: '', 17: 'mechanic-fixture' }),
    order({ 1: 'OT-REVIEW', 7: 'ALTA', 8: '', 9: 'Resuelta' }),
    order({ 1: 'OT-CLOSED', 8: '', 9: 'Cerrada' }),
  ]);
  assert.deepEqual(response.body.records.map(({ id, state, kind, unassigned }) => [id, state, kind, unassigned]), [
    ['OT-OPEN', 'active', 'assignment', true],
    ['OT-PARTS', 'active', 'parts', true],
    ['OT-NAMED', 'resolved', undefined, undefined],
    ['OT-REVIEW', 'resolved', undefined, undefined],
    ['OT-CLOSED', 'resolved', undefined, undefined],
  ]);
});
