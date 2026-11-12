import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planRosterImport } from '../../scripts/import-hermes-roster.mjs';

const employee = { id: '00000000-0000-4000-8000-000000000001', email: 'employee@example.test', email_confirmed_at: '2026-11-01T00:00:00Z' };
const rosterEntry = { email: employee.email, userName: 'Usuario de prueba', role: 'operador', projects: ['tcm'], unitScope: 'assigned', assignedUnits: ['ca20'] };

test('links only the approved role and unit scope to the confirmed provider identity', () => {
  const { members, pending } = planRosterImport([rosterEntry], [employee], [], 'tcm');
  assert.deepEqual(pending, []);
  assert.deepEqual(members, [{
    user_id: employee.id, email: employee.email, user_name: rosterEntry.userName, role: 'operador',
    projects: ['tcm'], assigned_units: ['CA20'], unit_scope: 'assigned', active: true, can_approve_purchases: false,
  }]);
  assert.deepEqual(planRosterImport([rosterEntry], [employee], members, 'tcm').members, members);
});

test('leaves an unassigned role or unconfirmed provider identity pending without affecting eligible accounts', () => {
  const { members, pending } = planRosterImport([
    rosterEntry,
    { ...rosterEntry, email: 'pending-role@example.test', role: undefined },
    { ...rosterEntry, email: 'pending-identity@example.test' },
  ], [employee], [], 'tcm');
  assert.equal(members.length, 1);
  assert.deepEqual(pending, [{ fila: 2, motivo: 'rol_pendiente' }, { fila: 3, motivo: 'identidad_sin_confirmar' }]);
});

test('leaves conflicting roster identities and cross-project records pending', () => {
  const otherId = '00000000-0000-4000-8000-000000000002';
  assert.equal(planRosterImport([rosterEntry], [employee], [{ user_id: otherId, email: employee.email }], 'tcm').pending[0].motivo, 'identidad_distinta_a_la_vinculada');
  assert.equal(planRosterImport([{ ...rosterEntry, projects: ['otro'] }], [employee], [], 'tcm').members.length, 0);
  assert.equal(planRosterImport([{ ...rosterEntry, canApprovePurchases: true }], [employee], [], 'tcm').members.length, 0);
});

test('requires an explicit Panama-only grant for warehouse receiving', () => {
  const panama = { ...rosterEntry, projects: ['tmf-panama'], role: 'jefe_taller' };
  assert.equal(planRosterImport([panama], [employee], [], 'tmf-panama').members[0].can_receive_purchases, false);
  const allowed = planRosterImport([{ ...panama, canReceivePurchases: true }], [employee], [], 'tmf-panama');
  assert.equal(allowed.members[0].can_receive_purchases, true);
  assert.equal(allowed.members[0].can_approve_purchases, false);
  const crossProject = { ...panama, projects: ['tmf-panama', 'tcm'], canReceivePurchases: true };
  assert.equal(planRosterImport([crossProject], [employee], [], 'tmf-panama').members.length, 0);
  assert.equal(planRosterImport([{ ...rosterEntry, canReceivePurchases: true }], [employee], [], 'tcm').members.length, 0);
});
