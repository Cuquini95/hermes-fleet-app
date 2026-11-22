import { createHash } from 'node:crypto';
import { panamaTireLayout } from '../../src/lib/panama-tire-layouts.js';

export const TIRE_TAB = '13 Neumáticos';
const MARKER = 'HERMES_TIRES_V1';
export const isTireEventRow = row => row[26] === MARKER;
const ROLES = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const POSITIONS = new Set(['I1', 'D2', 'I3', 'D4', 'I5', 'D6', 'DE5', 'DI6', 'LI7', 'LE8', 'DE9', 'DI10', 'LI11', 'LE12']);
const ACTIONS = new Set(['mount', 'move', 'remove', 'inspect', 'cost']);
const folded = input => typeof input === 'string' ? input.trim().toUpperCase() : '';
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const place = location => JSON.stringify([location.unit, location.position]);
const authorized = (session, unit) => session.allUnits === true || (session.assignedUnits ?? []).some(value => folded(value) === unit);
const canSee = (session, event) => event.units.every(unit => authorized(session, unit));

class TireError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function ensure(condition, status, message) {
  if (!condition) throw new TireError(status, message);
}

function serialOf(input) {
  const serial = folded(input);
  ensure(serial && serial.length <= 80 && !/\p{C}/u.test(serial), 400, 'Ingresa la serie o el número de fuego.');
  return serial;
}

function decimal(input, digits, max, label) {
  const raw = typeof input === 'number' ? String(input) : typeof input === 'string' ? input.trim() : '';
  const number = Number(raw);
  ensure(new RegExp(`^\\d{1,9}(?:\\.\\d{1,${digits}})?$`).test(raw) && number <= max, 400, `${label} inválido.`);
  return Math.round(number * 10 ** digits);
}

function charge(body) {
  const amount = decimal(body.amount, 2, 99999999.99, 'Costo');
  const currency = folded(body.currency);
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  ensure(amount > 0 && ['USD', 'PAB'].includes(currency) && reference && reference.length <= 180, 400,
    'Indica el costo, la moneda y la referencia de factura o comprobante.');
  return { amount, currency, reference };
}

function destination(body) {
  const unit = folded(body.unit), position = folded(body.position);
  ensure(/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(unit) && POSITIONS.has(position), 400, 'Selecciona una unidad y posición válidas.');
  return { unit, position };
}

function apply(book, entry) {
  const { id, at, actor, serial, body } = entry;
  const { action } = body;
  ensure(ACTIONS.has(action), 400, 'Selecciona el trabajo realizado.');
  const old = book.tires.get(serial);
  ensure((body.expected || null) === (old?.id ?? null), 409, 'El historial cambió. Consulta la llanta y revisa la posición actual.');
  const tire = { ...old, id, history: old?.history ?? [], usage: old?.usage ?? 0, meters: new Map(old?.meters) };
  const from = old?.current ?? null;
  const readMeter = label => decimal(body[label], 3, 999999999, 'Medidor acumulado');
  const event = { id, at, actor, action, units: [] };

  if (action === 'mount' || action === 'move') {
    const to = destination(body);
    const basis = old?.basis ?? body.basis;
    const nextMeter = readMeter(action === 'move' ? 'arrivalMeter' : 'meter');
    ensure(!book.occupied.has(place(to)), 409, 'La posición de destino ya está ocupada.');
    ensure(!book.unitBasis.has(to.unit) || book.unitBasis.get(to.unit) === basis, 400,
      'El equipo ya tiene otra unidad de medida registrada para neumáticos.');
    ensure(nextMeter >= (tire.meters.get(to.unit) ?? 0), 400, 'La lectura de destino es menor que la última lectura de esta llanta en la unidad.');
    event.location = to;
    if (action === 'mount') {
      ensure(!from, 409, 'La llanta ya está montada. Registra un traslado.');
      ensure(['h', 'km'].includes(basis) && (!body.basis || body.basis === basis), 400, 'Usa la misma base de medición de la llanta.');
      tire.basis = basis;
      tire.lastMeter = nextMeter;
      event.meter = tire.lastMeter / 1000;
      if (body.amount != null && body.amount !== '') {
        ensure(!old?.charge, 409, 'El costo de adquisición ya está registrado.');
        tire.charge = charge(body);
      }
    } else {
      ensure(from, 409, 'Consulta la ubicación actual de la llanta.');
      ensure(body.arrivalBasis === old.basis, 400, 'El medidor de destino debe usar la misma unidad de medida.');
      ensure(to.unit !== from.unit || nextMeter === readMeter('meter'), 400,
        'Una rotación en la misma unidad requiere una sola lectura.');
      tire.lastMeter = nextMeter;
      event.arrivalMeter = tire.lastMeter / 1000;
    }
    tire.current = to;
  }

  if (action === 'inspect' || action === 'move' || action === 'remove') {
    ensure(from, 409, 'La llanta requiere una ubicación activa.');
    const meter = readMeter('meter');
    ensure(meter >= old.lastMeter, 400, 'El medidor es menor que la última lectura en esta unidad.');
    tire.usage += meter - old.lastMeter;
    tire.meters.set(from.unit, meter);
    event.meter = meter / 1000;
    if (action === 'inspect') {
      event.location = from;
      event.depth = decimal(body.depth, 2, 300, 'Profundidad') / 100;
      event.pressure = decimal(body.pressure, 2, 1000, 'Presión') / 100;
      tire.lastMeter = meter;
    } else {
      event.from = from;
      if (action === 'remove') tire.current = null;
    }
  }

  if (action === 'cost') {
    ensure(old && !old.charge, 409, 'La llanta no está en el historial o ya tiene un costo registrado.');
    tire.charge = charge(body);
  }
  if (tire.charge && tire.charge !== old?.charge) event.cost = tire.charge;
  event.units = [...new Set([from?.unit, event.location?.unit, old?.lastLocation?.unit].filter(Boolean))];
  tire.lastLocation = tire.current ?? from ?? old?.lastLocation;
  if (from) book.occupied.delete(place(from));
  if (tire.current) {
    tire.meters.set(tire.current.unit, tire.lastMeter);
    book.occupied.set(place(tire.current), serial);
    book.unitBasis.set(tire.current.unit, tire.basis);
  }
  tire.history.push(event);
  book.tires.set(serial, tire);
  book.last = id;
  return event;
}

function journal(rows) {
  const book = { tires: new Map(), occupied: new Map(), unitBasis: new Map(), last: 'initial', legacy: [] };
  const ids = new Set();
  for (const row of rows) {
    if (!isTireEventRow(row)) {
      book.legacy.push(row);
      book.last = digest([book.last, row]);
      continue;
    }
    let entry;
    try {
      entry = JSON.parse(row[27]);
      ensure(entry?.id === row[0] && /^[a-f0-9]{64}$/.test(entry.id) && !ids.has(entry.id) && entry.actor
        && Number.isFinite(Date.parse(entry.at)) && entry.serial === serialOf(row[7]), 503, 'Historial inconsistente.');
      const event = apply(book, entry);
      ensure((event.location ?? event.from ?? book.tires.get(entry.serial).lastLocation)?.unit === row[1], 503, 'Unidad inconsistente.');
      ids.add(entry.id);
    } catch {
      throw new TireError(503, 'El historial de neumáticos requiere revisión.');
    }
  }
  return book;
}

function inspectionTime(row) {
  const captured = Date.parse(row[28]);
  if (Number.isFinite(captured)) return new Date(captured).toISOString();
  const input = row[17];
  const legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(input ?? ''));
  const day = legacy ? `${legacy[3]}-${legacy[2].padStart(2, '0')}-${legacy[1].padStart(2, '0')}` : String(input ?? '').slice(0, 10);
  const ms = Date.parse(day + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === day ? `${day}T05:00:00.000Z` : '';
}

function latestSightings(rows) {
  if (rows.some(row => !row.time)) return rows;
  const latest = rows.map(row => row.time).sort().at(-1);
  return rows.filter(row => row.time === latest);
}

function legacyLocations(book) {
  const bySerial = new Map();
  for (const row of book.legacy) {
    const serial = folded(row[7]), unit = folded(row[1]), position = folded(row[3]);
    if (!serial || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(unit) || !POSITIONS.has(position)) continue;
    const prior = bySerial.get(serial) ?? [];
    prior.push({ unit, position, serial, time: inspectionTime(row) });
    bySerial.set(serial, prior);
  }
  const bySlot = new Map();
  for (const [serial, records] of bySerial) {
    const latest = latestSightings(records);
    bySerial.set(serial, [...new Map(latest.map(row => [place(row), row])).values()]);
    for (const row of latest) {
      const key = place(row);
      bySlot.set(key, [...(bySlot.get(key) ?? []), row]);
    }
  }
  const unresolved = new Map([...bySlot].map(([key, records]) => [key, latestSightings(records).filter(row => !book.tires.has(row.serial))]));
  return { bySerial, unresolved };
}

function hoursObserved(book, serial, unit) {
  return book.legacy.reduce((latest, row) => {
    const value = String(row[10] ?? '').trim();
    if (folded(row[7]) !== serial || folded(row[1]) !== unit || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(value)) return latest;
    return Math.max(latest, Math.round(Number(value.replaceAll(',', '')) * 1000));
  }, 0);
}

export function prepareLegacyTireInspection(rows, row) {
  const book = journal(rows);
  const serial = serialOf(row[7]);
  const location = destination({ unit: row[1], position: row[3] });
  ensure(!book.tires.has(serial) && !book.occupied.has(place(location)), 409,
    'Esta llanta o posición se gestiona por número de fuego. Usa su ficha para inspeccionarla.');
  const stamped = [...row];
  while (stamped.length < 28) stamped.push('');
  stamped.push(new Date().toISOString());
  return { row: stamped, guard: `panama:tire-ledger:${book.last}` };
}

function report(book, serial, session) {
  const tire = book.tires.get(serial);
  const history = (tire?.history ?? []).filter(event => canSee(session, event)).reverse();
  const legacy = book.legacy.filter(row => folded(row[7]) === serial && row[1] && row[3] && authorized(session, folded(row[1])))
    .sort((a, b) => inspectionTime(b).localeCompare(inspectionTime(a)))
    .map(row => ({ unit: row[1], position: row[3], meter: row[10] ?? '', depth: row[13] ?? '', pressure: row[16] ?? '',
      date: row[17] || '', status: row[18] || '', note: row[25] || '' }));
  const complete = !!tire && history.length === tire.history.length;
  const current = tire?.current && authorized(session, tire.current.unit) ? tire.current : null;
  const quote = tire?.charge;
  const totals = complete ? { basis: tire.basis, usage: tire.usage / 1000, amount: quote ? quote.amount / 100 : null,
    currency: quote?.currency ?? null, rate: quote && tire.usage ? Math.round(quote.amount * 100000 / tire.usage) / 10000 : null,
    reference: quote?.reference ?? null } : null;
  return { serial, current, retired: complete && !tire.current, latest: complete || current ? tire.id : null,
    basis: complete || current ? tire.basis : null, incomplete: (!!history.length || !!current) && !complete, totals, legacy,
    history: history.map(({ units: _units, cost, ...event }) => ({ ...event, ...(complete && cost && { cost: { ...cost, amount: cost.amount / 100 } }) })) };
}

function reportByUnit(book, unit, session) {
  ensure(/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(unit), 400, 'Unidad inválida.');
  ensure(authorized(session, unit), 403, 'Unidad fuera de tu alcance.');
  const mounted = [...book.tires.entries()]
    .filter(([, tire]) => tire.current?.unit === unit)
    .map(([serial, tire]) => {
      const arrival = tire.history.findLastIndex(event => ['mount', 'move'].includes(event.action) && event.location?.unit === unit);
      const lastInspection = tire.history.slice(Math.max(0, arrival + 1))
        .filter(event => event.action === 'inspect' && event.location?.unit === unit).at(-1);
      return {
        serial,
        position: tire.current.position,
        basis: tire.basis,
        ...(lastInspection && { inspection: {
          at: lastInspection.at, meter: lastInspection.meter, pressure: lastInspection.pressure, depth: lastInspection.depth,
        } }),
      };
    })
    .sort((a, b) => a.position.localeCompare(b.position, 'es', { numeric: true }));
  const legacyRecords = book.legacy.filter(row => folded(row[1]) === unit && row[7]).length;
  return { unit, mounted, legacyRecords, source: 'Hermes: eventos de neumáticos' };
}

export async function dispatchPanamaTires({ method, query, body, session, sheets }) {
  try {
    ensure(session?.project === 'tmf-panama' && session.userId && session.userName && ROLES.has(session.role), 403,
      'Consulta reservada a Taller y Operaciones de Panamá.');
    ensure(method === 'GET' || method === 'POST', 405, 'Método no permitido.');
    if (method === 'GET' && query?.unit && !query?.serial) {
      const unit = folded(query.unit);
      ensure(/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(unit), 400, 'Unidad inválida.');
      ensure(authorized(session, unit), 403, 'Unidad fuera de tu alcance.');
      const book = journal(await sheets.read(TIRE_TAB, { requireExisting: true }));
      return { status: 200, body: reportByUnit(book, unit, session) };
    }
    const serial = serialOf(method === 'GET' ? query?.serial : body?.serial);
    const book = journal(await sheets.read(TIRE_TAB, { requireExisting: true }));
    if (method === 'GET') return { status: 200, body: report(book, serial, session) };

    ensure(uuid.test(body?.mutationId ?? ''), 400, 'Identificador de registro inválido.');
    const key = `panama:tire:${session.userId}:${body.mutationId.toLowerCase()}`;
    const input = Object.fromEntries(['action','expected','unit','position','meter','arrivalMeter','arrivalBasis','basis','pressure','depth','amount','currency','reference','confirmBaseline']
      .filter(field => body[field] !== undefined).map(field => [field, body[field]]));
    const fingerprint = digest([serial, input]);
    const id = digest(key);
    const old = book.tires.get(serial);
    const stored = old?.history.find(event => event.id === id);
    const source = old?.lastLocation?.unit;
    const hasDestination = ['mount', 'move'].includes(input.action);
    const unit = hasDestination ? destination(input).unit : '';
    if (stored) ensure(canSee(session, stored), 403, 'Unidad fuera de tu alcance.');
    else ensure((!source || authorized(session, source)) && (!unit || authorized(session, unit)), 403, 'Unidad fuera de tu alcance.');
    if (input.action === 'cost' || (input.action === 'mount' && input.amount != null && input.amount !== '')) {
      ensure(!old || old.history.every(event => canSee(session, event)), 403, 'El costo requiere acceso al historial completo.');
    }
    const prior = await sheets.replay({ key, fingerprint });
    if (prior) return { status: 200, body: prior };
    if (hasDestination) {
      const fleet = await sheets.read('01 Inventario');
      const equipment = fleet.slice(3).find(row => folded(row[1]) === unit);
      const layout = panamaTireLayout(equipment?.[2]);
      const basis = old?.basis ?? input.basis;
      ensure(layout?.positions.includes(destination(input).position), 400, 'La posición no corresponde a la unidad de destino.');
      ensure(layout.bases.includes(basis), 400, 'La unidad de medida no corresponde al equipo de destino.');
      const legacy = legacyLocations(book);
      const known = !old && legacy.bySerial.get(serial);
      if (known) {
        ensure(known.every(location => authorized(session, location.unit)), 403, 'Unidad fuera de tu alcance.');
        ensure(input.confirmBaseline === 'yes' && known.length === 1 && place(known[0]) === place(destination(input)), 409,
          'Confirma en campo la ubicación de la última inspección para iniciar el historial.');
        if (basis === 'h') ensure(decimal(input.meter, 3, 999999999, 'Medidor acumulado') >= hoursObserved(book, serial, unit),
          400, 'El horómetro es menor que el de una inspección anterior de esta llanta en la unidad.');
      }
      ensure(!legacy.unresolved.get(place(destination(input)))?.some(row => row.serial !== serial),
        409, 'Una inspección anterior deja esta posición pendiente de conciliación.');
    }
    const entry = { id, serial, at: new Date().toISOString(), actor: session.userName, body: input };
    const previousRevision = book.last;
    const event = apply(book, entry);
    const location = event.location ?? event.from ?? book.tires.get(serial).lastLocation;
    const row = Array(28).fill('');
    Object.assign(row, { 0: id, 1: location.unit, 3: location.position, 7: serial, 10: String(event.meter ?? ''),
      13: String(event.depth ?? ''), 16: String(event.pressure ?? ''), 17: entry.at, 26: MARKER, 27: JSON.stringify(entry) });
    const result = await sheets.commit({ key, fingerprint, guard: `panama:tire-ledger:${previousRevision}`,
      writes: [{ tab: TIRE_TAB, append: [row] }], result: { id } });
    return { status: result.replayed ? 200 : 201, body: result.result };
  } catch (error) {
    if (error instanceof TireError) return { status: error.status, body: { error: error.message } };
    if (error?.status === 409) return { status: 409, body: { error: 'El historial cambió. Consulta la llanta y revisa la posición actual.' } };
    return { status: 503, body: { error: 'No se pudo confirmar el registro de neumáticos.' } };
  }
}
