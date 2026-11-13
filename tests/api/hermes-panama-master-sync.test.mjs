import assert from 'node:assert/strict';
import test from 'node:test';
import { projectMasterRows, masterPublicationQuery, readShiftTail } from '../../scripts/hermes-panama-master-sync.mjs';

test('el corte PM admite Estado y conserva el valor oficial sin copiar columnas ajenas', () => {
  const rows = [
    ['EQUIPO', 'MODELO', 'Estado', 'PRÓXIMO PM', 'HORAS QUE LE QUEDAN', 'LECTURA', 'PLAN', 'RESPONSABLE'],
    ['DZ205', 'D8T', 'Vencido', 'PM 250', '-10', 'Al día', 'Por aprobar', 'personal@example.invalid'],
  ];
  const projected = projectMasterRows('maintenance', rows);
  assert.deepEqual(projected[0], ['EQUIPO', '¿CÓMO ESTÁ?', 'PRÓXIMO PM', 'HORAS QUE LE QUEDAN', 'LECTURA', 'PLAN', 'MODELO']);
  assert.deepEqual(projected[1], ['DZ205', 'Vencido', 'PM 250', '-10', 'Al día', 'Por aprobar', 'D8T']);
  assert.throws(() => projectMasterRows('maintenance', [rows[0].filter(cell => cell !== 'Estado'), rows[1]]), /cabeceras/);
});

test('los costos se restringen a la flota TMF y las cotizaciones al país', () => {
  const fleetUnits = new Set(['DZ205']);
  const costs = [['UNIDAD', 'HORAS TMF', 'INGRESO USD', 'COMPRAS + REPARTO USD', 'COSTO ANALÍTICO PARCIAL USD/h', 'MARGEN ANALÍTICO PARCIAL USD/h'],
    ['MX506', '5', '50', '20', '4', '6'], ['DZ205', '5', '80', '20', '4', '12']];
  assert.deepEqual(projectMasterRows('costs', costs, fleetUnits).slice(1), [costs[2]]);
  assert.throws(() => projectMasterRows('costs', costs, new Set(['OTHER'])), /sin filas/);
  const orders = [['Nº OT', 'EQUIPO', 'FALLA / TRABAJO A REALIZAR', 'ESTADO', 'CONTROL INTEGRIDAD OT', 'PROYECTO'],
    ['OT-1', 'DZ205', 'Taller', 'Abierta', 'Válido', 'TMF'],
    ['OT-2', 'DZ205', 'Taller de otro proyecto', 'Abierta', 'Válido', 'México']];
  assert.equal(projectMasterRows('orders', orders, fleetUnits).length, 2);
  const purchases = [['ID', 'País', 'Equipo / Item', 'Descripción', 'Monto', 'Moneda', 'Estado operativo', 'OC', 'Control recepción'],
    ['Q1', 'México', 'DZ205', 'Otro país', '30', 'USD', '', '', ''],
    ['Q2', 'Panamá', 'DX520', 'Una compra de Panamá', '100', 'USD', '', '', '']];
  assert.equal(projectMasterRows('purchases', purchases, fleetUnits)[1][0], 'Q2');
});

test('REGISTRO localiza el último folio real y conserva solamente los turnos más recientes', async () => {
  const calls = [];
  const read = async range => {
    calls.push(range);
    if (range === 'A3:L3') return [['Clave', 'Fecha', 'Turno', 'Código', '', '', '', 'H. Inicial', 'H. Final', '', 'Estado']];
    if (range === 'A8:A14') return [[], ['20261113|Día|DZ205'], [], ['Plantilla']];
    if (range === 'A7:L9') return [['20261112|Día|DZ205'], [], ['20261113|Día|DZ205']];
    throw new Error('Rango inesperado: ' + range);
  };
  const rows = await readShiftTail(read, 14, { keyPage: 7, historyRows: 3 });
  assert.deepEqual(calls, ['A3:L3', 'A8:A14', 'A7:L9']);
  assert.deepEqual(rows.slice(1).map(row => row[0]), ['20261112|Día|DZ205', undefined, '20261113|Día|DZ205']);
});

test('el texto de origen no puede convertirse en SQL ejecutable', () => {
  const suspicious = "texto $hermes_master$ '; select now(); --";
  const query = masterPublicationQuery('fleet', '2026-11-13T22:55:00.000Z', [['Código', suspicious]]);
  assert.match(query, /\$hermes_master_+\$/);
  assert.ok(query.includes(JSON.stringify([['Código', suspicious]])));
  assert.throws(() => masterPublicationQuery("'; select now();", '2026-11-13T22:55:00.000Z', []), /fuente/);
});
