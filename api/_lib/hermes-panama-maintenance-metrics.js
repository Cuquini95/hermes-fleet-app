const key = value => String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const phaseFor = new Map([
  ['ABIERTA', 'pending'], ['EN ESPERA DE ASIGNACION', 'pending'], ['EN REPARACION', 'repair'],
  ['ESPERANDO PIEZA', 'parts'], ['RESUELTA', 'review'], ['COMPLETADO', 'return'],
]);
const next = new Map([
  ['ABIERTA', ['EN REPARACION', 'ESPERANDO PIEZA']], ['EN ESPERA DE ASIGNACION', ['EN REPARACION', 'ESPERANDO PIEZA']],
  ['EN REPARACION', ['ESPERANDO PIEZA', 'RESUELTA']], ['ESPERANDO PIEZA', ['EN REPARACION', 'RESUELTA']],
  ['RESUELTA', ['EN REPARACION', 'COMPLETADO']], ['COMPLETADO', ['EN REPARACION']],
]);
const labels = { pending: 'Pendiente de reparación', repair: 'En reparación', parts: 'Esperando repuesto',
  review: 'Revisión técnica', return: 'Aceptación de Operaciones', mixed: 'Estados simultáneos', unknown: 'Sin estado horario verificado' };
const empty = () => Object.fromEntries(Object.keys(labels).map(name => [name, 0]));
const actorRoles = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

function timeline(record, rows, ambiguous, instant, issues) {
  const unknown = () => [{ start: record.start, finish: record.finish, phase: 'unknown' }];
  const issue = reason => issues.push({ unit: record.unit, folio: record.order.folio, reason });
  if (ambiguous) { issue('Vínculo de OT ambiguo; conciliar el historial.'); return unknown(); }
  const events = []; const seen = new Set(); let duplicated = false;
  for (const row of rows ?? []) {
    const time = instant(row[0]);
    if (Number.isFinite(time) && time > record.finish) continue;
    const before = key(row[3]), after = key(row[4]);
    if (!Number.isFinite(time) || !String(row[7] ?? '').trim() || !actorRoles.has(row[6]) || !phaseFor.has(after)
      || (before ? !phaseFor.has(before) || (before !== after && !next.get(before)?.includes(after)) : after !== 'ABIERTA')) {
      issue('Hay un cambio de estado sin hora, autor o secuencia verificables.'); return unknown();
    }
    const fingerprint = JSON.stringify(row.slice(0, 8));
    if (seen.has(fingerprint)) { duplicated = true; continue; }
    seen.add(fingerprint); events.push({ time, before, after });
  }
  if (!events.length) { issue('Falta el historial horario de estados.'); return unknown(); }
  events.sort((a, b) => a.time - b.time);
  if (events.some((event, index) => index && events[index - 1].time === event.time)
    || events.filter(event => !event.before).length > 1) {
    issue('Hay cambios simultáneos o aperturas duplicadas por conciliar.'); return unknown();
  }
  if (duplicated) issue('Se omitió la copia idéntica de un cambio de estado.');
  const segments = []; let state = null; let at = record.start; let incomplete = false;
  for (const event of events) {
    const matches = state !== null && event.before === state;
    if (event.time > at) {
      const finish = Math.min(event.time, record.finish);
      if (finish > at) segments.push({ start: at, finish, phase: matches ? phaseFor.get(state) : 'unknown' });
    }
    if (state !== null && !matches) incomplete = true;
    state = event.after; at = Math.max(at, event.time);
  }
  if (record.finish > at) segments.push({ start: at, finish: record.finish,
    phase: state === key(record.status) ? phaseFor.get(state) : 'unknown' });
  if (state !== key(record.status)) incomplete = true;
  if (segments.some(segment => segment.phase === 'unknown')) incomplete = true;
  if (incomplete) issue('La cadena de estados tiene tramos sin verificar.');
  return segments;
}

function episodesFor(records) {
  const units = new Map();
  for (const record of records) { const list = units.get(record.unit) ?? []; list.push(record); units.set(record.unit, list); }
  return [...units.values()].flatMap(list => {
    const episodes = [];
    for (const record of list.sort((a, b) => a.start - b.start || a.order.id.localeCompare(b.order.id))) {
      const prior = episodes.at(-1);
      if (!prior || record.start > prior.finish) episodes.push({ unit: record.unit, start: record.start, finish: record.finish, open: record.open, records: [record] });
      else { prior.finish = Math.max(prior.finish, record.finish); prior.open ||= record.open; prior.records.push(record); }
    }
    return episodes;
  });
}

export function buildMaintenanceMetrics({ records, logs, orders, window, now, pendingStops, instant }) {
  const issues = []; const logsById = new Map(); const orderCounts = new Map();
  for (const row of orders) { const id = key(row[1]); if (id.startsWith('OT-')) orderCounts.set(id, (orderCounts.get(id) ?? 0) + 1); }
  for (const row of logs) {
    if (row[2] !== 'estado') continue;
    const id = key(row[1]); const list = logsById.get(id) ?? []; list.push(row); logsById.set(id, list);
  }
  const totals = empty(); const details = []; const byUnit = new Map(); const completed = [];
  const exclusions = { open: 0, preventive: 0, ambiguous: 0, outsidePeriod: 0, withoutType: 0 };
  for (const episode of episodesFor(records)) {
    if (episode.finish < window.start || episode.start >= window.finish) continue;
    const inCohort = episode.finish >= window.start
      && (episode.finish < window.finish || (window.finish === now && episode.finish === now));
    if (episode.open) exclusions.open++;
    else if (!inCohort) exclusions.outsidePeriod++;
    else if (episode.records.some(row => key(row.maintenanceType) === 'PM')) exclusions.preventive++;
    else if (episode.records.some(row => !key(row.maintenanceType))) exclusions.withoutType++;
    else if (episode.records.some(row => orderCounts.get(row.order.id) !== 1)) exclusions.ambiguous++;
    else if (episode.finish > episode.start) completed.push({ unit: episode.unit,
      startedAt: new Date(episode.start).toISOString(), endedAt: new Date(episode.finish).toISOString(),
      seconds: (episode.finish - episode.start) / 1000, folios: episode.records.map(row => row.order.folio) });

    const start = Math.max(episode.start, window.start), finish = Math.min(episode.finish, window.finish);
    if (finish <= start) continue;
    const active = episode.records.filter(row => row.finish > start && row.start < finish).map(record => ({ record,
      segments: timeline(record, logsById.get(record.order.id), orderCounts.get(record.order.id) !== 1, instant, issues) }));
    const edges = [...new Set([start, finish, ...active.flatMap(({ segments }) => segments.flatMap(segment => [segment.start, segment.finish]))])]
      .filter(value => value >= start && value <= finish).sort((a, b) => a - b);
    const milliseconds = empty();
    for (let i = 1; i < edges.length; i++) {
      const a = edges[i - 1], b = edges[i]; if (b <= a) continue;
      const phases = new Set(active.flatMap(({ record, segments }) => {
        if (record.start > a || record.finish <= a) return [];
        return [segments.find(segment => segment.start <= a && segment.finish > a)?.phase ?? 'unknown'];
      }));
      const phase = phases.size === 1 ? [...phases][0] : phases.has('unknown') || phases.size === 0 ? 'unknown' : 'mixed';
      milliseconds[phase] += b - a;
    }
    const seconds = (finish - start) / 1000; const phases = Object.fromEntries(Object.entries(milliseconds).map(([name, ms]) => [name, ms / 1000]));
    const unit = byUnit.get(episode.unit) ?? { unit: episode.unit, seconds: 0, phases: empty() };
    unit.seconds += seconds;
    for (const name of Object.keys(labels)) { totals[name] += phases[name]; unit.phases[name] += phases[name]; }
    byUnit.set(episode.unit, unit);
    details.push({ unit: episode.unit, id: episode.records[0].order.id, seconds, phases });
  }
  const measured = Object.values(totals).reduce((sum, seconds) => sum + seconds, 0);
  const classified = measured - totals.unknown - totals.mixed;
  const numeratorSeconds = completed.reduce((sum, row) => sum + row.seconds, 0);
  return {
    version: 1, measuredSeconds: details.length ? measured : null,
    breakdown: Object.entries(labels).map(([name, label]) => ({ key: name, label, seconds: totals[name] })),
    coverage: { classifiedSeconds: classified, denominatorSeconds: measured,
      percent: measured > 0 ? classified / measured * 100 : null, pendingStops,
      historyIssues: issues.length, partial: pendingStops > 0 || totals.unknown > 0 || totals.mixed > 0 },
    mttr: { seconds: completed.length ? numeratorSeconds / completed.length : null, numeratorSeconds,
      denominator: completed.length, cohort: completed, exclusions, pendingStops,
      basis: 'Paradas correctivas continuas por equipo con retorno aceptado en el período. Duración completa desde el inicio confirmado; incluye esperas y no se recorta al inicio del período.' },
    details, units: [...byUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit)), issues,
  };
}
