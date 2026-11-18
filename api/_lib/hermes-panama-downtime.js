import { panamaWorkshopDate, panamaWorkshopFailureOrder } from './hermes-panama-workshop.js';
import { buildMaintenanceMetrics } from './hermes-panama-maintenance-metrics.js';

const DAY = 86_400_000;
const panamaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit',
});
const upper = value => String(value ?? '').trim().toUpperCase();
const plain = value => upper(value).normalize('NFD').replace(/\p{Diacritic}/gu, '');
const orderId = value => /^OT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(upper(value));
const openStates = new Set(['ABIERTA', 'EN ESPERA DE ASIGNACION', 'EN REPARACION', 'ESPERANDO PIEZA', 'RESUELTA']);
const iso = value => new Date(value).toISOString();
const dayOf = ms => panamaDate.format(new Date(ms));
const midnight = date => Date.parse(date + 'T00:00:00-05:00');

export function downtimeInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const time = Date.parse(value);
  const normalized = value.length === 20 ? value.slice(0, -1) + '.000Z' : value;
  return Number.isFinite(time) && iso(time) === normalized ? time : NaN;
}

function object(value) {
  try { return JSON.parse(value || 'null'); } catch { return null; }
}

function localDay(value) {
  const text = String(value ?? '').trim();
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const date = parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : text;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(midnight(date)) && dayOf(midnight(date)) === date ? date : null;
}

export function downtimeWindow(query, now) {
  const today = dayOf(now);
  const from = query?.from === undefined ? dayOf(now - 6 * DAY) : localDay(query.from);
  const through = query?.through === undefined ? today : localDay(query.through);
  if (!from || !through || from > through || through > today || midnight(through) - midnight(from) >= 31 * DAY) return null;
  return { from, through, start: midnight(from), finish: Math.min(now, midnight(through) + DAY) };
}

export function downtimeShiftStarts(raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(value?.day ?? '') || !time.test(value?.night ?? '') || value.day >= value.night) return null;
  return { day: value.day, night: value.night };
}

export function isReportedStop(row) {
  const metadata = object(row[16]);
  if (typeof metadata?.stopped === 'boolean') return metadata.stopped;
  return /(?:^|[.\s])Puede moverse: No\s*(?:\|\s*OT:\s*OT-[A-Z0-9]+(?:-[A-Z0-9]+)*\s*)?$/i.test(row[11] ?? '');
}

function splitShifts(start, finish, starts) {
  if (!starts) return [];
  const segments = [];
  for (let day = midnight(dayOf(start)) - DAY; day < finish; day += DAY) {
    const date = dayOf(day);
    const nextDate = dayOf(day + DAY);
    const startsAt = value => Date.parse(`${date}T${value}:00-05:00`);
    const windows = [
      ['Día', startsAt(starts.day), startsAt(starts.night)],
      ['Noche', startsAt(starts.night), Date.parse(`${nextDate}T${starts.day}:00-05:00`)],
    ];
    for (const [shift, left, right] of windows) {
      const a = Math.max(start, left), b = Math.min(finish, right);
      if (b > a) segments.push({ date, shift, from: iso(a), to: iso(b), seconds: (b - a) / 1000 });
    }
  }
  return segments;
}

function singleIndex(rows, getId, unitColumn) {
  const map = new Map();
  for (const row of rows) {
    const id = getId(row), unit = upper(row[unitColumn]);
    if (!orderId(id) || !unit) continue;
    const key = `${unit}\0${id}`;
    map.set(key, map.has(key) ? null : row);
  }
  return map;
}

function mergeUnitIntervals(records, window, shifts) {
  const groups = [];
  for (const record of records.sort((a, b) => a.start - b.start || a.order.id.localeCompare(b.order.id))) {
    const last = groups.at(-1);
    if (!last || last.finish < record.start) {
      groups.push({ ...record, orders: [record.order] });
    } else {
      last.finish = Math.max(last.finish, record.finish);
      last.open ||= record.open;
      last.orders.push(record.order);
    }
  }
  return groups.flatMap(g => {
    const start = Math.max(g.start, window.start), finish = Math.min(g.finish, window.finish);
    if (finish <= start) return [];
    return [{
      id: g.order.id, unit: g.unit, startedAt: iso(g.start), endedAt: g.open ? null : iso(g.finish), open: g.open,
      seconds: (finish - start) / 1000, orders: g.orders, causes: [...new Set(g.orders.map(order => order.cause))],
      segments: splitShifts(start, finish, shifts),
    }];
  });
}

export function buildPanamaDowntime({ failures, orders, logs, master, now, window, shifts, allows }) {
  const byOrder = singleIndex(orders, row => upper(row[1]), 3);
  const byFailure = singleIndex(failures, panamaWorkshopFailureOrder, 2);
  const creation = new Map();
  for (const row of logs) {
    if (row[2] !== 'estado' || row[3] || row[4] !== 'Abierta' || !row[7]) continue;
    const key = `${upper(row[1])}\0${row[7]}`;
    const value = downtimeInstant(row[0]);
    if (Number.isFinite(value)) creation.set(key, creation.has(key) ? NaN : value);
  }
  const associated = new Map();
  const pending = new Map();
  const units = new Map();
  for (const failure of failures) {
    const unit = upper(failure[2]), id = panamaWorkshopFailureOrder(failure);
    const reported = object(failure[16]);
    const explicit = Boolean(failure[16]);
    if (!unit || !allows(unit) || reported?.stopped === false || (!explicit && !isReportedStop(failure))) continue;
    const joined = `${unit}\0${id}`;
    const row = byOrder.get(joined);
    const folio = /^OT-\d{4,15}$/.test(row?.[25] ?? '') ? row[25] : id;
    const start = explicit ? downtimeInstant(reported?.stopped === true && reported.startedAt)
      : creation.get(`${id}\0${failure[15] ?? ''}`);
    const ops = object(row?.[22]), technical = object(row?.[21]), execution = object(row?.[20]);
    const closed = ops?.decision === 'accepted';
    const finish = closed ? downtimeInstant(ops.returnedAt) : now;
    const approved = downtimeInstant(technical?.acceptedAt);
    const recorded = downtimeInstant(ops?.recordedAt);
    const validTechnical = !!execution?.userId && typeof execution.functionalTest === 'string' && !!execution.functionalTest.trim()
      && !!technical?.userId && technical.userId !== execution.userId && technical.userId !== row?.[17]
      && approved <= now;
    const validReturn = closed
      ? row[9] === 'Completado' && validTechnical && !!ops.userId && ops.userId !== technical.userId
        && ops.userId !== execution.userId && ops.userId !== row[17]
        && start <= approved && approved <= finish && finish <= recorded && recorded <= now
      : (!row?.[22] || (ops?.decision === 'returned' && !!ops.userId && recorded <= now))
        && (openStates.has(plain(row?.[9])) || (row?.[9] === 'Completado' && validTechnical));
    const date = panamaWorkshopDate(failure[0]);
    const validInterval = row && byFailure.get(joined) === failure && Number.isFinite(start) && Number.isFinite(finish)
      && start <= now && finish >= start && finish <= now && validReturn;
    const linkedState = closed && validInterval ? 'closed' : 'reported';
    if (orderId(id)) associated.set(joined, linkedState);
    if (folio && orderId(folio)) associated.set(`${unit}\0${folio}`, linkedState);
    if (!validInterval) {
      const mayHaveStarted = Number.isFinite(start) ? start < window.finish : !date || date <= window.through;
      if (mayHaveStarted && (!validReturn || finish >= window.start)) {
        const key = orderId(id) ? joined : `${unit}\0${date}\0${failure[3] ?? ''}`;
        pending.set(key, { unit, folio: orderId(folio) ? folio : '', date, reason: 'Inicio, retorno o vínculo por verificar' });
      }
      continue;
    }
    const diagnosis = validTechnical && typeof execution.diagnosis === 'string' ? execution.diagnosis.trim() : '';
    const cause = diagnosis || String(failure[3] ?? '').trim() || 'Motivo por verificar';
    const order = { id, folio, cause, source: diagnosis ? 'Taller' : 'Reporte' };
    const records = units.get(unit) ?? [];
    records.push({ start, finish, open: !closed, unit, order, status: row[9], maintenanceType: row[4] });
    units.set(unit, records);
  }
  for (const record of master?.records ?? []) {
    const unit = upper(record.unit), id = upper(record.id), order = upper(record.order);
    const date = panamaWorkshopDate(record.last);
    const linkedState = associated.get(`${unit}\0${order || id}`);
    if (!unit || !allows(unit) || !['DETENIDO REPORTADO', 'EN REPARACION', 'ESPERANDO PIEZA'].includes(plain(record.status))
        || linkedState === 'reported' || date && date > window.through) continue;
    pending.set(`${unit}\0master\0${id || order}`, {
      unit, folio: orderId(order) ? order : id, date,
      reason: linkedState === 'closed' ? 'Hermes registra el retorno y el Maestro de Taller aún indica parada'
        : 'Maestro de Taller sin intervalo horario confirmado',
    });
  }
  const records = [...units.values()].flat();
  const intervals = [...units.values()].flatMap(records => mergeUnitIntervals(records, window, shifts))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.unit.localeCompare(b.unit));
  return {
    from: window.from, through: window.through, checkedAt: iso(now), shiftStarts: shifts, masterAvailable: Boolean(master),
    seconds: intervals.reduce((total, interval) => total + interval.seconds, 0), intervals, pending: [...pending.values()],
    metrics: buildMaintenanceMetrics({ records, orders, logs, window, now, pendingStops: pending.size, instant: downtimeInstant }),
  };
}
