import { identityConfig, identityRequest } from './hermes-identity.js';

export const ODOMETER_TAB = 'HERMES_PA_ODOMETRO';
const PROJECT = 'tmf-panama';
const UNIT = /^[A-Z0-9][A-Z0-9 _-]{0,39}$/;
const SOURCE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const PANAMA_OFFSET = 5 * 3600000;
const scales = new Map([['h', ['h', 1]], ['min', ['h', 1 / 60]], ['km', ['km', 1]], ['mi', ['km', 1.609344]]]);
const code = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const clean = (value, max) => typeof value === 'string' && value.trim().length <= max && !/[\x00-\x1f]/.test(value) ? value.trim() : '';

export function numberReading(value) {
  const string = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  return /^\d{1,8}(?:\.\d{1,3})?$/.test(string) ? Number(string) : NaN;
}

function stamp(value) {
  if (typeof value !== 'string' || !TIMESTAMP.test(value)) return NaN;
  const day = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  const time = Date.parse(value);
  return Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === value.slice(0, 10) ? time : NaN;
}

export const meterDate = timestamp => new Date(timestamp - PANAMA_OFFSET).toISOString().slice(0, 10);
const iso = timestamp => new Date(timestamp).toISOString();
const inPeriod = date => date.slice(0, 7);

export function meterPeriod(value, now) {
  const current = inPeriod(meterDate(now));
  if (value === undefined) return current;
  return typeof value === 'string' && /^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(value) && value <= current ? value : null;
}

export function telematicsPolicy(raw) {
  let config;
  try { config = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { sources: [], odometer: new Set() }; }
  const odometer = new Set((Array.isArray(config?.odometerUnits) ? config.odometerUnits : []).map(code).filter(unit => UNIT.test(unit)));
  const sources = new Map();
  const repeated = new Set();
  for (const spec of Array.isArray(config?.sources) ? config.sources : []) {
    const key = spec?.key;
    const label = clean(spec?.label, 80);
    if (typeof key !== 'string' || !SOURCE.test(key) || !label
      || !Number.isFinite(spec.maxAgeHours) || spec.maxAgeHours <= 0 || spec.maxAgeHours > 720 || !spec.units || Array.isArray(spec.units)) continue;
    const units = new Map();
    for (const [unit, measures] of Object.entries(spec.units)) {
      if (UNIT.test(unit) && Array.isArray(measures) && measures.length && measures.every(measure => ['h', 'km'].includes(measure))) {
        units.set(unit, new Set(measures));
      }
    }
    if (sources.has(key)) repeated.add(key);
    else if (units.size) sources.set(key, { key, label, maxAgeHours: spec.maxAgeHours, units });
  }
  for (const key of repeated) sources.delete(key);
  return { sources: [...sources.values()], odometer };
}

export async function readPanamaTelematicsCut() {
  const config = identityConfig();
  if (config.project !== PROJECT) throw new Error('Panama telematics project mismatch');
  const response = await identityRequest(config, '/rest/v1/hermes_panama_source_snapshots', {
    query: { source: 'eq.telematics', select: 'captured_at,rows', limit: 1 },
  });
  if (!response.ok) throw new Error('Panama telematics cut unavailable');
  const [cut] = await response.json();
  return cut ? { capturedAt: cut.captured_at, readings: cut.rows } : null;
}

export async function automaticMeters(readCut, policies, unit, now) {
  const approved = new Map(policies.filter(source => source.units.has(unit)).map(source => [source.key, source]));
  const measures = [...new Set([...approved.values()].flatMap(source => [...source.units.get(unit)]))];
  if (!approved.size) return { status: 'not_configured', readings: [], measures };
  try {
    const cut = await readCut?.();
    const cutStamp = stamp(cut?.capturedAt);
    if (!Number.isFinite(cutStamp) || cutStamp > now || !Array.isArray(cut?.readings) || cut.readings.length > 20000) {
      throw new Error('Invalid telematics cut');
    }
    const readings = new Map();
    const conflicts = new Set();
    for (const entry of cut.readings) {
      if (entry?.project !== PROJECT || code(entry.unit) !== unit) continue;
      const policy = approved.get(entry.source);
      const [measure, scale] = scales.get(entry.measure) ?? [];
      const raw = numberReading(entry.value);
      const timestamp = stamp(entry.measuredAt);
      const reference = clean(entry.reference, 160);
      if (!policy?.units.get(unit).has(measure) || !Number.isFinite(raw)
        || !Number.isFinite(timestamp) || timestamp > cutStamp || !reference) continue;
      const value = Number((raw * scale).toFixed(3));
      const key = JSON.stringify([entry.source, measure, timestamp]);
      if (readings.has(key) && readings.get(key).value !== value) conflicts.add(key);
      else readings.set(key, { origin: 'telematics', source: policy.label, measure, value, measuredAt: iso(timestamp), timeOrder: timestamp,
        period: inPeriod(meterDate(timestamp)), reference, freshness: now - timestamp <= policy.maxAgeHours * 3600000 ? 'current' : 'stale',
        originalMeasure: entry.measure, originalValue: raw });
    }
    for (const key of conflicts) readings.delete(key);
    return { status: 'available', capturedAt: iso(cutStamp), readings: [...readings.values()], measures, conflicts: conflicts.size };
  } catch {
    return { status: 'unavailable', readings: [], measures };
  }
}

export function manualOdometerReading(row) {
  const timeOrder = stamp(row[1]);
  const value = numberReading(row[2]);
  const reference = clean(row[3], 160);
  if (!Number.isFinite(timeOrder) || !Number.isFinite(value) || !reference) return null;
  return { origin: 'manual', source: 'Hermes', measure: 'km', value, measuredAt: iso(timeOrder), timeOrder,
    period: inPeriod(meterDate(timeOrder)), reference, freshness: 'manual' };
}

export function unifiedMeters({ automatic, manualHours, manualDistance, manualHoursAvailable, manualDistanceAvailable, official, period, now, distanceConfigured, canCaptureDistance }) {
  const fromHours = manualHours.filter(sample => sample.timestamp <= now).map(sample => ({
    origin: 'manual', source: 'Hermes', measure: 'h', value: sample.totalHours, measuredAt: iso(sample.timestamp), timeOrder: sample.timestamp,
    period: inPeriod(sample.date), freshness: 'manual', ...(sample.reference && { reference: sample.reference }), kind: sample.kind,
  }));
  const fromRegister = official.shifts.filter(shift => DATE.test(shift.date) && shift.date <= meterDate(now)).flatMap(shift =>
    /** REGISTRO reports a shift date, without a measured clock time. */
    ['inicio', 'final'].map((kind, index) => ({
      origin: 'register', source: 'REGISTRO TMF', measure: 'h', value: index === 0 ? shift.start : shift.end,
      date: shift.date, timeOrder: Date.parse(`${shift.date}T00:00:00-05:00`) + index, period: inPeriod(shift.date),
      reference: shift.reference, freshness: 'register', kind, shift: shift.shift,
    })));
  const readings = [...automatic.readings, ...fromHours, ...manualDistance.filter(reading => reading.timeOrder <= now), ...fromRegister]
    .sort((a, b) => b.timeOrder - a.timeOrder);
  const publicReading = reading => {
    if (!reading) return null;
    const { timeOrder: _timeOrder, ...result } = reading;
    return result;
  };
  const approvedMeasures = new Set(automatic.measures);
  const streams = [...new Set(['h', ...automatic.measures, ...(distanceConfigured ? ['km'] : [])])].map(measure => {
    const related = readings.filter(reading => reading.measure === measure);
    const automatic = related.find(reading => reading.origin === 'telematics' && reading.freshness === 'current')
      ?? related.find(reading => reading.origin === 'telematics');
    const manual = related.find(reading => reading.origin === 'manual');
    const finals = related.filter(reading => reading.origin === 'register' && reading.kind === 'final');
    const latestFinals = finals.filter(reading => reading.date === finals[0]?.date);
    const registerAmbiguous = new Set(latestFinals.map(reading => reading.value)).size > 1;
    const register = registerAmbiguous ? null : finals[0];
    const primary = automatic?.freshness === 'current' ? 'telematics' : manual ? 'manual' : register ? 'register' : null;
    return { measure, primary, automaticConfigured: approvedMeasures.has(measure), registerAmbiguous,
      automatic: publicReading(automatic), manual: publicReading(manual), register: publicReading(register) };
  });
  const monthly = readings.filter(reading => reading.period === period);
  return { status: automatic.status, capturedAt: automatic.capturedAt ?? null, conflicts: automatic.conflicts ?? 0, period, streams,
    readings: monthly.slice(0, 60).map(publicReading), totalReadings: monthly.length, canCaptureDistance, manualHoursAvailable, manualDistanceAvailable };
}
