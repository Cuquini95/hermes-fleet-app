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

test('component life recalculates used and remaining hours per installed position and flags conflicting readings', async () => {
  const header = ['Equipo','Pieza','Lado','Vida','UltHor','HorAct','Usadas','Restantes','Estado'];
  const response = await dispatchPanama({ ...request, read: async spec => spec.key !== 'dozerLife' ? [] : [
    header,
    ['DZ203','CADENA','Izquierdo','2,000','3,010.5','4,211.75','1,201.25','798.75','Vigente'],
    ['DZ203','CADENA','Derecho','2,000','4,100','4,211.75','100','1,900','Vigente'],
    ['DZ203','RODILLO','Derecho','100','4,100','4,211.75','','','Vencido'],
    ['DZ203','RODILLO','Izquierdo','200','4,300','4,211.75','','','Sin dato'],
    ['DZ203','SPROCKET','Izquierdo','1,000','','4,211.75','','','Sin dato'],
    ['DZ203','PLATO','Derecho','1,000','4,101','4,211.75','—','—','Sin dato'],
  ] });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.life.map(({ part, position, calculation }) => [part, position, calculation]), [
    ['CADENA', 'Izquierdo', { status: 'verified', elapsed: 1201.25, remaining: 798.75 }],
    ['CADENA', 'Derecho', { status: 'mismatch', elapsed: 111.75, remaining: 1888.25 }],
    ['RODILLO', 'Derecho', { status: 'reproduced', elapsed: 111.75, remaining: -11.75 }],
    ['RODILLO', 'Izquierdo', { status: 'regressed' }],
    ['SPROCKET', 'Izquierdo', { status: 'incomplete' }],
    ['PLATO', 'Derecho', { status: 'reproduced', elapsed: 110.75, remaining: 889.25 }],
  ]);
  assert.deepEqual(response.body.life.slice(0, 2).map(({ elapsed, remaining }) => [elapsed, remaining]),
    [['1,201.25','798.75'],['100','1,900']]);
});
