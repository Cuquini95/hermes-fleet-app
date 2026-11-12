import { createHash } from 'node:crypto';
import { hasIdentityUnit } from './hermes-identity.js';
import { PANAMA_PROJECT } from './hermes-panama.js';
import { HermesSheetError, PANAMA_SHIFT_TAB } from './hermes-google-sheets.js';

const READ = new Set(['operador', 'supervisor', 'coordinador', 'gerencia']);
const DELIVER = new Set(['operador', 'supervisor']);
const PENDING = 'Pendiente de revisión';
const ACCEPTED = 'Aceptado por Supervisión';
const RETURNED = 'Devuelto';
const OFFICIAL_PENDING = 'Pendiente de conciliación en REGISTRO';
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const FOLIO = /^TPA-[\dA-F]{20}$/;
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();

function requireValue(condition, status, message) {
  if (!condition) throw new HermesSheetError(status, message);
}

function text(value, label, max, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  requireValue((!required || result) && result.length <= max, 400, `${label}: revisa el dato ingresado.`);
  return result;
}

function quantity(value, label, decimalPlaces) {
  const source = typeof value === 'number' ? String(value) : value;
  const number = Number(source);
  requireValue(typeof source === 'string' && /^\d{1,8}(?:\.\d{1,3})?$/.test(source)
    && (source.split('.')[1]?.length ?? 0) <= decimalPlaces && Number.isFinite(number), 400, `${label}: ingresa un valor válido.`);
  return number;
}

function parseFields(body) {
  const date = text(body.date, 'Fecha', 10);
  const asDate = new Date(`${date}T00:00:00Z`);
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(asDate.valueOf()) && asDate.toISOString().slice(0, 10) === date,
    400, 'Fecha del turno inválida.');
  const unit = text(body.unit, 'Unidad', 40).toUpperCase();
  const shift = text(body.shift, 'Turno', 32).replace(/\s+/g, ' ');
  const initialHours = quantity(body.initialHours, 'Horómetro inicial', 3);
  const finalHours = quantity(body.finalHours, 'Horómetro final', 3);
  requireValue(finalHours >= initialHours, 400, 'El horómetro final es inferior al inicial. Verifica la lectura en su origen.');
  return { date, unit, shift, initialHours, finalHours, hours: Number((finalHours - initialHours).toFixed(3)),
    equipmentStatus: text(body.equipmentStatus, 'Estado del equipo', 100), support: text(body.support, 'Referencia del soporte', 250),
    trips: quantity(body.trips, 'Viajes', 0), tonnes: quantity(body.tonnes, 'Toneladas', 3),
    stops: text(body.stops, 'Paradas o episodio de avería', 500), client: text(body.client, 'Cliente', 120) };
}

function rowsToRecords(rows) {
  const records = new Map();
  for (const [id, unit, date, shift, version, status, initialHours, finalHours, hours, equipmentStatus, support,
    trips, tonnes, stops, client, authorId, authorName, actorId, actorName, at, action, comment] of rows) {
    if (!FOLIO.test(id)) continue;
    const history = records.get(id)?.history ?? [];
    const actor = { id: actorId, name: actorName };
    history.push({ action, actor, at, comment });
    const reviewed = action === 'accept' || action === 'return';
    records.set(id, {
      id, unit, date, shift, version: Number(version), status, initialHours: Number(initialHours), finalHours: Number(finalHours),
      hours: Number(hours), equipmentStatus, support, trips: Number(trips), tonnes: Number(tonnes), stops, client,
      createdBy: { id: authorId, name: authorName }, createdAt: history[0].at,
      reviewedBy: reviewed ? actor : null, reviewedAt: reviewed ? at : null, comment: reviewed ? comment : '',
      officialStatus: OFFICIAL_PENDING, history,
    });
  }
  return records;
}

function visible(session, record) {
  return hasIdentityUnit(session, record.unit)
    && (session.role !== 'operador' || session.userId === record.createdBy.id)
    && (session.role !== 'coordinador' || record.status === ACCEPTED);
}

function currentRecord(records, session, body) {
  requireValue(FOLIO.test(body.id), 400, 'Folio del parte inválido.');
  const previous = records.get(body.id);
  requireValue(previous, 404, 'Parte no encontrado.');
  requireValue(hasIdentityUnit(session, previous.unit), 403, 'Unidad fuera de tu alcance.');
  return previous;
}

export async function dispatchShifts({ path, method, body, session, sheets }) {
  requireValue(session.project === PANAMA_PROJECT && READ.has(session.role), 403, 'Relevo reservado a los roles autorizados de TMF Panamá.');
  if (path === 'api/panama/turnos') {
    requireValue(method === 'GET', 405, 'Método no permitido.');
    const records = rowsToRecords(await sheets.read(PANAMA_SHIFT_TAB, { cached: true }));
    return { status: 200, body: { records: [...records.values()].filter(record => visible(session, record)).reverse() } };
  }

  const deliver = path === 'api/panama/turnos/entregar';
  requireValue(deliver || path === 'api/panama/turnos/revisar', 404, 'Ruta no disponible.');
  requireValue(method === 'POST', 405, 'Método no permitido.');
  requireValue(deliver ? DELIVER.has(session.role) : session.role === 'supervisor', 403, 'Tu rol no tiene permiso para esta acción.');
  requireValue(typeof body.mutationId === 'string' && UUID.test(body.mutationId), 400, 'Identificador de operación inválido.');
  requireValue(!body.expectedUserId || body.expectedUserId === session.userId, 403, 'El registro pertenece a otra sesión.');

  const fields = deliver ? parseFields(body) : null;
  const action = deliver ? (body.id ? 'correct' : 'deliver') : body.action;
  requireValue(deliver || action === 'accept' || action === 'return', 400, 'Selecciona una decisión válida.');
  const comment = deliver ? '' : text(body.comment, 'Motivo de devolución', 500, action === 'return');
  const key = `panama:shift:${session.userId}:${body.mutationId.toLowerCase()}`;
  const fingerprint = sha([action, body.id ?? '', body.version ?? '', fields, comment]);
  const existing = await sheets.replay({ key, fingerprint });
  if (existing) {
    requireValue(visible(session, existing.record), 403, 'Unidad fuera de tu alcance.');
    return { status: action === 'deliver' ? 201 : 200, body: existing };
  }

  const records = rowsToRecords(await sheets.read(PANAMA_SHIFT_TAB));
  const previous = action === 'deliver' ? null : currentRecord(records, session, body);
  const data = fields ?? previous;
  requireValue(hasIdentityUnit(session, data.unit), 403, 'Unidad fuera de tu alcance.');
  const id = `TPA-${sha([data.unit, data.date, canonical(data.shift)]).slice(0, 20).toUpperCase()}`;

  if (!previous) {
    requireValue(!records.has(id), 409, 'Ya existe un parte para esta unidad, fecha y turno.');
    const inventory = await sheets.read('01 Inventario', { cached: true });
    requireValue(inventory.slice(3).some(row => String(row[1] ?? '').trim().toUpperCase() === data.unit), 400, 'La unidad no figura en el inventario TMF.');
  } else {
    requireValue(Number.isSafeInteger(body.version) && body.version === previous.version, 409, 'El parte cambió. Actualiza para revisar la última versión.');
    if (deliver) {
      requireValue(previous.createdBy.id === session.userId, 403, 'La corrección corresponde a quien entregó el parte.');
      requireValue(previous.status === RETURNED && id === previous.id, 409, 'Solo se puede corregir un parte devuelto de la misma unidad, fecha y turno.');
    } else {
      requireValue(previous.createdBy.id !== session.userId, 403, 'La revisión corresponde a otro supervisor.');
      requireValue(previous.status === PENDING, 409, 'El parte ya tiene una decisión para esta versión.');
    }
  }

  const version = (previous?.version ?? 0) + 1;
  const status = deliver ? PENDING : action === 'accept' ? ACCEPTED : RETURNED;
  const author = previous?.createdBy ?? { id: session.userId, name: session.userName };
  const at = new Date().toISOString();
  const row = [id, data.unit, data.date, data.shift, version, status, data.initialHours, data.finalHours, data.hours,
    data.equipmentStatus, data.support, data.trips, data.tonnes, data.stops, data.client, author.id, author.name,
    session.userId, session.userName, at, action, comment];
  const [record] = rowsToRecords([row]).values();
  if (previous) {
    record.createdAt = previous.createdAt;
    record.history = [...previous.history, ...record.history];
  }
  const saved = await sheets.commit({ key, fingerprint, guard: `panama:shift:${id}:${version}`,
    writes: [{ tab: PANAMA_SHIFT_TAB, append: [row] }], result: { record } });
  return { status: action === 'deliver' ? 201 : 200, body: saved.result };
}
