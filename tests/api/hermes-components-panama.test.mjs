import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchPanama } from '../../api/_lib/hermes-panama.js';
const request = { method: 'GET', path: 'api/panama/componentes', query: { unit: 'DZ203' },
  session: { project: 'tmf-panama', role: 'jefe_taller', allUnits: false, assignedUnits: ['DZ203'] } };
const changes = [
  ['FECHA', 'EQUIPO', 'PIEZA', 'LADO / POSICIÓN', 'HORÓMETRO AL CAMBIO (h)', '¿POR QUÉ SE CAMBIÓ?', '¿BIEN ANOTADO?', 'HORAS QUE DURÓ LA PIEZA'],
  ['02/11/2026', 'DZ203', 'CADENA', 'Izquierdo', '3,010.5', 'Parcial', 'OK', '1,220.1'],
  ['01/11/2026', 'EX401', 'CADENA', 'Todo', '999', 'No corresponde', 'OK', ''],
];
test('component detail preserves change position and leaves unknown readings unknown', async () => {
  const response = await dispatchPanama({ ...request, read: async spec => {
    if (spec.key === 'dozerChanges') return changes;
    if (spec.key === 'excavatorChanges') throw Error('fixture unavailable');
    if (spec.key === 'dozerLife') return [
      ['Equipo','Pieza','Lado','Vida','UltHor','HorAct','Usadas','Restantes','Estado'],
      ['DZ203','CADENA','Izquierdo','2,000','3,010.5','','','','Sin dato'],
    ];
    return [['Equipo','Pieza','Lado','Vida','UltHor','HorAct','Usadas','Restantes','Estado']];
  } });
  assert.equal(response.status, 200);
  assert.equal(response.body.changes.length, 1);
  assert.equal(response.body.changes[0].position, 'Izquierdo');
  assert.equal(response.body.changes[0].meter, '3,010.5');
  assert.equal(response.body.life[0].currentMeter, '');
  assert.deepEqual(response.body.unavailable, ['excavatorChanges']);
});
test('component detail rejects a unit outside the authenticated assignment', async () => {
  const response = await dispatchPanama({ ...request, query: { unit: 'EX401' }, read: async () => assert.fail('No access to source') });
  assert.equal(response.status, 403);
});
