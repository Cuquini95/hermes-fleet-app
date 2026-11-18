import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { tabs } from './fixture.mjs';

const readiness = 'HERMES_PA_ESTADO_UNIDAD';
const workUnits = ['DZ203', 'EX401', 'DZ205'];
const workshop = '/hermes-api/api/workshop/';
const roles = {
  jefe_taller: [workshop + 'schedule', 'schedule'],
  coordinador: [workshop + 'orders', 'orders'],
  supervisor: ['/hermes-api/api/panama/turnos', 'records'],
  gerencia: ['/hermes-api/api/purchasing/orders', 'orders'],
  almacen: ['/hermes-api/api/purchasing/receiving', 'orders'],
};

export function latencies(durations) {
  const sorted = durations.toSorted((a, b) => a - b);
  const at = fraction => sorted.length ? Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 10) / 10 : null;
  return { p50Ms: at(.50), p95Ms: at(.95), maxMs: at(1) };
}

const duplicates = values => values.length - new Set(values).size;
const numberPattern = /^OT-\d{4,15}$/;

function mechanicOrder(index, account, tag) {
  const row = Array(26).fill('');
  const id = 'OT-QA-CARGA-' + tag + '-' + index;
  Object.assign(row, { 0: id, 1: id, 2: '15/11/2026', 3: workUnits[index % workUnits.length],
    4: 'Mecánica', 5: 'Trabajo QA ' + tag, 9: 'En Reparación', 17: account.user.id, 18: 'carga-' + id });
  return row;
}

async function replayWrite(call, body, index, responses) {
  async function attempt() {
    const response = await call(body);
    responses.push(response.status);
    return response;
  }

  const initial = await Promise.all([attempt(), attempt()]);
  const accepted = initial.filter(response => [200, 201].includes(response.status));
  assert(initial.every(response => [200, 201, 409].includes(response.status)),
    'Escritura inicial inesperada: ' + initial.map(response => response.status).join(', '));
  for (let retry = 1; !accepted.length && retry <= 8; retry++) {
    // Desynchronize contenders on the same unit, keeping the original mutation ID.
    await delay(retry * 8 + index * retry);
    const response = await attempt();
    if ([200, 201].includes(response.status)) accepted.push(response);
    else assert.equal(response.status, 409, 'Fallo del reintento de la escritura');
  }
  assert(accepted.length, 'La escritura no se confirmó tras resolver conflictos de concurrencia');
  const confirm = await attempt();
  const id = accepted[0].data?.otId;
  assert(id && accepted.every(response => response.data?.otId === id), 'El reintento respondió con dos OT distintas');
  assert.equal(confirm.status, 200);
  assert.equal(confirm.data?.otId, id);
  assert.equal(confirm.data?.replayed, true);
  return id;
}

function storedOperations(records, snapshot, nativeOperations) {
  const [orders, failures, history] = snapshot;
  const passed = records.filter(item => item.confirmed);
  let missing = 0;
  let repeated = 0;
  let withoutPublicFolio = 0;
  for (const item of passed) {
    const rows = orders.filter(row => row[1] === item.otId);
    const changed = item.role === 'operador' ? 'estado' : 'observaciones';
    const events = history.filter(row => row[1] === item.otId && row[2] === changed && row[7] === item.account.user.id);
    const matches = item.role === 'operador'
      ? [rows.filter(row => row[0] === item.body.mutationId && row[19] === item.account.user.id).length,
        failures.filter(row => row[13] === item.otId && row[15] === item.account.user.id).length, events.length]
      : [rows.filter(row => row[15] === item.body.value && row[17] === item.account.user.id).length,
        events.filter(row => row[4] === item.body.value).length];
    if (matches.some(count => count === 0)) missing++;
    if (matches.some(count => count > 1)) repeated++;
    if (nativeOperations && !rows.some(row => numberPattern.test(row[25] || ''))) withoutPublicFolio++;
  }
  const internal = orders.map(row => row[1]).filter(value => /^OT-/.test(value ?? ''));
  const displayed = orders.map(row => row[25]).filter(value => numberPattern.test(value ?? ''));
  const confirmedReports = passed.filter(item => item.role === 'operador').length;
  const insertedReports = orders.filter(row => records.some(item => item.role === 'operador' && row[0] === item.body.mutationId)).length;
  return {
    intended: records.length, confirmed: passed.length, reportWrites: confirmedReports,
    mechanicWrites: passed.length - confirmedReports,
    lost: records.length - passed.length + missing,
    repeated: Math.max(repeated, insertedReports - confirmedReports),
    duplicateInternalFolios: duplicates(internal), duplicatePublicFolios: nativeOperations ? duplicates(displayed) : null,
    withoutPublicFolio: nativeOperations ? withoutPublicFolio : null,
  };
}

export async function exerciseConcurrentRoles(fixture, request, sessions) {
  const sheets = fixture.operationalSheets ?? fixture.sheet;
  const affected = [tabs.orders, tabs.failure, tabs.history, readiness];
  const baseline = await Promise.all(affected.map(tab => sheets.read(tab)));
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const mechanics = new Map();
  for (const session of sessions.filter(item => item.role === 'mecanico')) {
    mechanics.set(session.account.user.id, mechanicOrder(mechanics.size, session.account, tag));
  }
  try {
    await sheets.seed(tabs.orders, [...baseline[0], ...mechanics.values()]);
    await sheets.seed(readiness, [...baseline[3], ...workUnits.map(unit => [unit, 'carga-' + tag, new Date().toISOString()])]);
    let reporter = 0;
    const actions = sessions.map(item => {
      const role = item.account.membership.can_receive_purchases ? 'almacen' : item.role;
      if (role === 'operador') {
        return { ...item, role, route: workshop + 'report',
          body: { mutationId: randomUUID(), unit: workUnits[reporter++ % workUnits.length], type: 'Mecánica',
            description: 'Carga de averías QA ' + tag, canMove: true, customer: 'QA', location: 'Patio QA', photos: [] } };
      }
      if (role === 'mecanico') {
        const order = mechanics.get(item.account.user.id);
        return { ...item, role, route: workshop + 'transition', body: {
          mutationId: randomUUID(), otId: order[1], expectedVersion: order[18],
          field: 'observaciones', value: 'Avance de carga QA ' + tag,
        } };
      }
      if (item.account.qaLabel === 'Finanzas') return { ...item, role, route: '/hermes-api/api/purchasing/ap', field: 'invoices' };
      return { ...item, role, route: roles[role][0], field: roles[role][1] };
    });

    const samples = [];
    const elapsed = performance.now();
    const exercised = await Promise.allSettled(actions.map(async (action, index) => {
      const started = performance.now();
      const statuses = [];
      const call = body => request(action.route, { body, cookie: action.cookie });
      try {
        if (action.body) {
          action.otId = await replayWrite(call, action.body, index, statuses);
          action.confirmed = true;
        } else {
          const response = await call();
          statuses.push(response.status);
          assert.equal(response.status, 200, action.role + ' no pudo consultar ' + action.field);
          assert(Array.isArray(response.data?.[action.field]), 'La consulta de ' + action.role + ' devolvió un resultado inválido');
          if (action.role === 'coordinador') {
            assert.equal(duplicates(response.data.orders.map(row => row[1])), 0, 'La bandeja contiene folios duplicados');
          }
        }
      } finally {
        samples.push({ role: action.role, duration: performance.now() - started, statuses });
      }
    }));

    const failures = exercised.filter(action => action.status === 'rejected');
    const snapshot = await Promise.all(affected.slice(0, 3).map(tab => sheets.read(tab)));
    const writes = storedOperations(actions.filter(action => action.body), snapshot, sheets.nativeOperations);
    const statuses = samples.flatMap(sample => sample.statuses);
    const statusCounts = Object.fromEntries([...new Set(statuses)].sort().map(code => [code, statuses.filter(value => value === code).length]));
    const result = {
      simultaneousSessions: sessions.length, totalMs: Math.round(performance.now() - elapsed),
      ...latencies(samples.map(sample => sample.duration)), errors: failures.length,
      recoveredConflicts: failures.length ? null : statusCounts[409] ?? 0,
      httpResponses: statusCounts, explicitReplayChecks: writes.confirmed,
      byRole: Object.fromEntries([...new Set(samples.map(sample => sample.role))].sort().map(role => {
        const roleSamples = samples.filter(sample => sample.role === role);
        return [role, { sessions: roleSamples.length, ...latencies(roleSamples.map(sample => sample.duration)) }];
      })),
      prescribedMix: Object.fromEntries([...new Set(sessions.map(session => session.account.qaLabel).filter(Boolean))]
        .map(label => [label, sessions.filter(session => session.account.qaLabel === label).length])),
      writes,
    };
    assert(!result.errors, `${failures[0]?.reason?.message ?? ''} · ${JSON.stringify(result)}`);
    assert(!writes.lost && !writes.repeated && !writes.duplicateInternalFolios && !writes.duplicatePublicFolios
      && !writes.withoutPublicFolio, 'Integridad de escrituras: ' + JSON.stringify(writes));
    return result;
  } finally {
    // Restore fixture state before other acceptance cases run. The mutation IDs are unique per cohort.
    for (const [index, tab] of affected.entries()) await sheets.seed(tab, baseline[index]);
  }
}
