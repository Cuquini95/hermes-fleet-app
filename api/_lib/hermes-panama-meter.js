import { createHash } from 'node:crypto';
import { HermesSheetError } from './hermes-google-sheets.js';
import { hasIdentityUnit } from './hermes-identity.js';
import { officialReading, officialShiftDate } from './hermes-shifts.js';

export const METER_TAB = '04B Registro Horómetros';
const READ = new Set(['operador', 'supervisor', 'gerencia']);
const REPLACE = new Set(['supervisor', 'gerencia']);
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unitCode = value => String(value ?? '').trim().toUpperCase();
const round = hours => Number(hours.toFixed(3));

function requireValue(condition, status, message) {
  if (!condition) throw new HermesSheetError(status, message);
}

function parseHours(value) {
  const hours = String(value ?? '').trim();
  return /^\d{1,8}(?:\.\d{1,3})?$/.test(hours) ? Number(hours) : NaN;
}

function meterSample(row) {
  const parts = String(row[0] ?? '').trim().split('/');
  const date = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : String(row[0] ?? '').trim();
  const time = String(row[1] ?? '').trim();
  const rawHours = parseHours(row[6]);
  const timestamp = Date.parse(`${date}T${time}-05:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)
    || !Number.isFinite(rawHours) || !Number.isFinite(timestamp)
    || new Date(timestamp - 5 * 3600000).toISOString().slice(0, 16) !== `${date}T${time.slice(0, 5)}`) return null;
  return { date, time, timestamp, rawHours, kind: row[5], ...(row[5] === 'cambio' && {
    previousHours: parseHours(row[10]), reference: String(row[11] ?? ''),
  }) };
}

function readingGuard(unit, count) {
  return `panama:meter:${unit}:${count}`;
}

async function unitSamples(sheets, unit) {
  return (await sheets.read(METER_TAB)).filter(row => unitCode(row[2]) === unit)
    .map(meterSample).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
}

function compatible(a, b) {
  const elapsed = (a.timestamp - b.timestamp) / 3600000;
  const difference = round(a.totalHours - b.totalHours);
  return elapsed === 0 ? difference === 0
    : elapsed * difference >= 0 && Math.abs(difference) <= Math.abs(elapsed) + 0.1;
}

function timeline(samples) {
  let offset = 0;
  return samples.map(sample => {
    if (sample.kind === 'cambio') {
      requireValue(Number.isFinite(sample.previousHours) && sample.reference, 503, 'El historial contiene un cambio de medidor incompleto.');
      offset = round(offset + sample.previousHours - sample.rawHours);
    }
    return { ...sample, totalHours: round(sample.rawHours + offset), offset };
  });
}

export async function validatePanamaMeterAppend(sheets, row) {
  const sample = meterSample(row);
  requireValue(sample && ['inicio', 'final'].includes(row[5]), 400, 'Registra una lectura, turno, fecha y hora válidos.');
  const unit = unitCode(row[2]);
  const samples = timeline(await unitSamples(sheets, unit));
  const change = samples.findLast(previous => previous.timestamp <= sample.timestamp && previous.kind === 'cambio');
  const totalHours = round(sample.rawHours + (change?.offset ?? 0));
  requireValue(change?.timestamp !== sample.timestamp && samples.every(previous => compatible({ ...sample, totalHours }, previous)),
    409, 'El horómetro no concuerda con las lecturas de la unidad. Verifica el medidor o concilia el cambio con Supervisión.');
  return readingGuard(unit, samples.length);
}

async function officialFor(readOfficialShifts, unit) {
  if (!readOfficialShifts) return { available: false, shifts: [] };
  try {
    const source = await readOfficialShifts();
    const { records, capturedAt } = Array.isArray(source) ? { records: source } : source;
    const shifts = records.filter(row => unitCode(row.unit) === unit).map(row => ({
      date: officialShiftDate(row.date), shift: row.shift, reference: row.id,
      start: officialReading(row.start), end: officialReading(row.end),
    })).filter(row => row.date && Number.isFinite(row.start) && Number.isFinite(row.end));
    shifts.sort((a, b) => b.date.localeCompare(a.date));
    return { available: true, capturedAt, shifts };
  } catch {
    return { available: false, shifts: [] };
  }
}

export async function dispatchPanamaMeter({ method, query, body, session, sheets, readOfficialShifts, mayWrite }) {
  requireValue(session.project === 'tmf-panama' && READ.has(session.role), 403, 'Consulta de horómetros no autorizada.');
  requireValue(method === 'GET' || method === 'POST', 405, 'Método no permitido.');
  const unit = unitCode(method === 'GET' ? query?.unit : body?.unit);
  requireValue(/^[A-Z0-9][A-Z0-9 _-]{0,39}$/.test(unit), 400, 'Unidad inválida.');
  requireValue(hasIdentityUnit(session, unit), 403, 'Unidad fuera de tu alcance.');
  if (method === 'GET') {
    const [samples, official] = await Promise.all([unitSamples(sheets, unit), officialFor(readOfficialShifts, unit)]);
    const history = timeline(samples).reverse().slice(0, 30).map(({ timestamp, offset, ...sample }) => {
      const matches = official.shifts.filter(shift => shift.date === sample.date);
      const reading = sample.kind === 'inicio' ? matches[0]?.start : matches[0]?.end;
      const reconciliation = sample.kind === 'cambio' ? null : !official.available ? 'unavailable'
        : matches.length === 0 ? 'pending' : matches.length === 1 && reading === sample.totalHours ? 'match' : 'review';
      return { ...sample, source: 'Hermes', reconciliation,
        ...(reconciliation === 'match' && { officialReference: matches[0].reference }) };
    });
    return { status: 200, body: { history, official: { ...official, shifts: official.shifts.slice(0, 10) },
      canReplace: mayWrite && REPLACE.has(session.role) && samples.length > 0 } };
  }
  requireValue(REPLACE.has(session.role), 403, 'El cambio de medidor debe registrarlo Supervisión o Gerencia.');
  requireValue(typeof body.mutationId === 'string' && UUID.test(body.mutationId), 400, 'Identificador de operación inválido.');
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const row = [body.date, body.time, unit, '', session.userName, 'cambio', String(body.newHours ?? ''), '', '',
    session.userId, String(body.previousHours ?? ''), reference];
  const sample = meterSample(row);
  requireValue(sample && Number.isFinite(sample.previousHours) && reference && reference.length <= 160,
    400, 'Indica fecha, hora, ambas lecturas y la referencia de Taller.');
  requireValue(sample.timestamp <= Date.now(), 400, 'La fecha del cambio de medidor no puede ser futura.');
  row[0] = sample.date;
  row[1] = sample.time;
  const key = `panama:meter:replace:${session.userId}:${body.mutationId.toLowerCase()}`;
  const fingerprint = hash([unit, sample.timestamp, sample.previousHours, sample.rawHours, reference]);
  const previous = await sheets.replay({ key, fingerprint });
  if (previous) return { status: 200, body: previous };
  const [samples, inventory] = await Promise.all([unitSamples(sheets, unit), sheets.read('01 Inventario')]);
  const asset = inventory.slice(3).find(item => unitCode(item[1]) === unit);
  requireValue(asset, 404, 'La unidad no figura en el inventario TMF.');
  const history = timeline(samples);
  const last = history.at(-1);
  requireValue(last && last.timestamp < sample.timestamp, 409, 'El cambio debe ser posterior a la última lectura registrada en Hermes.');
  const totalHours = round(sample.previousHours + last.offset);
  requireValue(history.every(prior => compatible({ ...sample, totalHours }, prior)), 409,
    'La lectura final del medidor anterior no concuerda con el historial.');
  row[3] = [asset[3], asset[4]].filter(Boolean).join(' ');
  const saved = await sheets.commit({ key, fingerprint, guard: readingGuard(unit, samples.length),
    writes: [{ tab: METER_TAB, append: [row] }], result: { success: true, totalHours } });
  return { status: saved.replayed ? 200 : 201, body: saved.result };
}
