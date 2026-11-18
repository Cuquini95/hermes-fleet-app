import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPanamaDowntime, downtimeWindow } from '../../api/_lib/hermes-panama-downtime.js';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';

const at = hour => `2026-11-17T${hour}:00:00.000Z`;
const now = Date.parse(at('23'));
const manager = { userId: 'qa-director', userName: 'Dirección QA', role: 'gerencia', project: 'tmf-panama', allUnits: true };
function stop({ id = 'OT-QA-A', folio = 'OT-0121', unit = 'QA01', start = at('12'), end = at('18'), type = 'Hidráulica' } = {}) {
  const failure = Array(17).fill('');
  Object.assign(failure, { 0: '17/11/2026', 2: unit, 3: 'Caso ficticio', 13: id, 15: 'qa-operator',
    16: JSON.stringify({ stopped: true, startedAt: start }) });
  const order = Array(26).fill('');
  Object.assign(order, { 1: id, 3: unit, 4: type, 9: end ? 'Completado' : 'En Reparación', 25: folio });
  if (end) {
    order[20] = JSON.stringify({ userId: 'qa-mechanic', functionalTest: 'Prueba funcional ficticia' });
    order[21] = JSON.stringify({ userId: 'qa-workshop', acceptedAt: at('17') });
    order[22] = JSON.stringify({ decision: 'accepted', userId: 'qa-operations', returnedAt: end, recordedAt: end });
  }
  const event = (hour, before, after) => [at(hour), id, 'estado', before, after, 'Persona QA', 'jefe_taller', 'qa-workshop'];
  const logs = [event('12', '', 'Abierta'), event('13', 'Abierta', 'En Reparación'),
    event('14', 'En Reparación', 'Esperando Pieza'), event('16', 'Esperando Pieza', 'En Reparación'),
    event('17', 'En Reparación', 'Resuelta'), [at('17').replace(':00:00.', ':30:00.'), id, 'estado', 'Resuelta', 'Completado', 'Persona QA', 'jefe_taller', 'qa-workshop']];
  return { failure, order, logs };
}
function report(cases = [], overrides = {}) {
  return buildPanamaDowntime({ failures: cases.map(row => row.failure), orders: cases.map(row => row.order), logs: cases.flatMap(row => row.logs),
    now, window: downtimeWindow({ from: '2026-11-17', through: '2026-11-17' }, now),
    shifts: null, master: { records: [] }, allows: () => true, ...overrides });
}
const phases = result => Object.fromEntries(result.metrics.breakdown.map(row => [row.key, row.seconds / 3600]));

test('una parada confirmada de seis horas separa dos horas de repuestos y calcula MTTR con retorno aceptado', () => {
  const data = report([stop()]);
  assert.equal(data.seconds, 21600);
  assert.deepEqual(phases(data), { pending: 1, repair: 2, parts: 2, review: .5, return: .5, mixed: 0, unknown: 0 });
  assert.equal(data.metrics.coverage.percent, 100);
  assert.equal(data.metrics.mttr.seconds, 21600);
  assert.equal(data.metrics.mttr.denominator, 1);
  assert.equal(data.metrics.mttr.numeratorSeconds, 21600);
  assert.deepEqual(data.metrics.mttr.cohort[0].folios, ['OT-0121']);
});

test('sin historial se conserva la parada medida y el MTTR de la muestra pero el desglose queda desconocido', () => {
  const other = stop({ id: 'OT-QA-B', folio: 'OT-0122', unit: 'QA02', start: at('14') }); other.logs = [];
  const data = report([stop(), other]);
  assert.equal(data.seconds, 10 * 3600);
  assert.equal(phases(data).unknown, 4);
  assert.equal(data.metrics.coverage.percent, 60);
  assert.equal(data.metrics.coverage.partial, true);
  assert.equal(data.metrics.mttr.seconds, 5 * 3600);
  assert.equal(data.metrics.mttr.denominator, 2);
  assert.match(data.metrics.issues[0].reason, /Falta el historial/);
});

test('dos OT simultáneas cuentan una sola parada y conservan los estados contradictorios como simultáneos', () => {
  const a = stop(); const b = stop({ id: 'OT-QA-B', folio: 'OT-0122', start: at('14') });
  b.logs = [[at('14'), b.order[1], 'estado', 'Abierta', 'En Reparación', 'Persona QA', 'mecanico', 'qa-mec'],
    [at('17'), b.order[1], 'estado', 'En Reparación', 'Resuelta', 'Persona QA', 'mecanico', 'qa-mec'],
    [at('17').replace(':00:00.', ':30:00.'), b.order[1], 'estado', 'Resuelta', 'Completado', 'Persona QA', 'jefe_taller', 'qa-jefe']];
  const data = report([a, b]);
  assert.equal(data.seconds, 6 * 3600);
  assert.equal(data.metrics.measuredSeconds, data.seconds);
  assert.equal(phases(data).mixed, 2);
  assert.equal(phases(data).repair, 2);
  assert.equal(data.metrics.mttr.denominator, 1);
  assert.equal(data.metrics.mttr.cohort[0].folios.length, 2);
  assert.equal(Object.values(phases(data)).reduce((a, b) => a + b, 0), 6);
});

test('historial parcial no aplica el estado actual hacia atrás ni inventa horas entre transiciones inconexas', () => {
  const row = stop(); row.logs.shift();
  assert.equal(phases(report([row])).unknown, 1);
  row.logs.splice(1, 1);
  const data = report([row]);
  assert.equal(phases(data).unknown, 4);
  assert.equal(phases(data).repair, 1);
});

test('copias idénticas no suman horas; cambios simultáneos, hora inválida o autor desconocido invalidan el desglose', () => {
  const duplicate = stop(); duplicate.logs.push([...duplicate.logs[2]]);
  assert.deepEqual(phases(report([duplicate])), phases(report([stop()])));
  for (const mutate of [
    row => row.logs.push([at('14'), row.order[1], 'estado', 'En Reparación', 'Resuelta', 'Persona QA', 'mecanico', 'qa-mec']),
    row => { row.logs[1][0] = '2026-11-17 13:00'; },
    row => { row.logs[1][7] = ''; },
  ]) {
    const row = stop(); mutate(row);
    assert.equal(phases(report([row])).unknown, 6);
  }
});

test('MTTR usa toda la parada iniciada antes del período; el tiempo medido se recorta a medianoche de Panamá', () => {
  const row = stop({ start: '2026-11-16T23:00:00Z' }); row.logs = [];
  const data = report([row]);
  assert.equal(data.seconds, 13 * 3600);
  assert.equal(data.metrics.mttr.numeratorSeconds, 19 * 3600);
  assert.equal(data.metrics.mttr.seconds, 19 * 3600);
});

test('retorno en el límite inicial entra en MTTR aunque no aporta horas al período; el límite final histórico queda fuera', () => {
  const row = stop({ start: '2026-11-16T23:00:00Z', end: '2026-11-17T05:00:00Z' });
  row.order[21] = JSON.stringify({ userId: 'qa-workshop', acceptedAt: '2026-11-17T04:00:00Z' }); row.logs = [];
  const data = report([row]);
  assert.equal(data.metrics.measuredSeconds, null);
  assert.equal(data.metrics.mttr.seconds, 6 * 3600);
  const nextDay = Date.parse('2026-11-18T12:00:00Z');
  row.order[22] = JSON.stringify({ decision: 'accepted', userId: 'qa-operations', returnedAt: '2026-11-18T05:00:00Z', recordedAt: '2026-11-18T05:00:00Z' });
  assert.equal(report([row], { now: nextDay, window: downtimeWindow({ from: '2026-11-17', through: '2026-11-17' }, nextDay) }).metrics.mttr.seconds, null);
});

test('abiertas, preventivas y tipos ausentes no entran al MTTR; episodios fuera de la ventana no inflan exclusiones', () => {
  const open = stop({ end: null }); open.logs = [];
  const pm = stop({ id: 'OT-QA-PM', unit: 'QA02', type: 'PM' });
  const missing = stop({ id: 'OT-QA-MISSING', unit: 'QA03', type: '' });
  const outside = stop({ id: 'OT-QA-OLD', unit: 'QA04', start: '2026-11-15T12:00:00Z', end: '2026-11-15T18:00:00Z' });
  outside.order[21] = JSON.stringify({ userId: 'qa-workshop', acceptedAt: '2026-11-15T17:00:00Z' });
  const data = report([open, pm, missing, outside]);
  assert.equal(data.metrics.mttr.seconds, null);
  assert.deepEqual(data.metrics.mttr.exclusions, { open: 1, preventive: 1, ambiguous: 0, outsidePeriod: 0, withoutType: 1 });
});

test('folios internos duplicados entre equipos no atribuyen historial al equipo equivocado', () => {
  const a = stop(); const b = stop({ unit: 'QA02', folio: 'OT-0122' });
  const data = report([a, b], { allows: unit => unit === 'QA01' });
  assert.equal(data.metrics.mttr.seconds, null);
  assert.equal(data.metrics.mttr.exclusions.ambiguous, 1);
  assert.equal(phases(data).unknown, 6);
  assert(!JSON.stringify(data.metrics).includes('QA02'));
});

test('sin intervalos confirmados no publica cero como tiempo medido o MTTR; retorno sin independencia queda pendiente', () => {
  const empty = report();
  assert.equal(empty.metrics.measuredSeconds, null); assert.equal(empty.metrics.mttr.seconds, null);
  assert.equal(empty.metrics.mttr.denominator, 0); assert.equal(empty.metrics.coverage.percent, null);
  const row = stop(); row.order[22] = JSON.stringify({ ...JSON.parse(row.order[22]), userId: 'qa-workshop' });
  const pending = report([row]);
  assert.equal(pending.metrics.measuredSeconds, null);
  assert.equal(pending.metrics.coverage.pendingStops, 1);
  row.order[22] = JSON.stringify({ ...JSON.parse(row.order[22]), userId: 'qa-operations' });
  row.order[21] = JSON.stringify({ userId: 'qa-workshop', acceptedAt: at('11') });
  const staleReview = report([row]);
  assert.equal(staleReview.metrics.measuredSeconds, null);
  assert.equal(staleReview.metrics.mttr.seconds, null);
  assert.equal(staleReview.pending.length, 1);
});

test('consulta conserva permisos, filtros y error de lectura; no escribe registros', async () => {
  const row = stop(); const other = stop({ id: 'OT-QA-OTHER', unit: 'QA02' }); let writes = 0;
  const sheets = {
    async read(tab) { return tab === 'Averias' ? [row.failure, other.failure] : tab === 'ORDENES_TRABAJO' ? [row.order, other.order] : [...row.logs, ...other.logs]; },
    async commit() { writes++; throw new Error('No debe escribir'); },
  };
  const request = (session = manager, extra = {}) => dispatchWorkshop({ path: 'api/workshop/downtime', method: 'GET', session, sheets,
    now: new Date(now), query: { from: '2026-11-17', through: '2026-11-17' }, ...extra });
  for (const role of ['operador', 'mecanico']) assert.equal((await request({ ...manager, role })).status, 403);
  assert.equal((await request({ ...manager, role: 'almacen' })).status, 401);
  assert.equal((await request({ ...manager, project: 'mexico' })).status, 404);
  const limited = { ...manager, allUnits: false, assignedUnits: ['QA01'] };
  const result = await request(limited);
  assert.equal(result.status, 200); assert(!JSON.stringify(result.body).includes('QA02'));
  assert.equal((await request(limited, { query: { unit: 'QA02' } })).status, 403);
  const unavailable = await request(manager, { sheets: { async read() { throw new Error('QA unavailable'); } } });
  assert.equal(unavailable.status, 503); assert.match(unavailable.body.error, /consultar los tiempos/);
  assert.equal(writes, 0);
});
