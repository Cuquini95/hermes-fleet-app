import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatchPanama, readPrintablePanamaPm } from '../../api/_lib/hermes-panama.js';
import { resolvePanamaPmChecklist } from '../../api/_lib/hermes-panama-pm-checklist.js';

const checklistLink = gid => 'https://docs.google.com/spreadsheets/d/1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw/edit#gid=' + gid;
const plan = { unit: 'EX401', model: 'Develon DX360LCA-7M', approved: 'No', checklist: checklistLink(104) };
const snapshot = {
  captured_at: '2026-11-17T11:20:00Z',
  rows: [{
    id: '104', name: 'DX360-DX340', rows: [
      ['▸', 'PREPARACIÓN Y SEGURIDAD · todo PM'], ['1', 'Preparar equipo'],
      ['▸', 'PM 250 · distinguir DX340 de DX360'],
      ['2', 'DX340: Control del modelo A. DX360: Control del modelo B.'],
      ['3', 'DX360 primeras 250 h: Confirmar que corresponda.'],
      ['▸', 'PM 500 · aplicar tareas vencidas'], ['4', 'Tarea de 500'],
      ['▸', 'PM 1000 · además de PM 250 y 500'], ['5', 'Tarea de 1000'],
      ['▸', 'PM 2000 · además de PM menores'], ['6', 'Tarea de 2000'],
      ['▸', 'CIERRE Y PRUEBA · todo PM'], ['7', 'Cerrar'],
      ['■', 'HALLAZGOS Y FIRMAS'], ['8', 'Fila fuera del checklist'],
    ],
  }],
};
const taskIds = doc => doc.sections.flatMap(group => group.tasks.map(task => task.id));

test('cumulative PM lookup preserves the selected model, threshold and common steps', () => {
  const pm250 = resolvePanamaPmChecklist(plan, 250, snapshot);
  assert.deepEqual(taskIds(pm250), ['1', '2', '3', '7']);
  assert.equal(pm250.sections[1].tasks[0].label, 'DX360: Control del modelo B.');
  assert.equal(pm250.approved, false);
  assert.deepEqual(taskIds(resolvePanamaPmChecklist(plan, 1000, snapshot)), ['1', '2', '3', '4', '5', '7']);
  const other = { ...plan, unit: 'EX402', model: 'Develon DX340LCA-K' };
  const pm340 = resolvePanamaPmChecklist(other, 250, snapshot);
  assert.equal(pm340.sections[1].tasks[0].label, 'DX340: Control del modelo A.');
  assert.deepEqual(taskIds(pm340), ['1', '2', '7']);
  assert.equal(resolvePanamaPmChecklist({ ...plan, model: 'DX530LC-7M' }, 250, snapshot), null);
  assert.equal(resolvePanamaPmChecklist(plan, 750, snapshot), null);
});

test('the PM checklist route rejects out-of-scope units and resolves the intended published cut', async () => {
  const role = { project: 'tmf-panama', role: 'coordinador', assignedUnits: ['EX401'] };
  const args = {
    path: 'api/panama/pm-checklist', method: 'GET', query: { unit: 'EX401', level: 'PM-1000' }, session: role,
    read: async spec => [
      Object.values(spec.columns),
      Object.keys(spec.columns).map(key => plan[key] ?? ''),
    ],
    readPmChecklists: async () => snapshot,
  };
  assert.equal((await dispatchPanama({ ...args, query: { ...args.query, unit: 'EX402' } })).status, 403);
  assert.equal((await dispatchPanama({ ...args, session: { ...role, role: 'almacen' } })).status, 403);
  const doc = await dispatchPanama(args);
  assert.equal(doc.status, 200);
  assert.deepEqual(taskIds(doc.body), ['1', '2', '3', '4', '5', '7']);
  assert.equal((await readPrintablePanamaPm(args.query, role, {
    readPlan: async () => [plan], readPmChecklists: args.readPmChecklists, expectedModel: 'DX340LCA-K',
  })).status, 409);
});

test('the printable PM includes authoritative identity and a reproducible catalog revision', async () => {
  const args = { readPlan: async () => [plan], readPmChecklists: async () => snapshot,
    readEquipment: async () => [{ unit: 'EX401', project: 'TMF', model: 'DX360LCA-7M', serial: 'FICTICIA-01' }] };
  const query = { unit: 'EX401', level: 'PM-1000' };
  const actor = { project: 'tmf-panama', allUnits: true };
  const result = await readPrintablePanamaPm(query, actor, args);
  assert.equal(result.status, 200);
  assert.equal(result.body.serial, 'FICTICIA-01');
  assert.equal(result.body.identityVerified, true);
  assert.match(result.body.revision, /^[a-f0-9]{16}$/);
  assert.equal((await readPrintablePanamaPm(query, actor, args)).body.revision, result.body.revision);
  const edited = structuredClone(snapshot); edited.rows[0].rows[1][1] = 'Otra tarea ficticia';
  assert.notEqual(resolvePanamaPmChecklist(plan, 1000, edited).revision, result.body.revision);
  assert.equal((await readPrintablePanamaPm(query, actor, { ...args, expectedSerial: 'OTRA-SERIE' })).status, 409);
  const unavailable = await readPrintablePanamaPm(query, actor, { ...args, readEquipment: async () => [] });
  assert.equal(unavailable.body.identityVerified, false);
  assert.equal(unavailable.body.serial, undefined);
  assert.equal((await readPrintablePanamaPm(query, actor, { ...args, readEquipment: async () => [
    { unit: 'EX401', project: 'TMF', model: 'DX340LCA-K', serial: 'FICTICIA-01' },
  ] })).status, 409);
});
