import { createHash } from 'node:crypto';
import { STICKER_INSPECTION_TEMPLATES, stickerTemplateForEquipment } from '../../src/data/sticker-inspection-templates.js';
import { activeFailureUnits, buildDispatchReadinessMap } from '../../src/lib/dispatch-readiness.js';
import { PANAMA_PROJECT, readPrintablePanamaPm } from './hermes-panama.js';
import { workshopExceptionRecords } from './hermes-panama-exceptions.js';
import { panamaWorkshopDate, panamaWorkshopFailureOrder, reconcilePanamaWorkshop } from './hermes-panama-workshop.js';
import { HermesSheetError, PANAMA_READINESS_TAB } from './hermes-google-sheets.js';
import { isEvidenceError, verifyEvidence } from './hermes-evidence.js';
import { evaluatePmTriggers, pmLevelKey } from './hermes-pm-triggers.js';
import { nextPmAtAcceptance } from './hermes-panama-pm-next-service.js';
import { buildPanamaDowntime, downtimeInstant, downtimeShiftStarts, downtimeWindow, isReportedStop } from './hermes-panama-downtime.js';
import { COMPONENT_INTERVENTION, canonicalComponent, componentActions, componentCatalog, componentHourTicks,
  componentInterventionHistory, componentPositionKey, overlappingPositions } from './hermes-panama-components.js';

import { WARRANTY_EVENT, WARRANTY_TAB, warrantyCases, warrantyEvents, warrantyReaders, warrantyWriters } from './hermes-panama-warranties.js';

const TAB = {
  inventory: '01 Inventario', orders: 'ORDENES_TRABAJO', history: 'OT_STATUS_LOG', failures: 'Averias',
  inspections: '14 Inspecciones', pm: 'Ordenes Mantenimiento', pmHistory: '05 Historial PM', schedule: 'WORKSHOP_SCHEDULE',
  stickers: 'Inspeccion_Stickers', findings: 'Inspeccion_Hallazgos',
};
const ORDER_READ = new Set(['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const ASSIGN = new Set(['jefe_taller', 'coordinador', 'gerencia']);
const CLOSE = new Set(['jefe_taller', 'supervisor', 'gerencia']);
const OPERATIONS = new Set(['supervisor']);
const MANAGEMENT = new Set([...ASSIGN, 'supervisor']);
const SUPERVISE = new Set(['supervisor', 'gerencia']);
const INSPECT = new Set(['operador', 'supervisor', 'gerencia']);
const ROLES = new Set([...ORDER_READ, 'operador']);
const STATUSES = {
  Abierta: ['En Reparación', 'Esperando Pieza'],
  'En Espera de Asignación': ['En Reparación', 'Esperando Pieza'],
  'En Reparación': ['Esperando Pieza', 'Resuelta'],
  'Esperando Pieza': ['En Reparación', 'Resuelta'],
  Resuelta: ['En Reparación', 'Completado'],
  Completado: [],
};
const FIELD_COLUMNS = {
  estado: 9, mecanico_asignado: 8, prioridad: 7, observaciones: 15, progreso: 16, costo_estimado: 13, foto_url: 10,
};
const WORKFLOW = { execution: 20, technical: 21, operations: 22, pm: 23, recurrence: 24 };
const PRIORITIES = new Set(['CRITICA', 'ALTA', 'MEDIA', 'BAJA']);
const SCHEDULABLE = new Set(['Abierta', 'En Espera de Asignación', 'En Reparación', 'Esperando Pieza']);
const WORKSHOP_DAY_HOURS = 8;
const MAX_PM_BATCH = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DVIR_LABELS = ['Motor', 'Transmisión', 'Frenos', 'Dirección', 'Hidráulico', 'Eléctrico', 'Neumáticos', 'Estructura', 'Luces', 'Fluidos', 'Cabina', 'Tren de rodaje'];
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Panama', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

class WorkshopError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function assert(condition, status, message) {
  if (!condition) throw new WorkshopError(status, message);
}

function text(value, name, max, required = false) {
  assert(typeof value === 'string' || (!required && value == null), 400, `${name} inválido`);
  const clean = (value ?? '').trim();
  assert(clean.length <= max && (!required || clean.length > 0), 400, `${name} inválido`);
  return clean;
}

function decimal(value, name, min, max) {
  const raw = typeof value === 'number' ? String(value) : text(value, name, 24, true);
  assert(/^\d+(?:\.\d+)?$/.test(raw), 400, `${name} inválido`);
  const n = Number(raw);
  assert(Number.isFinite(n) && n >= min && n <= max, 400, `${name} inválido`);
  return n;
}

function isoDate(value) {
  const input = text(value, 'Fecha', 10, true);
  const d = new Date(`${input}T00:00:00Z`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(input) && Number.isFinite(+d) && d.toISOString().slice(0, 10) === input, 400, 'Fecha inválida');
  return input;
}

function localTime(value) {
  const input = text(value, 'Hora', 8, true);
  assert(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input), 400, 'Hora inválida');
  return input.length === 5 ? `${input}:00` : input;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value, (_key, node) => (
    node && typeof node === 'object' && !Array.isArray(node)
      ? Object.fromEntries(Object.entries(node).sort(([a], [b]) => a.localeCompare(b)))
      : node
  ))).digest('hex');
}

function scopeAllows(actor, unit) {
  return actor.allUnits === true || actor.assignedUnits?.some((assigned) => assigned.trim().toUpperCase() === unit);
}

function unitCode(value) {
  const clean = text(value, 'Unidad', 40, true).toUpperCase();
  assert(/^[A-Z0-9][A-Z0-9 _-]*$/.test(clean), 400, 'Unidad inválida');
  return clean;
}

function requireUnit(session, value) {
  const code = unitCode(value);
  assert(scopeAllows(session, code), 403, 'Unidad fuera de tu alcance');
  return code;
}

function inventoryEquipment(rows, code) {
  const row = rows.find((r) => (r[1] || '').trim().toUpperCase() === code);
  assert(row, 404, 'Unidad no encontrada en el inventario');
  return { code, model: [row[3], row[4]].filter(Boolean).join(' '), serial: row[6]?.trim() || '', type: row[2] || '', meter: row[9] || '' };
}

async function equipmentFor({ sheets, session }, value) {
  const code = requireUnit(session, value);
  return inventoryEquipment(await sheets.read(TAB.inventory), code);
}

async function reportFleet({ sheets, session }) {
  if (session.project === PANAMA_PROJECT && sheets.readReportFleet) return sheets.readReportFleet();
  const rows = await sheets.read(TAB.inventory, { cached: true });
  const units = rows.slice(3).filter(row => row[1]?.trim()).map(row => ({
    code: row[1].trim().toUpperCase(), model: [row[3]?.trim(), row[4]?.trim()].filter(Boolean).join(' '),
  }));
  return { units, capturedAt: null };
}

function orderVisible(session, row) {
  const unit = row[3]?.trim().toUpperCase();
  return Boolean(unit && /^OT-/.test(row[1] || '') && scopeAllows(session, unit)
    && (session.role !== 'mecanico' || row[17] === session.userId));
}

async function attachmentUrls(context, input, kind, unit, bucket, recordId) {
  if (isPanama(context)) {
    return verifyEvidence(input, { kind, units: [unit], operationId: context.mutationId, recordId,
      session: context.session, storage: context.evidenceStorage });
  }
  const urls = input ?? [];
  assert(Array.isArray(urls) && urls.length <= 40, 400, 'Evidencia inválida');
  if (!urls.length) return [];
  let allowedOrigin;
  try {
    const configured = context.storageOrigin || process.env.HERMES_WORKSHOP_STORAGE_ORIGIN || process.env.VITE_SUPABASE_URL;
    allowedOrigin = new URL(configured).origin;
  } catch {
    throw new WorkshopError(503, 'Almacenamiento de evidencia no configurado');
  }
  return urls.map((value) => {
    const clean = text(value, 'Evidencia', 1200, true);
    let url;
    try { url = new URL(clean); } catch { throw new WorkshopError(400, 'Evidencia inválida'); }
    assert(url.origin === allowedOrigin && url.protocol === 'https:' && !url.username && !url.password
      && url.pathname.startsWith(`/storage/v1/object/public/${bucket}/`), 400, 'Evidencia inválida');
    return clean;
  });
}

function historyRow(context, otId, field, before, after) {
  return [context.now, otId, field, before, after, context.session.userName, context.session.role, context.session.userId];
}

function orderRow(context, data) {
  const { id, unit, type, description, priority, photos = [], reference = '', parts = '', notes = '', mechanic } = data;
  return [context.mutationId, id, context.date, unit, type, description, priority, priority, mechanic?.userName || '', 'Abierta',
    photos.join(', '), reference, parts, '', '', notes, '0', mechanic?.userId || '', nextOrderVersion(context), context.session.userId];
}

function failureWrites(context, data) {
  const { id, unit, type, description, priority, photos, downtime = '', notes = '', stop } = data;
  return [
    { tab: TAB.failures, append: [[context.date, context.time, unit, type, description, priority, context.session.userName,
      downtime, '', 'Abierta', '', notes, '', id, (photos || []).join(', '), context.session.userId, ...(stop ? [JSON.stringify(stop)] : [])]] },
    { tab: TAB.orders, append: [orderRow(context, { ...data, reference: id })] },
    { tab: TAB.history, append: [historyRow(context, id, 'estado', '', 'Abierta')] },
  ];
}

export async function readUnitReadinessRevision(sheets, unit) {
  const rows = await sheets.read(PANAMA_READINESS_TAB);
  return rows.findLast(row => row[0] === unit)?.[1] || 'initial';
}

export function unitReadinessChange(unit, revision, key, at) {
  return {
    guard: `panama:readiness:${unit}:${revision}`,
    write: { tab: PANAMA_READINESS_TAB, append: [[unit, digest(key), at]] },
  };
}

async function commit(context, writes, result, guard, readiness, extraGuard) {
  const guards = [readiness?.guard, extraGuard].filter(Boolean);
  if (readiness) writes.push(readiness.write);
  const saved = await context.sheets.commit({ key: context.key, fingerprint: context.fingerprint, guard, guards, writes, result });
  return { status: saved.replayed ? 200 : context.create ? 201 : 200, body: { ...saved.result, replayed: saved.replayed } };
}

async function report(context) {
  const { body, session, sheets } = context;
  const code = requireUnit(session, body.unit);
  if (isPanama(context) && sheets.readReportFleet) {
    const { units } = await reportFleet(context);
    assert(units.some(unit => unit.code === code), 404, 'Unidad no encontrada en el inventario');
  } else inventoryEquipment(await sheets.read(TAB.inventory), code);
  const type = text(body.type, 'Tipo de falla', 60, true);
  const description = text(body.description, 'Descripción', 3000, true);
  const customer = text(body.customer, 'Cliente', 120);
  const location = text(body.location, 'Ubicación', 180);
  const downtime = text(body.downtime, 'Tiempo de paro', 40);
  assert(typeof body.canMove === 'boolean', 400, 'Indica si la unidad puede moverse');
  let stop;
  if (isPanama(context)) {
    const stopped = body.stopped ?? !body.canMove;
    assert(typeof stopped === 'boolean' && (body.canMove || stopped), 400, 'Confirma si la falla detuvo la operación');
    assert(stopped || !(body.stopStartedAt || body.stopReportedAt), 400, 'La hora de inicio requiere una parada confirmada');
    if (stopped) {
      const now = Date.parse(context.now);
      if (body.stopStartedAt) {
        const start = downtimeInstant(body.stopStartedAt);
        assert(Number.isFinite(start) && start <= now, 400, 'La hora de inicio de la parada no es válida');
        stop = { stopped, startedAt: new Date(start).toISOString(), source: 'operator' };
      } else if (body.stopReportedAt) {
        const captured = downtimeInstant(body.stopReportedAt);
        stop = Number.isFinite(captured) && captured <= now
          ? { stopped, startedAt: new Date(captured).toISOString(), source: 'capture' }
          : { stopped, startedAt: null, source: 'pending' };
      } else stop = { stopped, startedAt: context.now, source: 'report' };
    } else stop = { stopped };
  }
  const photos = await attachmentUrls(context, body.photos, 'report', code, 'falla-photos');
  const clientAffected = !['', 'n/a', 'ninguno', '--', 'na', 'none'].includes(customer.toLowerCase());
  const priority = body.canMove ? 'MEDIA' : clientAffected ? 'CRITICA' : 'ALTA';
  const notes = `Ubicación: ${location}. Cliente: ${customer}. Puede moverse: ${body.canMove ? 'Sí' : 'No'}`;
  const previousReference = isPanama(context) ? text(body.previousOtId, 'OT anterior', 90).toUpperCase() : '';
  let previousOtId = '';
  if (previousReference) {
    const previous = (await context.sheets.read(TAB.orders)).filter(row => row[3]?.trim().toUpperCase() === code
      && /^OT-/i.test(row[1] ?? '') && (row[1].toUpperCase() === previousReference || row[25] === previousReference));
    assert(previous.length === 1, 400, 'OT anterior no disponible para esta unidad');
    assert(previous[0][9] === 'Completado' && normalizeModel(previous[0][4]) === normalizeModel(type), 400,
      'Selecciona una OT cerrada de la misma unidad y tipo de falla');
    previousOtId = previous[0][1];
  }
  const writes = failureWrites(context, { id: context.otId, unit: code, type, description, priority, photos, downtime, notes, stop });
  const result = { otId: context.otId };
  if (previousOtId) {
    const [row] = writes[1].append;
    while (row.length < WORKFLOW.recurrence) row.push('');
    row[WORKFLOW.recurrence] = previousOtId;
    writes[2].append.push(historyRow(context, context.otId, 'reincidencia', '', previousOtId));
    result.previousOtId = previousOtId;
  }
  return commitRestriction(context, code, writes, result);
}

async function commitRestriction(context, unit, writes, result) {
  if (!isPanama(context)) return commit(context, writes, result);
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await readUnitReadinessRevision(context.sheets, unit);
    try {
      return await commit(context, [...writes], result, undefined, unitReadinessChange(unit, revision, context.key, context.now));
    } catch (error) {
      if (error.status !== 409 || attempt === 2 || await readUnitReadinessRevision(context.sheets, unit) === revision) throw error;
    }
  }
}

async function dvir(context) {
  const { body, session } = context;
  const { code, model } = await equipmentFor(context, body.unit);
  const date = isoDate(body.date).split('-').reverse().join('/');
  const time = localTime(body.time);
  assert(['pre-operacion', 'post-operacion'].includes(body.type), 400, 'Tipo de inspección inválido');
  const meter = body.meter === '' || body.meter == null ? '' : String(decimal(body.meter, 'Horómetro', 0, 9999999));
  assert(Array.isArray(body.checks) && body.checks.length === DVIR_LABELS.length, 400, 'Completa los sistemas de la inspección');
  const checks = body.checks.map((check, i) => {
    assert(['ok', 'alerta', 'falla'].includes(check?.status), 400, 'Completa los sistemas de la inspección');
    const note = text(check.notes, 'Nota de inspección', 500);
    return { status: check.status, detail: check.status === 'ok' ? '' : `${DVIR_LABELS[i]} (${check.status})${note ? `: ${note}` : ''}` };
  });
  const observations = [text(body.observations, 'Observaciones', 2500), ...checks.map((c) => c.detail)].filter(Boolean).join('\n');
  const score = `${checks.filter((c) => c.status === 'ok').length}/${checks.length}`;
  const result = checks.some((c) => c.status === 'falla') ? 'reprobado' : checks.some((c) => c.status === 'alerta') ? 'condicional' : 'aprobado';
  const photos = await attachmentUrls(context, body.photos, 'dvir', code, 'dvir-photos');
  const otId = result === 'reprobado' ? context.otId : null;
  const inspectionId = `INS-${context.otId.slice(3)}`;
  const writes = [{ tab: TAB.inspections, append: [[context.mutationId, inspectionId, date, time, code, model, session.userName,
    body.type, meter, ...checks.map((c) => c.status), score, result, observations, photos.join(', '), otId || '', otId ? 'Pendiente' : '', session.userName, session.userId]] }];
  if (otId) writes.push(...failureWrites(context, {
    id: otId, unit: code, type: 'DVIR', description: observations || 'Inspección DVIR reprobada', priority: 'ALTA', photos, notes: inspectionId,
  }), { tab: TAB.history, append: [historyRow(context, otId, 'inspeccion_origen', '', inspectionId)] });
  return commitRestriction(context, code, writes, { inspectionId, otId, result, score });
}

export function orderVersion(row) {
  return row[18] || digest(row);
}

export function orderWriteGuard(row) {
  return `workshop-order:${row[1]}:${orderVersion(row)}`;
}

const nextOrderVersion = ({ sheets, key, mutationId }) => sheets.nativeOperations ? digest(key) : mutationId;

function storedObject(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

function historyTime(value = '', panama = false) {
  const sheet = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{2}:\d{2}(?::\d{2})?))?$/.exec(value);
  const local = sheet
    ? `${sheet[3]}-${sheet[2].padStart(2, '0')}-${sheet[1].padStart(2, '0')}T${sheet[4] || '00:00:00'}`
    : value.replace(' ', 'T');
  const zone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local) ? (panama ? '-05:00' : '-06:00') : '';
  return Date.parse(`${local}${zone}`) || 0;
}

async function getOrder(context, value) {
  const otId = text(value, 'Folio de OT', 90, true);
  const { sheets } = context;
  const [rows, logs] = await Promise.all([sheets.read(TAB.orders), sheets.nativeOperations ? [] : sheets.read(TAB.history)]);
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => row[1] === otId);
  assert(matches.length <= 1, 409, 'Hay más de una fila para ese folio. Revisa la orden.');
  const found = matches[0];
  assert(found, 404, 'OT no encontrada');
  assert(orderVisible(context.session, found.row), 403, 'OT fuera de tu alcance');
  const effective = [...found.row];
  for (const log of logs.filter((row) => row[1] === otId).sort((a, b) => historyTime(a[0], isPanama(context)) - historyTime(b[0], isPanama(context)))) {
    if (Object.hasOwn(FIELD_COLUMNS, log[2])) effective[FIELD_COLUMNS[log[2]]] = log[4];
  }
  const version = orderVersion(found.row);
  if (sheets.nativeOperations && context.body?.expectedVersion != null) {
    assert(context.body.expectedVersion === version, 409, 'La orden cambió. Actualiza antes de guardar.');
  }
  return { otId, ...found, effective };
}

async function mechanicsFor(context) {
  assert(typeof context.listMechanics === 'function', 503, 'Padrón de mecánicos no configurado');
  return (await context.listMechanics(context.session)).filter((actor) => (
    (!actor.role || actor.role === 'mecanico') && actor.userId && actor.userName
  ));
}

async function mechanicFor(context, value, unit) {
  const id = text(value, 'Mecánico', 120);
  if (!id) return null;
  const mechanic = (await mechanicsFor(context)).find((actor) => actor.userId === id);
  assert(mechanic && scopeAllows(mechanic, unit), 400, 'Selecciona un mecánico autorizado para esta unidad');
  return mechanic;
}

function linkedRows(rows, idCol, unitCol, otId, unit) {
  const matches = rows.flatMap((row, index) => row[idCol] === otId ? [{ row, index }] : []);
  assert(matches.length <= 1 && matches.every(({ row }) => row[unitCol]?.trim().toUpperCase() === unit), 409,
    'El folio tiene vínculos duplicados o de otra unidad');
  return matches[0];
}

const normalizeModel = value => value?.trim().replace(/\s+/g, ' ').toUpperCase();
const normalizeLevel = value => value?.trim().replace(/[- ]/g, '').toUpperCase();
const todayInPanama = context => dateFormatter.format(new Date(context.now));
const isPanama = context => context.session.project === PANAMA_PROJECT;
const canReviewHse = session => SUPERVISE.has(session.role) && (session.project !== PANAMA_PROJECT || session.canReviewPanamaHse === true);

function configuredChecklist(context, model, level, serial) {
  if (!model || !level) return null;
  let catalog;
  try { catalog = context.pmChecklists ?? JSON.parse(process.env.HERMES_PANAMA_PM_CHECKLISTS_JSON || '[]'); }
  catch { throw new WorkshopError(503, 'El catálogo de checklists PM requiere revisión'); }
  assert(Array.isArray(catalog), 503, 'El catálogo de checklists PM requiere revisión');
  const candidates = catalog.filter(item => typeof item?.model === 'string' && typeof item.level === 'string'
    && normalizeModel(item.model) === normalizeModel(model) && normalizeLevel(item.level) === normalizeLevel(level));
  assert(candidates.every(item => item.serial == null || (typeof item.serial === 'string' && item.serial.trim())),
    503, 'El catálogo de checklists PM requiere revisión');
  if (!serial && candidates.some(item => item.serial)) return null;
  const exact = serial ? candidates.filter(item => item.serial && normalizeModel(item.serial) === normalizeModel(serial)) : [];
  const matches = exact.length ? exact : candidates.filter(item => !item.serial);
  if (!matches.length) return null;
  const [{ reference, tasks }] = matches;
  assert(matches.length === 1 && typeof reference === 'string' && reference.trim() && reference.length <= 500
    && Array.isArray(tasks) && tasks.length > 0 && tasks.length <= 80
    && tasks.every(task => typeof task?.id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(task.id)
      && typeof task.label === 'string' && task.label.trim() && task.label.length <= 250
      && (task.evidence === undefined || task.evidence === 'photo'))
    && tasks.filter(task => task.evidence === 'photo').length <= 40
    && new Set(tasks.map(task => task.id)).size === tasks.length, 503, 'El checklist de este modelo y nivel requiere revisión');
  return { reference: reference.trim(), tasks: tasks.map(({ id, label, evidence }) => ({ id, label: label.trim(), ...(evidence && { evidence }) })) };
}

async function pmDefinition(context, order) {
  assert(order.row[4] === 'PM', 409, 'La orden no corresponde a un PM');
  const saved = storedObject(order.row[WORKFLOW.pm]);
  if (saved?.checklist) return saved;
  const unit = order.row[3].trim().toUpperCase();
  const serial = saved?.serial ?? (await equipmentFor(context, unit)).serial;
  if (saved) return { ...saved, checklist: configuredChecklist(context, saved.model, saved.level, serial) };
  const linked = linkedRows(await context.sheets.read(TAB.pm), 0, 2, order.otId, unit);
  assert(linked, 409, 'La orden no tiene una fila PM vinculada');
  const [, , , model, level, , initialMeter] = linked.row;
  return { model, level, initialMeter, ...(serial && { serial }), checklist: configuredChecklist(context, model, level, serial) };
}

async function executionFor(context, order) {
  const { body, session } = context;
  assert(order.row[17] === session.userId, 403, 'La entrega corresponde al ejecutor asignado');
  const functionalTest = text(body.execution?.functionalTest, 'Resultado de la prueba funcional', 1500, true);
  const diagnosis = text(body.execution?.diagnosis, 'Causa confirmada', 1500);
  const reportedHours = body.execution?.laborHours;
  const laborHours = reportedHours == null ? null : decimal(reportedHours, 'Horas de trabajo', 0.01, 9999);
  const execution = { userId: session.userId, userName: session.userName, submittedAt: context.now, functionalTest,
    ...(diagnosis && { diagnosis }),
    ...(laborHours !== null && { laborHours }) };
  if (order.row[4] !== 'PM') return { execution };
  const pm = await pmDefinition(context, order);
  assert(pm.checklist, 409, 'Falta un checklist validado para el modelo y nivel de PM');
  const performedOn = isoDate(body.execution?.performedOn);
  assert(performedOn <= todayInPanama(context), 400, 'La fecha de ejecución no puede ser futura');
  const meter = decimal(body.execution?.meter, 'Horómetro de ejecución', 0, 9999999);
  const initialMeter = String(pm.initialMeter ?? '').trim();
  assert(!/^\d+(?:\.\d+)?$/.test(initialMeter) || meter >= Number(initialMeter), 400, 'El horómetro es menor que la lectura de programación');
  const completed = body.execution?.completedItems;
  assert(Array.isArray(completed) && completed.length === pm.checklist.tasks.length
    && pm.checklist.tasks.every(task => completed.includes(task.id)), 400, 'Completa todas las tareas del checklist del modelo');
  const proof = body.execution?.taskEvidence ?? {};
  const required = pm.checklist.tasks.filter(task => task.evidence === 'photo');
  assert(proof && typeof proof === 'object' && !Array.isArray(proof) && Object.keys(proof).length === required.length
    && required.every(task => Object.hasOwn(proof, task.id)), 400, 'Adjunta una foto para cada paso que requiere evidencia');
  const photos = await attachmentUrls(context, required.map(task => proof[task.id]), 'order', order.row[3].trim().toUpperCase(), 'falla-photos', order.otId);
  return { execution: { ...execution, performedOn, meter: String(meter), completedItems: completed,
    ...(photos.length && { taskEvidence: Object.fromEntries(required.map((task, index) => [task.id, photos[index]])) }) }, pm, photos };
}

async function pmAcceptanceWrites(context, order, execution) {
  const unit = order.row[3].trim().toUpperCase();
  const definitions = [[TAB.pm, 0, 2, 11, 14], [TAB.pmHistory, 1, 2, 10, 13], [TAB.schedule, 2, 3, 7]];
  const targets = await Promise.all(definitions.map(async ([tab, idCol, unitCol, statusCol, evidenceCol]) => {
    const linked = linkedRows(await context.sheets.read(tab), idCol, unitCol, order.otId, unit);
    assert(linked, 409, 'Falta una fila vinculada de la orden, el historial o el calendario PM');
    return { tab, statusCol, evidenceCol, row: linked.index };
  }));
  const pm = await pmDefinition(context, order);
  const nextService = await nextPmAtAcceptance(context.readPmSources, unit, pm.level, execution.meter);
  const details = [execution.performedOn, context.session.userId, context.session.userName, context.now, pm.checklist.reference, JSON.stringify(nextService)];
  const writes = targets.flatMap(({ tab, statusCol, evidenceCol, row }) => {
    const isSchedule = tab === TAB.schedule;
    const writes = [{ tab, row, col: statusCol, values: [isSchedule ? 'Completado' : 'Completada'] }];
    if (!isSchedule) writes.push({ tab, row, col: 6, values: [execution.meter] }, { tab, row, col: evidenceCol, values: details });
    return writes;
  });
  writes.push({ tab: TAB.orders, row: order.index, col: WORKFLOW.pm, values: [JSON.stringify({ ...pm, nextService })] });
  return writes;
}

async function transition(context) {
  const { body, session, sheets } = context;
  const order = await getOrder(context, body.otId);
  const { otId, row, index, effective } = order;
  const field = text(body.field, 'Campo', 30, true);
  assert(Object.hasOwn(FIELD_COLUMNS, field), 400, 'Campo de OT inválido');
  const mechanic = session.role === 'mecanico';
  const mayEdit = field === 'mecanico_asignado' || field === 'costo_estimado' || field === 'prioridad'
    ? ASSIGN.has(session.role)
    : MANAGEMENT.has(session.role) || mechanic;
  assert(mayEdit, 403, 'Tu rol no puede cambiar este campo');
  assert(effective[9] !== 'Completado', 409, 'La orden está cerrada');
  const col = FIELD_COLUMNS[field];
  const before = effective[col] || '';
  let value = field === 'foto_url' ? '' : text(body.value, 'Valor', 3000);
  const writes = [];
  let scheduleGuard;
  const unit = row[3].trim().toUpperCase();
  const readiness = field === 'estado' && isPanama(context)
    ? unitReadinessChange(unit, await readUnitReadinessRevision(sheets, unit), context.key, context.now)
    : undefined;

  if (field === 'estado') {
    if (value === 'Completado') assert(CLOSE.has(session.role), 403, 'Tu rol no puede cerrar una OT');
    assert(value === before || STATUSES[before || 'Abierta']?.includes(value), 409, 'Transición de estado inválida');
    const linked = row[4] === 'PM' ? null : linkedRows(await sheets.read(TAB.failures), 13, 2, otId, unit);
    if (linked) writes.push({ tab: TAB.failures, row: linked.index, col: 9, values: [value] });
    if (isPanama(context) && value === 'Resuelta' && before !== value) {
      const submitted = await executionFor(context, order);
      writes.push({ tab: TAB.orders, row: index, col: WORKFLOW.execution, values: [JSON.stringify(submitted.execution)] },
        { tab: TAB.history, append: [historyRow(context, otId, 'entrega_tecnica', '', submitted.execution.laborHours == null
          ? submitted.execution.functionalTest : `${submitted.execution.functionalTest} · ${submitted.execution.laborHours} h de trabajo`)] });
      if (submitted.pm) writes.push({ tab: TAB.orders, row: index, col: WORKFLOW.pm, values: [JSON.stringify(submitted.pm)] });
      if (submitted.photos?.length) {
        const combined = [...new Set([...(row[10] || '').split(/,\s*/).filter(Boolean), ...submitted.photos])].join(', ');
        assert(combined.length <= 48000, 409, 'La orden alcanzó el límite de evidencia');
        writes.push({ tab: TAB.orders, row: index, col: 10, values: [combined] },
          { tab: TAB.history, append: [historyRow(context, otId, 'foto_url', row[10] || '', combined)] });
      }
    }
    if (isPanama(context) && before === 'Resuelta' && value === 'En Reparación') {
      writes.push({ tab: TAB.orders, row: index, col: WORKFLOW.execution, values: ['', ''] });
    }
    if (value === 'Completado') {
      writes.push({ tab: TAB.orders, row: index, col: 14, values: [context.now] });
      if (isPanama(context)) {
        const execution = storedObject(row[WORKFLOW.execution]);
        assert(execution?.userId && execution.functionalTest, 409, 'Devuelve la orden a reparación para documentar la prueba funcional');
        assert(session.userId !== execution.userId && session.userId !== row[17], 403, 'La aceptación técnica requiere un verificador independiente');
        const technical = { userId: session.userId, userName: session.userName, acceptedAt: context.now };
        writes.push({ tab: TAB.orders, row: index, col: WORKFLOW.technical, values: [JSON.stringify(technical)] },
          { tab: TAB.history, append: [historyRow(context, otId, 'aceptacion_tecnica', '', execution.functionalTest)] });
        if (row[4] === 'PM') writes.push(...await pmAcceptanceWrites(context, order, execution));
      }
      if (row[4] === 'DVIR') {
        const inspections = await sheets.read(TAB.inspections);
        for (const [rowIndex, inspection] of inspections.entries()) {
          if (inspection[25] === otId && inspection[4] === row[3]) writes.push({ tab: TAB.inspections, row: rowIndex, col: 26, values: ['Resuelta'] });
        }
      }
    }
  }
  if (field === 'mecanico_asignado') {
    const assignee = await mechanicFor(context, value, unit);
    writes.push({ tab: TAB.orders, row: index, col: 17, values: [assignee?.userId || ''] });
    value = assignee?.userName || '';
    if (isPanama(context)) {
      const schedule = await sheets.read(TAB.schedule);
      const scheduled = linkedRows(schedule, 2, 3, otId, unit);
      if (scheduled) {
        const { row: event } = scheduled;
        const hours = Number(event[5]);
        if (assignee && assignee.userId !== event[9] && hours > 0) {
          const assessment = await scheduleAssessment(context, schedule, { otId, unit,
            mechanic: assignee, hours, date: event[1], resources: {} });
          const capacity = assessment.warnings.find(item => item.code === 'capacity');
          assert(!capacity, 409, `${capacity?.message ?? ''} Confirma la reasignación desde Calendario de Taller.`);
        }
        scheduleGuard = calendarWriteGuard(schedule);
        writes.push(
          { tab: TAB.schedule, row: scheduled.index, col: 4, values: [value || 'Sin asignar'] },
          { tab: TAB.schedule, row: scheduled.index, col: 9, values: [assignee?.userId || ''] },
          { tab: TAB.schedule, row: scheduled.index, col: 14, values: [digest(context.key)] },
        );
      }
    }
  }
  if (field === 'prioridad') assert(PRIORITIES.has(value), 400, 'Prioridad inválida');
  if (field === 'progreso') value = String(decimal(value, 'Progreso', 0, 100));
  if (field === 'costo_estimado') value = decimal(value, 'Costo estimado', 0, 1e9).toFixed(2);
  if (field === 'foto_url') {
    const photos = await attachmentUrls(context, body.value, 'order', unit, 'falla-photos', otId);
    assert(photos.length > 0, 400, 'Adjunta una evidencia');
    value = [...new Set([...before.split(', ').filter(Boolean), ...photos])].join(', ');
    assert(value.length <= 48000, 409, 'La orden alcanzó el límite de evidencia');
  }

  writes.push(
    { tab: TAB.orders, row: index, col, values: [value] },
    { tab: TAB.orders, row: index, col: 18, values: [nextOrderVersion(context)] },
    { tab: TAB.history, append: [historyRow(context, otId, field, before, value)] },
  );
  return commit(context, writes, { otId }, orderWriteGuard(row), readiness, scheduleGuard);
}

const calendarWriteGuard = rows => `panama:schedule:${digest(rows)}`;

function scheduleValue(context, { otId, unit, mechanic, hours, date, priority, notes, resources }) {
  return [context.mutationId, date, otId, unit, mechanic?.userName || 'Sin asignar', String(hours), priority, 'Programado', notes,
    mechanic?.userId || '', context.session.userId, ...(resources ? [resources.shift, resources.partsStatus, resources.partsDetail] : [])];
}

function scheduleRowsForOrder(rows, otId) {
  const matching = rows.flatMap((row, index) => row[2] === otId ? [index] : []);
  assert(matching.length <= 1, 409, 'Hay más de una programación para esta OT');
  return matching[0] ?? -1;
}

function scheduleResources(input, previous = []) {
  const shift = text(input.shift ?? previous[11], 'Turno', 20);
  const partsStatus = text(input.partsStatus ?? previous[12], 'Disponibilidad de repuestos', 24);
  const partsDetail = text(input.partsDetail ?? previous[13], 'Repuestos', 500);
  assert(['', 'Día', 'Noche'].includes(shift), 400, 'Turno inválido');
  assert(['', 'confirmed', 'pending', 'unknown', 'not_required'].includes(partsStatus), 400, 'Disponibilidad de repuestos inválida');
  return { shift, partsStatus, partsDetail };
}

async function scheduleAssessment(context, rows, { otId, unit, mechanic, hours, date, resources }, orders) {
  const warnings = [];
  let plannedHours = null;
  if (mechanic?.userId) {
    const active = rows.filter(row => row[2] !== otId && /^OT-/.test(row[2] || '') && row[1] === date && row[7] !== 'Completado'
      && (row[9] ? row[9] === mechanic.userId : row[4] === mechanic.userName));
    const closed = active.length
      ? new Set((orders ?? await context.sheets.read(TAB.orders)).filter(row => row[9] === 'Completado').map(row => row[1]))
      : new Set();
    plannedHours = active.filter(row => !closed.has(row[2])).reduce((sum, row) => {
      const hours = Number(row[5]);
      return sum + (Number.isFinite(hours) && hours > 0 ? hours : 0);
    }, hours);
    if (plannedHours > WORKSHOP_DAY_HOURS) warnings.push({ code: 'capacity', message: `Sobrecarga de Taller: ${plannedHours} h para el mecánico el ${date} (referencia: ${WORKSHOP_DAY_HOURS} h por día).` });
  }
  if (['pending', 'unknown'].includes(resources.partsStatus)) warnings.push({
    code: 'parts',
    message: resources.partsStatus === 'pending' ? 'Hay repuestos pendientes para esta orden.' : 'La disponibilidad de repuestos está por confirmar.',
  });
  return { warnings, plannedHours, confirmation: warnings.length ? digest({
    actor: context.session.userId, otId, unit, mechanicId: mechanic?.userId, hours, date, resources, plannedHours, warnings,
  }) : null };
}

function requireScheduleConfirmation(assessment, confirmation) {
  assert(!assessment.confirmation || assessment.confirmation === confirmation, 409,
    `${assessment.warnings.map(item => item.message).join(' ')} Revisa la carga y vuelve a confirmar.`);
}

async function scheduleCheck(context) {
  const input = context.query ?? {};
  const order = input.otId ? await getOrder(context, input.otId) : null;
  if (order) assert(SCHEDULABLE.has(order.effective[9]), 409, 'La OT no está disponible para programar');
  const unit = order ? order.row[3].trim().toUpperCase() : (await equipmentFor(context, input.unit)).code;
  const date = isoDate(input.date);
  const hours = decimal(input.hours, 'Horas estimadas', 0.25, order ? 24 : 240);
  const mechanic = !Object.hasOwn(input, 'mechanicId') && order?.effective[8]
    ? { userId: order.effective[17], userName: order.effective[8] } : await mechanicFor(context, input.mechanicId, unit);
  const rows = await context.sheets.read(TAB.schedule);
  const previous = order ? rows[scheduleRowsForOrder(rows, order.otId)] : undefined;
  const resources = scheduleResources(input, previous);
  return scheduleAssessment(context, rows, { otId: order?.otId, unit, mechanic, date, hours, resources });
}

function pmOrders(rows, unit, level) {
  return rows.filter(row => /^OT-/.test(row[1] || '') && row[3]?.trim().toUpperCase() === unit && row[4] === 'PM'
    && pmLevelKey(storedObject(row[WORKFLOW.pm])?.level ?? /^Mantenimiento Preventivo (PM[ -]?\d{1,5})\b/i.exec(row[5] ?? '')?.[1]) === level);
}

function openPm(orders) {
  return orders.findLast(row => !['Completado', 'Cancelado', 'Cancelada'].includes(row[9]));
}

function pmOccurrence(unit, level, orders, rules) {
  const current = openPm(orders);
  const completed = orders.filter(row => row[9] === 'Completado');
  const hoursRule = rules.find(rule => rule.kind === 'hours');
  const officialDue = hoursRule?.actual != null && hoursRule.threshold != null ? hoursRule.threshold : null;
  const consumed = new Map();
  for (const row of completed) {
    const reasons = storedObject(row[WORKFLOW.pm])?.triggers;
    if (Array.isArray(reasons)) reasons.forEach(reason => consumed.set(reason.occurrence, row));
  }
  const due = rules.filter(rule => rule.state === 'due');
  const triggerReasons = due.filter(rule => !consumed.has(rule.occurrence));
  const sameDue = officialDue === null ? null : completed.findLast(row => storedObject(row[WORKFLOW.pm])?.dueAt === officialDue);
  return {
    existing: current || sameDue || (due.length && !triggerReasons.length ? consumed.get(due.at(-1).occurrence) : null),
    guard: `panama:pm:${digest([unit, level, orders.at(-1)?.[1] ?? 'initial'])}`,
    triggerReasons,
  };
}

async function existingPm(context, row) {
  const otId = row[1];
  const schedule = linkedRows(await context.sheets.read(TAB.schedule), 2, 3, otId, row[3].trim().toUpperCase())?.row;
  return { status: 200, body: { otId, schedule, existing: true, completed: row[9] === 'Completado' } };
}

function pmWrites(context, { unit, model, level, included, meter, notes, date, hours, mechanic, resources, parts, definition }) {
  const { otId, session } = context;
  const priority = 'MEDIA';
  const description = `Mantenimiento Preventivo ${level}. Incluye: ${included}`;
  const schedule = scheduleValue(context, { otId, unit, mechanic, hours, date, priority, notes, resources });
  const common = [unit, model, level, included, meter];
  const order = orderRow(context, { id: otId, unit, type: 'PM', description, priority, parts, notes, mechanic });
  if (definition) order.push('', '', '', JSON.stringify(definition));
  return { schedule, writes: [
    { tab: TAB.pm, append: [[otId, context.date, ...common, description, String(hours), mechanic?.userName || 'Sin asignar', session.userName, 'Programada', parts, notes]] },
    { tab: TAB.pmHistory, append: [[context.date, otId, ...common, String(hours), mechanic?.userName || 'Sin asignar', session.userName, 'Programada', parts, notes]] },
    { tab: TAB.orders, append: [order] },
    { tab: TAB.history, append: [historyRow(context, otId, 'estado', '', 'Abierta')] },
    { tab: TAB.schedule, append: [schedule] },
  ] };
}

async function pm(context) {
  const { body } = context;
  const { code, model, serial, meter } = await equipmentFor(context, body.unit);
  const level = text(body.level, 'Nivel PM', 25, true);
  assert(/^PM[ -]?\d{1,5}$/i.test(level), 400, 'Nivel PM inválido');
  const included = text(body.includedLevels, 'Niveles incluidos', 180, true);
  const notes = text(body.notes, 'Observaciones', 2000);
  const date = isoDate(body.scheduledDate);
  const hours = decimal(body.hours, 'Horas estimadas', 0.25, 240);
  let triggerReasons = [];
  let pmGuard;
  let officialHours;
  if (isPanama(context)) {
    const normalized = pmLevelKey(level);
    const orders = pmOrders(await context.sheets.read(TAB.orders), code, normalized);
    const open = openPm(orders);
    if (open) return existingPm(context, open);
    const { rules } = await evaluatePmTriggers(context, code, normalized);
    const occurrence = pmOccurrence(code, normalized, orders, rules);
    if (occurrence.existing) return existingPm(context, occurrence.existing);
    ({ guard: pmGuard, triggerReasons } = occurrence);
    officialHours = rules.find(rule => rule.kind === 'hours' && rule.actual != null && rule.threshold != null);
  }
  const mechanic = await mechanicFor(context, body.mechanicId, code);
  const otId = context.otId;
  const resources = isPanama(context) ? scheduleResources(body) : null;
  const calendar = resources ? await context.sheets.read(TAB.schedule) : null;
  if (calendar) requireScheduleConfirmation(await scheduleAssessment(context, calendar,
    { unit: code, mechanic, hours, date, resources }), body.scheduleConfirmation);
  const parts = text(body.parts, 'Partes', 5000) || resources?.partsDetail || '';
  const definition = isPanama(context) ? { model, level, initialMeter: meter, ...(serial && { serial }),
    ...(officialHours && { dueAt: officialHours.threshold, ...(officialHours.cut && { sourceCut: officialHours.cut }) }),
    checklist: configuredChecklist(context, model, level, serial), ...(triggerReasons.length && { triggers: triggerReasons }) } : null;
  const { schedule, writes } = pmWrites(context, { unit: code, model, level, included, meter, notes, date, hours, mechanic, resources, parts, definition });
  try {
    return await commit(context, writes, { otId, schedule, ...(definition && { checklist: definition.checklist }) },
      pmGuard, undefined, calendar ? calendarWriteGuard(calendar) : undefined);
  } catch (error) {
    if (pmGuard && Number(error?.status ?? error?.statusCode) === 409) {
      const competing = openPm(pmOrders(await context.sheets.read(TAB.orders), code, pmLevelKey(level)));
      if (competing) return existingPm(context, competing);
    }
    throw error;
  }
}

function batchUnits(session, value) {
  assert(Array.isArray(value) && value.length >= 2 && value.length <= MAX_PM_BATCH, 400, 'Selecciona entre 2 y 25 equipos');
  const units = value.map(item => requireUnit(session, item?.unit));
  assert(new Set(units).size === units.length, 400, 'Cada equipo puede aparecer una sola vez en el lote');
  return units;
}

async function preparePmBatch(context) {
  const { body, session, sheets } = context;
  const units = batchUnits(session, body.items);
  const date = isoDate(body.scheduledDate);
  const resources = scheduleResources(body);
  assert(resources.shift && resources.partsStatus, 400, 'Indica el turno y el estado de los repuestos');
  const mechanic = await mechanicFor(context, body.mechanicId, units[0]);
  assert(!mechanic || units.every(unit => scopeAllows(mechanic, unit)), 400, 'El mecánico debe cubrir todos los equipos del lote');
  const [inventory, [orders, schedule], sources] = await Promise.all([
    sheets.read(TAB.inventory),
    sheets.readMany?.([TAB.orders, TAB.schedule]) ?? Promise.all([sheets.read(TAB.orders), sheets.read(TAB.schedule)]),
    context.readPmSources?.(),
  ]);
  assert(Array.isArray(sources?.sections?.maintenance) && Array.isArray(sources?.sections?.maintenancePlan),
    503, 'La fuente oficial de PM FLOTA no está disponible');
  const sourceContext = { ...context, readPmSources: async () => sources };
  const prepared = await Promise.all(units.map(async (unit, index) => {
    const hours = decimal(body.items[index].hours, `Horas estimadas de ${unit}`, 0.25, 240);
    const { model, serial } = inventoryEquipment(inventory, unit);
    const [official] = sources.sections.maintenance.filter(row => unit === row.unit?.trim().toUpperCase());
    const level = pmLevelKey(official?.next);
    assert(level, 409, `${unit}: falta un nivel vigente en PM FLOTA`);
    const { rules } = await evaluatePmTriggers(sourceContext, unit, level);
    const { actual, threshold, cut } = rules[0];
    assert(actual !== null && threshold !== null, 409, `${unit}: falta un vencimiento con horómetro y plan aprobados`);
    const checklist = configuredChecklist(context, model, level, serial);
    assert(checklist, 409, `${unit}: falta un checklist validado para ${model} ${level}`);
    const matching = pmOrders(orders, unit, level);
    const { existing, triggerReasons, guard } = pmOccurrence(unit, level, matching, rules);
    assert(!existing, 409, `${unit}: ya existe una orden para este servicio (${existing?.[25] || existing?.[1]})`);
    const latestAccepted = orders.reduce((latest, row) => {
      if (row[3]?.trim().toUpperCase() !== unit || row[4] !== 'PM' || row[9] !== 'Completado'
        || !storedObject(row[WORKFLOW.technical])?.acceptedAt) return latest;
      const savedMeter = storedObject(row[WORKFLOW.execution])?.meter;
      return /^\d+(?:\.\d+)?$/.test(savedMeter ?? '') ? Math.max(latest, Number(savedMeter)) : latest;
    }, -1);
    const masterLast = /\ba\s+([\d,.]+)\s*h/i.exec(official.last ?? '')?.[1];
    assert(latestAccepted < 0 || (!!masterLast && Number(masterLast.replaceAll(',', '')) >= latestAccepted
      && !/POR CONFIRMAR/i.test(official.last)), 409, `${unit}: hay un cierre PM por conciliar con el maestro`);
    const definition = { model, level, initialMeter: String(actual), ...(serial && { serial }), checklist,
      dueAt: threshold, ...(cut && { sourceCut: cut }), ...(triggerReasons.length && { triggers: triggerReasons }) };
    return { unit, hours, definition, guard };
  }));
  const totalHours = prepared.reduce((sum, item) => sum + item.hours, 0);
  const { warnings, plannedHours } = await scheduleAssessment(context, schedule, {
    unit: units.join(','), mechanic, hours: totalHours, date, resources,
  }, orders);
  const confirmation = digest({ user: session.userId, date, resources, mechanicId: mechanic?.userId, planCut: sources.snapshots?.maintenancePlan,
    plannedHours, warnings, prepared });
  const items = prepared.map(({ unit, hours, definition }) => ({
    unit, hours, level: definition.level, dueAt: definition.dueAt, checklistReference: definition.checklist.reference,
  }));
  return { items, warnings, confirmation, prepared, date, resources, mechanic,
    scheduleGuard: calendarWriteGuard(schedule), sourceCut: sources.snapshots?.maintenance };
}

async function pmBatchFolios(context, result) {
  if (!context.sheets.nativeOperations) return result;
  const aliases = new Map((await context.sheets.read(TAB.orders)).map(row => [row[1], row[25]]));
  const orders = result.orders.map(order => {
    const folio = aliases.get(order.otId);
    assert(/^OT-\d{4,15}$/.test(folio ?? ''), 503, 'No se pudo confirmar el folio. Reintenta el mismo lote.');
    return { ...order, folio };
  });
  return { ...result, orders };
}

async function pmBatch(context) {
  let batch;
  try {
    batch = await preparePmBatch(context);
    assert(context.body.confirmation === batch.confirmation, 409, 'Cambió la programación o el corte de PM. Revisa el lote de nuevo.');
  } catch (error) {
    // A concurrent retry may have observed its own newly committed orders during preflight.
    const prior = await context.sheets.replay({ key: context.key, fingerprint: context.fingerprint });
    if (prior) return { status: 200, body: { ...await pmBatchFolios(context, prior), replayed: true } };
    throw error;
  }
  const { date, resources, mechanic, prepared, items, scheduleGuard } = batch;
  const orders = [];
  const writesByTab = new Map();
  for (const [index, { unit, hours, definition }] of prepared.entries()) {
    const key = `${context.key}:${unit}`;
    const otId = `OT-${digest(key).slice(0, 16).toUpperCase()}`;
    const { writes } = pmWrites({ ...context, key, otId }, { unit, model: definition.model, level: definition.level,
      included: definition.level, meter: definition.initialMeter, notes: '', date, hours, mechanic, resources,
      parts: resources.partsDetail, definition });
    orders.push({ ...items[index], otId });
    for (const { tab, append } of writes) {
      if (!writesByTab.has(tab)) writesByTab.set(tab, []);
      writesByTab.get(tab).push(...append);
    }
  }
  const result = await context.sheets.commit({ key: context.key, fingerprint: context.fingerprint,
    guards: [scheduleGuard, ...prepared.map(item => item.guard)], writes: [...writesByTab].map(([tab, append]) => ({ tab, append })),
    result: { orders, date } });
  return { status: result.replayed ? 200 : 201,
    body: { ...await pmBatchFolios(context, result.result), replayed: result.replayed } };
}

async function schedule(context) {
  const { body, sheets } = context;
  const { otId, row, index, effective } = await getOrder(context, body.otId);
  assert(SCHEDULABLE.has(effective[9]), 409, 'La OT no está disponible para programar');
  const unit = row[3].trim().toUpperCase();
  const changeAssignee = Object.hasOwn(body, 'mechanicId');
  const mechanic = changeAssignee
    ? await mechanicFor(context, body.mechanicId, unit)
    : effective[8] ? { userId: effective[17], userName: effective[8] } : null;
  const date = isoDate(body.date);
  const hours = decimal(body.hours, 'Horas estimadas', 0.25, 24);
  const notes = text(body.notes, 'Notas', 1000);
  const rows = await sheets.read(TAB.schedule);
  const previous = scheduleRowsForOrder(rows, otId);
  const resources = isPanama(context) ? scheduleResources(body, rows[previous]) : null;
  if (resources) requireScheduleConfirmation(await scheduleAssessment(context, rows,
    { otId, unit, mechanic, hours, date, resources }), body.scheduleConfirmation);
  const result = scheduleValue(context, { otId, unit, mechanic, hours, date, priority: effective[7] || 'MEDIA', notes, resources });
  const writes = [
    previous >= 0 ? { tab: TAB.schedule, row: previous, values: result } : { tab: TAB.schedule, append: [result] },
    { tab: TAB.orders, row: index, col: 18, values: [nextOrderVersion(context)] },
    { tab: TAB.history, append: [historyRow(context, otId, 'programacion', previous >= 0 ? rows[previous][1] : '',
      `${date} · ${hours} h · ${mechanic?.userName || 'Sin asignar'}`)] },
  ];
  if (changeAssignee) writes.push(
    { tab: TAB.orders, row: index, col: 8, values: [mechanic?.userName || ''] },
    { tab: TAB.orders, row: index, col: 17, values: [mechanic?.userId || ''] },
    { tab: TAB.history, append: [historyRow(context, otId, 'mecanico_asignado', effective[8] || '', mechanic?.userName || '')] },
  );
  return commit(context, writes, { schedule: result }, orderWriteGuard(row), undefined,
    resources ? calendarWriteGuard(rows) : undefined);
}

function pendingOperationalReturn(row) {
  return row[4] !== 'PM' && row[9] === 'Completado' && storedObject(row[WORKFLOW.operations])?.decision !== 'accepted';
}

function pendingReturnsFor(rows, session, details = false) {
  return rows.filter(row => /^OT-/.test(row[1] || '') && row[3] && scopeAllows(session, row[3].trim().toUpperCase())
    && pendingOperationalReturn(row)).map(row => {
    const entry = { otId: row[1], unit: row[3] };
    if (!details) return entry;
    const technical = storedObject(row[WORKFLOW.technical]);
    return { ...entry, technicalAt: technical?.acceptedAt || row[14] || '', technicalBy: technical?.userName || '' };
  });
}

async function returnQueue({ session, sheets }, details = false) {
  return pendingReturnsFor(await sheets.read(TAB.orders, { cached: true, requireExisting: true }), session, details);
}

async function operationalReturn(context) {
  const { body, session, sheets } = context;
  const { row, effective, index, otId } = await getOrder(context, body.otId);
  assert(pendingOperationalReturn(effective), 409, 'La OT no tiene una entrega pendiente de Operaciones');
  const execution = storedObject(row[WORKFLOW.execution]);
  const technical = storedObject(row[WORKFLOW.technical]);
  assert(session.userId !== execution?.userId && session.userId !== technical?.userId && session.userId !== row[17], 403,
    'La recepción de Operaciones debe quedar a cargo de otro responsable');
  const { decision } = body;
  assert(['accepted', 'returned'].includes(decision), 400, 'Selecciona la decisión de Operaciones');
  const notes = text(body.notes, 'Observación de Operaciones', 1500, true);
  const receipt = { decision, notes, userId: session.userId, userName: session.userName, recordedAt: context.now };
  const writes = [];
  const unit = row[3].trim().toUpperCase();
  const revision = await readUnitReadinessRevision(sheets, unit);
  const readiness = unitReadinessChange(unit, revision, context.key, context.now);
  if (decision === 'accepted') {
    assert(technical?.userId && execution?.userId, 409, 'Devuelve la OT para documentar una verificación técnica independiente');
    const safety = await verifyUnitReadiness(sheets, unit, { acceptReturnFor: otId });
    assert(safety?.level !== 'blocked', 409, `Retorno bloqueado. ${safety?.reason || ''}`);
    const returnedAt = body.returnedAt == null ? context.now : text(body.returnedAt, 'Fecha y hora de retorno', 24, true);
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(returnedAt)
      && Date.parse(returnedAt) >= Date.parse(technical.acceptedAt) && Date.parse(returnedAt) <= Date.parse(context.now), 400,
    'La hora de retorno debe estar entre el cierre técnico y la hora actual');
    receipt.returnedAt = returnedAt;
  } else {
    const dueDate = isoDate(body.dueDate);
    assert(dueDate >= todayInPanama(context), 400, 'La fecha correctiva no puede ser anterior a hoy');
    receipt.dueDate = dueDate;
    const linked = linkedRows(await sheets.read(TAB.failures), 13, 2, otId, unit);
    if (linked) writes.push({ tab: TAB.failures, row: linked.index, col: 9, values: ['En Reparación'] });
    if (row[4] === 'DVIR') {
      const inspection = linkedRows(await sheets.read(TAB.inspections), 25, 4, otId, unit);
      if (inspection) writes.push({ tab: TAB.inspections, row: inspection.index, col: 26, values: ['Pendiente'] });
    }
    writes.push({ tab: TAB.orders, row: index, col: 9, values: ['En Reparación'] },
      { tab: TAB.orders, row: index, col: 14, values: [''] },
      { tab: TAB.orders, row: index, col: WORKFLOW.execution, values: ['', ''] },
      { tab: TAB.history, append: [historyRow(context, otId, 'estado', 'Completado', 'En Reparación')] });
  }
  const history = decision === 'accepted' ? `Recibida · ${receipt.returnedAt} · ${notes}` : `Devuelta a Taller · ${receipt.dueDate} · ${notes}`;
  writes.push({ tab: TAB.orders, row: index, col: WORKFLOW.operations, values: [JSON.stringify(receipt)] },
    { tab: TAB.orders, row: index, col: 18, values: [nextOrderVersion(context)] },
    { tab: TAB.history, append: [historyRow(context, otId, 'retorno_operativo', '', history)] });
  return commit(context, writes, { otId, receipt }, orderWriteGuard(row), readiness);
}

const STICKER_COLORS = ['green', 'yellow', 'red'];
const STICKER_STATUSES = ['cumple', 'condicionado', 'no_cumple', 'no_aplica'];
const PENDING_STICKER = 'pendiente_supervisor';
const APPROVED_STICKER = 'aprobado_supervisor';
const fmtSheetDate = (value) => value.split('-').reverse().join('/');

function stickerPayload(row) {
  let details;
  try { details = JSON.parse(row[17] || '{}'); } catch { details = {}; }
  return {
    folio: row[1], color: row[12], unitId: row[5], company: details.company || '',
    inspectionDate: row[3], expiryDate: row[14], inspector: row[8], supervisor: row[9],
    qrText: `hermes://inspection/${row[1]}`, findingsSummary: row[15], approvalState: row[10], canDispatch: row[13] === 'yes',
    photos: (row[16] || '').split(', ').filter(Boolean),
    findings: Array.isArray(details.findings) ? details.findings : [],
  };
}

async function sticker(context) {
  const { body, session } = context;
  const { code, model, type } = await equipmentFor(context, body.unit);
  const template = STICKER_INSPECTION_TEMPLATES.find((item) => item.id === body.templateId);
  const expected = stickerTemplateForEquipment(type, isPanama(context) ? model : '');
  assert(template && (!expected || expected === template.id), 400, 'La lista de inspección debe corresponder al equipo');
  const company = text(body.company, 'Empresa', 100, true);
  const date = isoDate(body.date);
  const time = localTime(body.time);
  const expiry = new Date(`${date}T00:00:00Z`);
  expiry.setUTCDate(expiry.getUTCDate() + 15);
  const approved = body.approve === true;
  assert(!approved || !isPanama(context), 403, 'La inspección requiere revisión de otra persona autorizada de HSE');
  const today = dateFormatter.format(new Date(context.now));
  assert(date <= today, 400, 'La inspección no puede tener una fecha futura');
  if (approved) {
    assert(expiry.toISOString().slice(0, 10) >= today, 409, 'La inspección está vencida');
  }
  assert(Array.isArray(body.checks) && body.checks.length === template.items.length, 400, 'Completa la lista de inspección');
  const checkByItem = new Map(body.checks.map((check) => [check?.itemId, check]));
  const photos = await attachmentUrls(context, body.photos, 'sticker', code, 'sticker-inspection-photos');
  const findings = [];
  for (const item of template.items) {
    const check = checkByItem.get(item.id);
    assert(STICKER_STATUSES.includes(check?.status), 400, 'Completa la lista de inspección');
    assert(!item.hardStop || check.status !== 'no_aplica', 400, 'Los puntos críticos requieren una comprobación');
    if (check.status !== 'no_cumple' && check.status !== 'condicionado') continue;
    const comment = text(check.comment, 'Comentario del hallazgo', 500, true);
    const evidence = check.photos;
    assert(Array.isArray(evidence) && evidence.length > 0 && evidence.length <= photos.length
      && evidence.every((url) => photos.includes(url)), 400, 'Adjunta la evidencia de cada hallazgo');
    assert(typeof check.canOperate === 'boolean', 400, 'Indica si el hallazgo permite operar');
    const dueDate = check.status === 'condicionado' ? isoDate(check.dueDate) : '';
    assert(!dueDate || dueDate >= date, 400, 'La fecha compromiso precede a la inspección');
    const hardStop = item.hardStop === true || check.status === 'no_cumple' || !check.canOperate;
    findings.push({ itemId: item.id, section: item.section, label: item.label, status: check.status, comment,
      dueDate, canOperate: !hardStop, hardStop, photos: evidence });
  }
  const recommended = findings.some((item) => item.hardStop) ? 'red' : findings.length ? 'yellow' : 'green';
  const final = body.finalColor;
  assert(STICKER_COLORS.indexOf(final) >= STICKER_COLORS.indexOf(recommended), 400, 'El color final debe mantener el nivel de bloqueo');
  const reason = text(body.overrideReason, 'Justificación', 500, final !== recommended);
  const expiredFinding = findings.some((item) => item.dueDate && item.dueDate < today);
  assert(!approved || !expiredFinding || final === 'red', 409, 'Hay una fecha compromiso vencida');

  const folio = `${template.folioPrefix}-${context.otId.slice(3)}`;
  const expiryDate = fmtSheetDate(expiry.toISOString().slice(0, 10));
  const approvalState = approved ? APPROVED_STICKER : PENDING_STICKER;
  const findingsSummary = findings.slice(0, 4).map((finding) => `${finding.section} · ${finding.comment}`).join(' | ');
  const payload = JSON.stringify({ version: 2, company, sourceFiles: [template.sourceFile],
    decision: { recommendedColor: recommended, finalColor: final, overrideReason: reason },
    checklist: body.checks.map(({ itemId, status }) => ({ itemId, status })), findings });
  const photoString = [...new Set(photos)].join(', ');
  assert(payload.length <= 48000 && photoString.length <= 48000, 400, 'La inspección excede el límite de evidencia');
  const row = [context.mutationId, folio, context.now, fmtSheetDate(date), time, code, model, template.label,
    session.userName, approved ? session.userName : '', approvalState, recommended, final,
    approved && final !== 'red' ? 'yes' : 'no', expiryDate, findingsSummary, photoString, payload, session.userId,
    approved ? session.userId : '', approved ? context.now : ''];
  const findingRows = findings.map((finding) => [
    context.mutationId, folio, context.now, code, model, template.label, finding.section, finding.itemId, finding.label,
    finding.status, finding.comment, finding.dueDate, finding.canOperate ? 'yes' : 'no', finding.hardStop ? 'critical' : 'medium',
    approvalState, expiryDate, session.userId,
  ]);
  const writes = [{ tab: TAB.stickers, append: [row] }];
  if (findingRows.length) writes.push({ tab: TAB.findings, append: findingRows });
  return commitRestriction(context, code, writes, stickerPayload(row));
}

async function stickerReview(context) {
  const { body, session, sheets } = context;
  const folio = text(body.folio, 'Folio', 100, true);
  const [stickers, findings] = await Promise.all([sheets.read(TAB.stickers), sheets.read(TAB.findings)]);
  const matches = stickers.map((row, index) => ({ row, index })).filter(({ row }) => row[1] === folio);
  assert(matches.length === 1, matches.length ? 409 : 404, 'Inspección no disponible para aprobar');
  const { row, index } = matches[0];
  const unit = requireUnit(session, row[5]);
  const readiness = isPanama(context)
    ? unitReadinessChange(unit, await readUnitReadinessRevision(sheets, unit), context.key, context.now)
    : undefined;
  assert(row[10] === PENDING_STICKER, 409, 'La inspección ya fue revisada');
  assert(row[18] && row[17] && STICKER_COLORS.includes(row[12]), 409, 'La inspección requiere validar su origen');
  assert(!isPanama(context) || row[18] !== session.userId, 403, 'La inspección requiere revisión de otra persona autorizada de HSE');
  const today = dateFormatter.format(new Date(context.now));
  assert(isoDate(row[14].split('/').reverse().join('-')) >= today, 409, 'La inspección está vencida');
  const resolved = [...row];
  const result = stickerPayload(row);
  const expiredFinding = result.findings.some((finding) => finding.dueDate && finding.dueDate < today);
  assert(!expiredFinding || row[12] === 'red', 409, 'Hay una fecha compromiso vencida');
  resolved[9] = session.userName;
  resolved[10] = APPROVED_STICKER;
  resolved[13] = row[12] === 'red' ? 'no' : 'yes';
  resolved[19] = session.userId;
  resolved[20] = context.now;
  const writes = [{ tab: TAB.stickers, row: index, values: resolved }];
  for (const [rowIndex, finding] of findings.entries()) {
    if (finding[1] === folio && finding[3] === row[5]) {
      writes.push({ tab: TAB.findings, row: rowIndex, col: 14, values: [APPROVED_STICKER] });
    }
  }
  return commit(context, writes, stickerPayload(resolved), `workshop-sticker:${folio}:${PENDING_STICKER}`, readiness);
}


/**
 * HSE action history is stored in column R (index 17) of Inspeccion_Hallazgos.
 * Columns A–Q keep their original source fields unchanged. A verified action is
 * NOT a dispatch release: the original inspection/sticker remains authoritative
 * until a new approved inspection changes readiness.
 */
function hseActionState(row) {
  const raw = row[17];
  if (!raw) return { version: 1, status: 'sin_asignar', history: [] };
  const parsed = storedObject(raw);
  if (!parsed || !Array.isArray(parsed.history) || !['sin_asignar','asignada','evidencia','devuelta','verificada'].includes(parsed.status)) {
    return { version: 1, status: 'por_conciliar', history: [], invalid: true };
  }
  return parsed;
}

function hseFindingRecord(row, sticker) {
  const state = hseActionState(row);
  const originalPhotos = sticker ? stickerPayload(sticker).findings
    .find(entry => entry.itemId === row[7])?.photos ?? [] : [];
  return {
    folio: row[1], unit: row[3], inspectedAt: row[2], itemId: row[7], item: row[8],
    section: row[6], status: row[9], comment: row[10], dueDate: state.dueDate || row[11] || '',
    canOperate: row[12] === 'yes', severity: row[13], approvalState: row[14], inspectionExpires: row[15],
    inspectorId: row[16], photos: originalPhotos, corrective: {
      state: state.status, responsible: state.responsible ?? '', assignedBy: state.assignedBy ?? '',
      submittedBy: state.submittedBy ?? '', verifiedBy: state.verifiedBy ?? '',
      at: state.at ?? '', note: state.note ?? '', evidence: state.evidence ?? [],
      linkedOt: state.linkedOt ?? '',
      history: state.history ?? [],
    },
  };
}

async function hseFindings(context) {
  const { query, session, sheets } = context;
  assert(isPanama(context) && canReviewHse(session), 403, 'Consulta reservada a HSE Panamá.');
  const requested = query?.unit ? requireUnit(session, query.unit) : '';
  const [rows, stickerRows] = await Promise.all([
    sheets.read(TAB.findings, { requireExisting: true }),
    sheets.read(TAB.stickers, { requireExisting: true }),
  ]);
  const stickers = new Map();
  for (const row of stickerRows) {
    if (!row[1] || !row[5]) continue;
    const key = row[5].trim().toUpperCase() + ':' + row[1];
    stickers.set(key, stickers.has(key) ? null : row);
  }
  const scoped = rows.filter(row => row[1] && row[7] && row[3] && scopeAllows(session, row[3].trim().toUpperCase())
    && (!requested || row[3].trim().toUpperCase() === requested));
  const findings = scoped.map(row => hseFindingRecord(row, stickers.get(row[3].trim().toUpperCase() + ':' + row[1])));
  findings.sort((a, b) => String(b.inspectedAt).localeCompare(String(a.inspectedAt)) || a.folio.localeCompare(b.folio));
  return { status: 200, body: { findings: findings.slice(0, 200), more: findings.length > 200,
    source: 'Inspeccion_Hallazgos', dispatchClearance: false } };
}

async function hseAction(context) {
  const { body, session, sheets } = context;
  assert(isPanama(context) && canReviewHse(session), 403, 'Esta acción requiere autorización HSE.');
  const unit = requireUnit(session, body.unit);
  const folio = text(body.folio, 'Folio de inspección', 100, true);
  const itemId = text(body.itemId, 'Punto de inspección', 100, true);
  const action = text(body.action, 'Acción correctiva', 20, true);
  assert(['assign','submit','verify','return'].includes(action), 400, 'Acción correctiva inválida.');
  const rows = await sheets.read(TAB.findings, { requireExisting: true });
  const matches = rows.map((row, index) => ({ row, index }))
    .filter(({ row }) => row[1] === folio && row[3]?.trim().toUpperCase() === unit && row[7] === itemId);
  assert(matches.length === 1, matches.length ? 409 : 404, 'Hallazgo no disponible o duplicado.');
  const { row, index } = matches[0];
  const state = hseActionState(row);
  assert(!state.invalid, 409, 'La acción correctiva heredada requiere conciliación.');
  assert(state.history.length < 120, 409, 'Historial de acciones requiere cierre de archivo.');
  const next = { ...state, history: [...state.history] };
  const note = text(body.note, 'Observación', 1000, action === 'submit' || action === 'verify' || action === 'return');
  const event = { action, by: session.userName, actorId: session.userId, at: context.now, note,
    operationId: context.mutationId };
  if (action === 'assign') {
    assert(['sin_asignar','asignada','devuelta'].includes(state.status), 409,
      'La acción ya tiene evidencia o verificación; revisa el historial.');
    next.responsible = text(body.responsible, 'Responsable indicado', 120, true);
    const reference = text(body.linkedOt, 'OT vinculada', 90);
    if (reference) {
      const { row: linked, otId } = await getOrder(context, reference);
      assert(linked[3]?.trim().toUpperCase() === unit, 400, 'La OT corresponde a otra unidad.');
      next.linkedOt = otId;
    }
    next.dueDate = isoDate(body.dueDate);
    assert(next.dueDate >= todayInPanama(context), 400, 'Indica un compromiso vigente.');
    next.assignedBy = session.userName;
    next.status = 'asignada';
    event.responsible = next.responsible;
    if (next.linkedOt) event.linkedOt = next.linkedOt;
    event.dueDate = next.dueDate;
  } else if (action === 'submit') {
    assert(['asignada', 'devuelta'].includes(state.status), 409, 'Primero asigna la corrección.');
    const evidence = await attachmentUrls(context, body.photos, 'hseaction', unit, '');
    assert(evidence.length > 0 && evidence.length <= 8, 400, 'Adjunta evidencia fotográfica verificable.');
    next.status = 'evidencia';
    next.submittedBy = session.userName;
    next.submittedById = session.userId;
    next.evidence = evidence;
    next.note = note;
    event.evidence = evidence;
  } else {
    assert(state.status === 'evidencia', 409, 'No hay evidencia nueva pendiente de revisión.');
    assert(session.userId !== state.submittedById && session.userId !== row[16], 403,
      'La verificación requiere otra persona distinta de quien envió evidencia y capturó la inspección.');
    if (action === 'verify') {
      next.status = 'verificada';
      next.verifiedBy = session.userName;
      next.verifiedById = session.userId;
      next.verifiedAt = context.now;
    } else {
      next.status = 'devuelta';
      next.verifiedBy = '';
      next.verifiedById = '';
      next.verifiedAt = '';
    }
  }
  next.at = context.now;
  next.history.push(event);
  const encoded = JSON.stringify(next);
  assert(encoded.length <= 46000, 409, 'El historial requiere archivo y conciliación.');
  const guard = `hse-action:${unit}:${folio}:${itemId}:${digest(row[17] || 'initial')}`;
  const saved = await commit(context, [{ tab: TAB.findings, row: index, col: 17, values: [encoded] }],
    { folio, unit, itemId, state: next.status, updatedAt: context.now }, guard);
  return saved;
}

const READINESS_SOURCES = [
  ['failures', TAB.failures, 2, [0, 2, 9]],
  ['stickers', TAB.stickers, 5, [1, 2, 3, 4, 5, 10, 12, 13, 14, 17]],
  ['inspections', TAB.inspections, 4, [2, 3, 4, 22, 23, 26]],
];

function readinessRows(rows, name, unitColumn, selected, allows) {
  return rows.filter(row => {
    const unit = row[unitColumn]?.trim().toUpperCase();
    return unit && allows(unit);
  }).map(row => {
    const cells = Array(selected.at(-1) + 1).fill('');
    for (const col of selected) cells[col] = row[col] || '';
    if (name === 'stickers') {
      const payload = storedObject(cells[17]);
      cells[17] = Array.isArray(payload?.findings) ? payload.findings.map(finding => finding?.dueDate).filter(Boolean).sort()[0] || '' : '';
    }
    return cells;
  });
}

export async function verifyUnitsReadiness(sheets, units, { acceptReturnFor } = {}) {
  if (!units.size) return new Map();
  const [failureRows, stickerRows, inspectionRows, orders, masters] = await Promise.all([
    ...READINESS_SOURCES.map(async ([, tab]) => sheets.read(tab, { requireExisting: true })),
    Promise.resolve().then(() => sheets.read(TAB.orders, { requireExisting: true })),
    Promise.resolve().then(() => sheets.readWorkshopMasters?.()).catch(() => null),
  ]);
  const [failures, stickers, inspections] = [failureRows, stickerRows, inspectionRows].map((rows, index) => {
    const [name, , unitColumn, selected] = READINESS_SOURCES[index];
    return readinessRows(rows, name, unitColumn, selected, unit => units.has(unit));
  });
  const scoped = orders.filter(row => /^OT-/.test(row[1] || '') && units.has(row[3]?.trim().toUpperCase()));
  // Independently acknowledge technically closed orders. Dispatch still checks all pending returns.
  const pendingReturns = acceptReturnFor ? [] : scoped.filter(pendingOperationalReturn).map(row => ({ unit: row[3], otId: row[1] }));
  const map = buildDispatchReadinessMap(stickers, inspections,
    new Date(`${dateFormatter.format(new Date())}T12:00:00`), pendingReturns, failures);
  for (const row of scoped) {
    const unit = row[3].trim().toUpperCase();
    if (map.get(unit)?.level === 'blocked' || row[1] === acceptReturnFor || row[9] === 'Completado') continue;
    if (row[4] === 'PM' && !['En Reparación', 'Resuelta', 'Esperando Pieza'].includes(row[9])) continue;
    map.set(unit, { level: 'blocked', reason: `OT ${row[1]} sin cierre` });
  }
  if (sheets.readWorkshopMasters) {
    const { masterRestrictions } = reconcilePanamaWorkshop(masters, failureRows, orders, unit => units.has(unit));
    for (const restriction of masterRestrictions) map.set(restriction.unitId, restriction);
    if (!masters?.failures || !masters?.orders) {
      for (const unit of units) {
        if (map.get(unit)?.level === 'blocked') continue;
        map.set(unit, { level: 'blocked', reason: 'Maestro de Taller sin verificar.' });
      }
    }
  }
  return map;
}

export async function verifyUnitReadiness(sheets, unit, options) {
  return (await verifyUnitsReadiness(sheets, new Set([unit]), options)).get(unit);
}

async function readinessSources(context) {
  const { session, sheets } = context;
  const readMasters = isPanama(context) && sheets.readWorkshopMasters;
  const readOperating = readMasters && sheets.nativeOperations && MANAGEMENT.has(session.role);
  const [failures, stickers, inspections, orders, masters, confirmed] = await Promise.allSettled([
    ...READINESS_SOURCES.map(async ([, tab]) => sheets.read(tab, { cached: true, requireExisting: true })),
    Promise.resolve().then(() => isPanama(context) ? sheets.read(TAB.orders, { cached: true, requireExisting: true }) : []),
    Promise.resolve().then(() => readMasters ? sheets.readWorkshopMasters({ preferPublished: MANAGEMENT.has(session.role) }) : null),
    Promise.resolve().then(() => readOperating ? sheets.read('HERMES_PA_CONFIRMACION_OPERATIVA') : null),
  ]);
  const response = { unavailable: [] };
  const results = [failures, stickers, inspections];
  for (const [index, [name, , unitColumn, selected]] of READINESS_SOURCES.entries()) {
    const result = results[index];
    if (result.status !== 'fulfilled') response.unavailable.push(name);
    response[name] = readinessRows(result.status === 'fulfilled' ? result.value : [], name, unitColumn, selected, unit => scopeAllows(session, unit));
  }
  if (orders.status !== 'fulfilled') response.unavailable.push('returns');
  response.returns = orders.status === 'fulfilled' ? pendingReturnsFor(orders.value, session) : [];
  if (readMasters) {
    const official = masters.status === 'fulfilled' ? masters.value : null;
    const { workshop, masterRestrictions } = reconcilePanamaWorkshop(official,
      failures.status === 'fulfilled' ? failures.value : null,
      orders.status === 'fulfilled' ? orders.value : null,
      unit => scopeAllows(session, unit), context.now ?? new Date());
    if (!workshop.failures.masterAvailable || !workshop.orders.masterAvailable) response.unavailable.push('workshopMaster');
    response.masterRestrictions = masterRestrictions;
    if (MANAGEMENT.has(session.role)) response.workshop = workshop;
    if (confirmed.status === 'fulfilled' && confirmed.value?.[0]?.[0] === 'UNIDAD'
        && official?.failures && failures.status === 'fulfilled' && orders.status === 'fulfilled') {
      const running = new Set(confirmed.value.slice(1).filter(row => row[1] === 'operativo').map(row => row[0]));
      for (const row of orders.value) {
        if (row[9] === 'Completado' && storedObject(row[WORKFLOW.operations])?.decision === 'accepted') running.add(row[3]);
      }
      const stopped = activeFailureUnits(failures.value.filter(isReportedStop));
      for (const record of official.failures.records) {
        if (/^(detenido reportado|en reparaci[oó]n|esperando pieza)$/i.test(record.status.trim())) stopped.add(record.unit.toUpperCase());
      }
      const observed = context.now ?? new Date();
      const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama',
        year: 'numeric', month: '2-digit', day: '2-digit' }).format(observed);
      const enforced = buildDispatchReadinessMap(response.stickers, response.inspections,
        new Date(`${localDay}T12:00:00`), response.returns);
      for (const [unit, restriction] of enforced) {
        if (restriction.level === 'blocked' || restriction.level === 'restricted') stopped.add(unit);
      }
      response.operatingStatuses = [...new Set([...running, ...stopped])]
        .filter(unit => unit && scopeAllows(session, unit))
        .map(unit => [unit, stopped.has(unit) ? 'inoperativo' : 'operativo']);
      response.operatingCheckedAt = observed.toISOString();
    }
  }
  return response;
}

async function downtimeReport(context) {
  const { session, sheets, query } = context;
  assert(MANAGEMENT.has(session.role), 403, 'Consulta reservada a Taller y Operaciones');
  if (query?.unit) requireUnit(session, query.unit);
  const now = +(context.now ?? new Date());
  const window = downtimeWindow(query, now);
  assert(window, 400, 'Selecciona un período de hasta 31 días en hora de Panamá');
  const shifts = downtimeShiftStarts(context.downtimeShiftStarts ?? process.env.HERMES_PANAMA_DOWNTIME_SHIFT_STARTS);
  const [[failures, orders, logs], masters] = await Promise.all([
    sheets.readMany?.([TAB.failures, TAB.orders, TAB.history]) ?? Promise.all([TAB.failures, TAB.orders, TAB.history].map(tab => sheets.read(tab))),
    Promise.resolve().then(() => sheets.readWorkshopMasters?.()).catch(() => null),
  ]);
  const requested = query?.unit ? unitCode(query.unit) : '';
  return buildPanamaDowntime({ failures, orders, logs, master: masters?.failures, now, window, shifts,
    allows: unit => scopeAllows(session, unit) && (!requested || requested === unit) });
}

async function readComponentJournal(sheets, unit) {
  const tabs = [TAB.history, TAB.orders];
  const [logs, orders] = await (sheets.readMany?.(tabs) ?? Promise.all(tabs.map(tab => sheets.read(tab))));
  return componentInterventionHistory(logs, orders, unit);
}

async function listComponentInterventions(context) {
  const { session, sheets, query } = context;
  assert(ORDER_READ.has(session.role), 403, 'Tu rol no puede consultar intervenciones de Taller');
  let order;
  if (query?.otId) order = await getOrder(context, query.otId);
  else assert(MANAGEMENT.has(session.role), 403, 'Consulta por unidad reservada a Taller y Operaciones');
  const unit = order ? order.row[3].trim().toUpperCase() : requireUnit(session, query?.unit);
  const { entries, incomplete } = await readComponentJournal(sheets, unit);
  const visible = entries.filter(entry => !order || entry.orderId === order.otId).reverse();
  const interventions = visible.map(({ actorId: _actor, requestId: _request, ...entry }) => entry);
  if (session.role === 'mecanico') return { unit, incomplete, interventions: interventions.map(({ previous: _previous, ...entry }) => entry) };
  return { unit, incomplete, interventions, ...(order && { catalog: componentCatalog,
    confirmedRequests: visible.filter(entry => entry.actorId === session.userId).map(entry => entry.requestId) }) };
}

async function registerComponentIntervention(context) {
  const { body, session, sheets } = context;
  const { row, index, otId, effective } = context.linkedOrder;
  if (sheets.nativeOperations && body.expectedVersion != null) {
    assert(body.expectedVersion === orderVersion(row), 409, 'La orden cambió. Actualiza antes de guardar.');
  }
  const execution = storedObject(row[WORKFLOW.execution]);
  const technical = storedObject(row[WORKFLOW.technical]);
  assert(effective[9] === 'Completado' && execution?.userId && execution.functionalTest
    && technical?.userId && downtimeInstant(technical.acceptedAt) <= Date.parse(context.now), 409, 'La OT requiere aceptación técnica antes de registrar la intervención');
  assert(session.userId === technical.userId && session.userId !== execution.userId && session.userId !== row[17], 403,
    'El registro corresponde a quien aceptó técnicamente la OT');
  const unit = row[3].trim().toUpperCase();
  const { action } = body;
  assert(componentActions.has(action), 400, 'Selecciona el tipo de intervención');
  const component = canonicalComponent(text(body.part, 'Componente', 100, true), text(body.position, 'Posición', 100, true));
  assert(component, 400, 'Selecciona un componente y una posición del catálogo');
  const { part, position } = component;
  const reference = text(body.reference, 'Referencia del respaldo', 180, true);
  const details = text(body.details, 'Trabajo realizado', 800, true);
  const meter = componentHourTicks(body.meter);
  const provided = body.priorHours == null ? null : componentHourTicks(body.priorHours);
  const rebuildCarry = action === 'rebuild' ? componentHourTicks(body.carriedHours) : null;
  assert(meter !== null && (body.priorHours == null || (provided !== null && provided <= meter)), 400,
    'Indica horas válidas con hasta tres decimales. Las horas anteriores no pueden superar el horómetro acumulado');
  const { entries, incomplete } = await readComponentJournal(sheets, unit);
  const replayed = await sheets.replay({ key: context.key, fingerprint: context.fingerprint });
  if (replayed) return { status: 200, body: { ...replayed, replayed: true } };
  assert(!incomplete, 409, 'El historial de componentes de la unidad requiere revisión');
  const slot = componentPositionKey(part, position);
  const history = entries.filter(entry => componentPositionKey(entry.part, entry.position) === slot);
  assert(!entries.some(entry => entry.part === part && overlappingPositions(entry.position, position)), 409,
    'Ya existe historial para una posición que se solapa. Registra sobre la posición que se usa en el historial');
  assert(!history.some(entry => entry.orderId === otId && entry.acceptedAt === technical.acceptedAt), 409,
    'Esta posición ya tiene una intervención registrada en la aceptación técnica de la OT');
  const previous = history.at(-1);
  const priorMeter = previous ? componentHourTicks(previous.meter) : null;
  assert(priorMeter === null || meter >= priorMeter, 409, 'El horómetro acumulado es menor al de la intervención anterior');
  const prior = previous ? componentHourTicks(previous.carriedHours) + meter - priorMeter : provided;
  assert(!previous || provided === null || provided === prior, 400, 'Las horas anteriores difieren del historial de la posición');
  assert(action === 'new' || prior !== null, 400, 'Indica las horas anteriores con respaldo para iniciar el historial de esta posición');
  assert(action !== 'rebuild' || (rebuildCarry !== null && rebuildCarry <= prior), 400,
    'Indica las horas conservadas de la reconstrucción. Deben estar entre cero y las horas anteriores');
  const carry = action === 'new' ? 0 : action === 'partial' ? prior : rebuildCarry;
  const event = { id: digest(context.key), unit, part, position, action, meter: meter / 1000, acceptedAt: technical.acceptedAt,
    priorHours: prior === null ? null : prior / 1000, carriedHours: carry / 1000, reference, details,
    ...(previous && { previous: { id: previous.id, orderId: previous.orderId } }),
  };
  const writes = [
    { tab: TAB.history, append: [historyRow(context, otId, COMPONENT_INTERVENTION, event.id, JSON.stringify({ ...event, requestId: context.mutationId }))] },
    { tab: TAB.orders, row: index, col: 18, values: [nextOrderVersion(context)] },
  ];
  const componentGuard = `component-ledger:${digest([unit, part, entries.findLast(entry => entry.part === part)?.id ?? 'initial'])}`;
  return commit(context, writes, { intervention: event }, orderWriteGuard(row), undefined, componentGuard);
}

async function readWarrantyInputs(sheets, { row, otId }) {
  const tabs = [WARRANTY_TAB, TAB.failures];
  const [logs, failures] = await (sheets.readMany?.(tabs) ?? Promise.all(tabs.map(tab => sheets.read(tab))));
  const unit = row[3].trim().toUpperCase();
  const linked = failures.filter(failure => failure[2]?.trim().toUpperCase() === unit && panamaWorkshopFailureOrder(failure) === otId);
  const report = linked.length === 1 ? linked[0] : undefined;
  const stop = storedObject(report?.[16]);
  const datedStop = stop?.stopped === true && Number.isFinite(downtimeInstant(stop.startedAt))
    ? panamaWorkshopDate(stop.startedAt) : null;
  const datedReport = panamaWorkshopDate(report?.[0]);
  const datedOrder = panamaWorkshopDate(row[2]);
  const date = datedStop || datedReport || datedOrder;
  const source = datedStop ? 'stop' : datedReport ? 'report' : datedOrder ? 'order' : null;
  return { date, source, events: warrantyEvents(logs, otId) };
}

async function listWarranties(context) {
  const { session, sheets, query } = context;
  assert(warrantyReaders.has(session.role), 403, 'Tu rol no puede consultar garantías');
  const order = await getOrder(context, query?.otId);
  const { events, date, source } = await readWarrantyInputs(sheets, order);
  return {
    date, source, version: orderVersion(order.row), cases: warrantyCases(events, date, session.role === 'gerencia'),
    confirmedRequests: events.filter(event => event.actorId === session.userId).map(event => event.requestId),
  };
}

async function registerWarranty(context) {
  const { body, sheets, session, linkedOrder } = context;
  const { row, index, otId } = linkedOrder;
  const { action } = body;
  assert(['coverage', 'claim', 'decision', 'recovery'].includes(action), 400, 'Selecciona una acción de garantía');
  assert(action !== 'recovery' || session.role === 'gerencia', 403, 'Gerencia registra los montos recuperados');
  const { events, date } = await readWarrantyInputs(sheets, linkedOrder);
  const replayed = await sheets.replay({ key: context.key, fingerprint: context.fingerprint });
  if (replayed) return { status: 200, body: { ...replayed, replayed: true } };
  if (sheets.nativeOperations && body.expectedVersion != null) {
    assert(body.expectedVersion === orderVersion(row), 409, 'La orden cambió. Actualiza antes de guardar.');
  }
  const cases = warrantyCases(events, date, true);
  let caseId = body.caseId;
  const existing = cases.find(entry => entry.id === caseId);
  const equivalent = (first, second) => first.toLocaleUpperCase('es-PA') === second.toLocaleUpperCase('es-PA');
  let details;
  if (action === 'coverage') {
    const supplier = text(body.supplier, 'Proveedor', 140, true);
    const subject = text(body.subject, 'Componente o equipo', 140, true);
    const warrantyRef = text(body.warrantyRef, 'Documento de garantía', 180, true);
    const starts = isoDate(body.starts);
    const ends = isoDate(body.ends);
    assert(ends >= starts, 400, 'El fin de la garantía debe ser igual o posterior al inicio');
    assert(!cases.some(entry => equivalent(entry.coverage.supplier, supplier) && equivalent(entry.coverage.subject, subject)
      && equivalent(entry.coverage.warrantyRef, warrantyRef)), 409, 'Esta cobertura ya está registrada en la OT');
    caseId = 'GAR-' + digest(context.key).slice(0, 16).toUpperCase();
    details = { supplier, subject, warrantyRef, starts, ends };
  } else {
    assert(existing, 404, 'Cobertura no encontrada en esta OT');
    const reference = text(body.reference, 'Referencia', 180, true);
    details = { reference };
    if (action === 'claim') {
      assert(!existing.claim, 409, 'Esta cobertura ya tiene un reclamo');
      if (existing.applicability !== 'within-period') {
        const exception = text(body.exception, 'Respaldo de la excepción', 300);
        assert(exception, 409, 'Indica el respaldo del proveedor para reclamar una cobertura sin vigencia comprobada');
        details.exception = exception;
      }
    } else if (action === 'decision') {
      assert(existing.claim && !existing.decision, 409, 'La cobertura requiere un reclamo sin dictamen');
      assert(['approved', 'partial', 'rejected'].includes(body.outcome), 400, 'Selecciona el resultado del dictamen');
      details.outcome = body.outcome;
    } else {
      assert(existing.decision && existing.decision.outcome !== 'rejected', 409, 'La recuperación requiere un dictamen favorable');
      assert(!existing.recoveries.some(record => equivalent(record.reference, reference)), 409, 'El comprobante ya está registrado en este reclamo');
      assert(['USD', 'PAB'].includes(body.currency), 400, 'Selecciona la moneda del comprobante');
      const amount = typeof body.amount === 'number' ? String(body.amount) : body.amount;
      assert(typeof amount === 'string' && /^\d{1,9}(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0,
        400, 'Indica un monto positivo con hasta dos decimales');
      const [whole, fraction = ''] = amount.split('.');
      details = { reference, cents: Number(whole) * 100 + Number(fraction.padEnd(2, '0')), currency: body.currency };
    }
  }
  const notes = text(body.notes, 'Observaciones', 1000);
  const unit = row[3].trim().toUpperCase();
  const attachments = await attachmentUrls(context, body.attachments, 'warranty', unit, '', otId);
  assert(attachments.length <= 4 && (action !== 'claim' || attachments.length), 400, 'Adjunta evidencia del reclamo. Máximo cuatro archivos por registro');
  const event = { caseId, action, ...details, notes, attachments, requestId: context.mutationId };
  return commit(context, [
    { tab: WARRANTY_TAB, append: [historyRow(context, otId, WARRANTY_EVENT, caseId, JSON.stringify(event))] },
    { tab: TAB.orders, row: index, col: 18, values: [nextOrderVersion(context)] },
  ], { caseId }, orderWriteGuard(row));
}

const MUTATIONS = {
  report: [report, ROLES, true], dvir: [dvir, INSPECT, true], transition: [transition, ORDER_READ, false],
  pm: [pm, ASSIGN, true], pmbatch: [pmBatch, ASSIGN, false], schedule: [schedule, ASSIGN, false],
  sticker: [sticker, ROLES, true], stickerreview: [stickerReview, SUPERVISE, false],
  warranties: [registerWarranty, warrantyWriters, false],
  hseaction: [hseAction, SUPERVISE, false],
  returns: [operationalReturn, OPERATIONS, false], componentinterventions: [registerComponentIntervention, CLOSE, false],
};

async function ownFaultReports({ session, sheets }) {
  const [failures, orders] = await (sheets.readMany?.([TAB.failures, TAB.orders]) ?? Promise.all([
    sheets.read(TAB.failures, { requireExisting: true }), sheets.read(TAB.orders, { requireExisting: true }),
  ]));
  const byOrder = new Map();
  const addReference = (key, row) => byOrder.set(key, byOrder.has(key) && byOrder.get(key) !== row ? null : row);
  for (const order of orders) {
    if (!scopeAllows(session, order[3]?.trim().toUpperCase()) || !/^OT-/i.test(order[1] ?? '') || (order[19] && order[19] !== session.userId)) continue;
    addReference(String(order[1]).toUpperCase(), order);
    if (/^OT-\d{4,15}$/.test(order[25] ?? '')) addReference(order[25], order);
  }
  return failures.flatMap((row, index) => {
    const unit = row[2]?.trim().toUpperCase();
    const day = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(row[0] ?? '');
    if (!day || !unit || !scopeAllows(session, unit)
      || (row[15] ? row[15] !== session.userId : row[6] !== session.userName)) return [];
    const reference = (row[13] ?? '').trim();
    const match = byOrder.get(reference.toUpperCase());
    const order = match && match[3]?.trim().toUpperCase() === unit ? match : undefined;
    const state = order?.[9];
    const workshopStatus = ['Abierta', 'En Espera de Asignación'].includes(state) ? 'Recibido por Taller'
      : state === 'En Reparación' ? 'En reparación' : state;
    const folio = /^OT-\d{4,15}$/.test(order?.[25] ?? '') ? order[25] : reference;
    return [{
      id: `averia-${index}`, fecha: `${day[1].padStart(2, '0')}/${day[2].padStart(2, '0')}/${day[3]}`,
      hora: row[1], unidad: unit, tipoFalla: row[3], prioridad: row[5],
      otId: folio, workshopStatus,
    }];
  });
}

export async function dispatchWorkshop(input) {
  const { path, method, session, body, sheets } = input;
  const endpoint = path?.match(/^api\/workshop\/([a-z]+)$/)?.[1];
  try {
    assert(session?.userId && session.userName && ROLES.has(session.role), 401, 'Sesión inválida');
    if (method === 'GET' && endpoint === 'myfaults') {
      assert(isPanama(input), 404, 'Consulta reservada a TMF Panamá');
      return { status: 200, body: { reports: await ownFaultReports(input) } };
    }
    if (method === 'GET' && endpoint === 'reportunits') {
      try {
        const { units, capturedAt } = await reportFleet(input);
        return { status: 200, body: { units: units.filter(unit => scopeAllows(session, unit.code)), capturedAt } };
      } catch {
        return { status: 503, body: { error: 'No se pudo cargar la lista de equipos.' } };
      }
    }
    if (['returns', 'hseaction', 'hsefindings', 'pmchecklist', 'pmtemplate', 'pmtriggers', 'schedulecheck', 'pmbatch', 'pmbatchcheck', 'downtime', 'componentinterventions', 'warranties', 'exceptions'].includes(endpoint)) {
      assert(isPanama(input), 404, 'Acción de taller no disponible');
    }
    if (method === 'POST' && endpoint === 'pmbatchcheck') {
      assert(ASSIGN.has(session.role), 403, 'Tu rol no puede programar órdenes');
      const { items, warnings, confirmation, sourceCut } = await preparePmBatch({ ...input, body: body ?? {} });
      return { status: 200, body: { items, warnings, confirmation, ...(sourceCut && { sourceCut }) } };
    }
    if (method === 'GET' && endpoint === 'pmtriggers') {
      assert(MANAGEMENT.has(session.role), 403, 'Consulta reservada a Taller y Operaciones');
      const unit = requireUnit(session, input.query?.unit);
      const level = pmLevelKey(input.query?.level);
      assert(level, 400, 'Nivel PM inválido');
      return { status: 200, body: await evaluatePmTriggers(input, unit, level) };
    }
    if (method === 'GET' && endpoint === 'schedulecheck') {
      assert(ASSIGN.has(session.role), 403, 'Tu rol no puede programar órdenes');
      return { status: 200, body: await scheduleCheck(input) };
    }
    if (method === 'GET' && endpoint === 'exceptions') {
      assert(MANAGEMENT.has(session.role), 403, 'Consulta reservada a Taller y Operaciones');
      const observedAt = (input.now ?? new Date()).toISOString();
      const [orders, history] = sheets.nativeOperations
        ? [await sheets.read(TAB.orders, { requireExisting: true }), []]
        : await (sheets.readMany?.([TAB.orders, TAB.history]) ?? Promise.all([
          sheets.read(TAB.orders, { requireExisting: true }), sheets.read(TAB.history, { requireExisting: true }),
        ]));
      const units = session.allUnits === true ? null : (session.assignedUnits ?? []).map(unit => unit.trim().toUpperCase());
      const records = workshopExceptionRecords(orders, row => orderVisible(session, row), pendingOperationalReturn,
        row => storedObject(row[WORKFLOW.pm])?.dueAt, history, value => historyTime(value, true));
      return { status: 200, body: { observedAt, units, records, assignmentsChecked: true } };
    }
    if (method === 'GET' && endpoint === 'readiness') {
      return { status: 200, body: await readinessSources(input) };
    }
    if (method === 'GET' && endpoint === 'downtime') {
      return { status: 200, body: await downtimeReport(input) };
    }
    if (method === 'GET' && endpoint === 'warranties') {
      return { status: 200, body: await listWarranties(input) };
    }
    if (method === 'GET' && endpoint === 'componentinterventions') {
      return { status: 200, body: await listComponentInterventions(input) };
    }
    if (method === 'GET' && endpoint === 'hsefindings') {
      return await hseFindings(input);
    }
    if (method === 'GET' && endpoint === 'returns') {
      assert(OPERATIONS.has(session.role), 403, 'Tu rol no puede revisar la recepción de Operaciones');
      return { status: 200, body: { returns: await returnQueue(input, true) } };
    }
    if (method === 'GET' && endpoint === 'pmchecklist') {
      assert(ORDER_READ.has(session.role), 403, 'Tu rol no puede consultar el taller');
      const order = await getOrder(input, input.query?.otId);
      const definition = await pmDefinition(input, order);
      if (input.query?.format === 'print') {
        assert(!session.previewDemo, 404, 'Esta orden de prueba no tiene un checklist del maestro.');
        return await readPrintablePanamaPm({ unit: order.row[3], level: definition.level }, session, {
          expectedModel: definition.model, expectedSerial: definition.serial, folio: order.otId,
        });
      }
      return { status: 200, body: definition };
    }
    if (method === 'GET' && endpoint === 'pmtemplate') {
      assert(ASSIGN.has(session.role), 403, 'Tu rol no puede preparar órdenes PM');
      const level = text(input.query?.level, 'Nivel PM', 25, true);
      assert(/^PM[ -]?\d{1,5}$/i.test(level), 400, 'Nivel PM inválido');
      const { model, serial } = await equipmentFor(input, input.query?.unit);
      return { status: 200, body: { model, level, ...(serial && { serial }), checklist: configuredChecklist(input, model, level, serial) } };
    }
    if (method === 'GET' && endpoint === 'stickers') {
      assert(canReviewHse(session), 403, 'La revisión requiere autorización HSE');
      const rows = await sheets.read(TAB.stickers, { cached: true });
      return { status: 200, body: { stickers: rows.filter((row) => row[10] === PENDING_STICKER && row[18]
        && (!isPanama(input) || row[18] !== session.userId)
        && row[5] && scopeAllows(session, row[5].toUpperCase())).map(stickerPayload) } };
    }
    if (method === 'GET' && endpoint === 'orders') {
      assert(ORDER_READ.has(session.role), 403, 'Tu rol no puede consultar el taller');
      const [rows, logs] = await (sheets.readMany?.([TAB.orders, TAB.history]) ?? Promise.all([
        sheets.read(TAB.orders, { cached: true }), sheets.read(TAB.history, { cached: true }),
      ]));
      const orders = rows.filter((row) => orderVisible(session, row));
      const ids = new Set(orders.map((row) => row[1]));
      return { status: 200, body: { orders, history: logs.filter((row) => ids.has(row[1]) && ![COMPONENT_INTERVENTION, 'solicitud_repuesto'].includes(row[2])),
        ...(sheets.nativeOperations && { nativeOperations: true }) } };
    }
    if (method === 'GET' && endpoint === 'schedule') {
      assert(MANAGEMENT.has(session.role), 403, 'Tu rol no puede consultar el calendario');
      const rows = await sheets.read(TAB.schedule, { cached: true });
      return { status: 200, body: { schedule: rows.filter((row) => /^OT-/.test(row[2] || '') && row[3] && scopeAllows(session, row[3].toUpperCase())) } };
    }
    if (method === 'GET' && endpoint === 'mechanics') {
      assert(ASSIGN.has(session.role), 403, 'Tu rol no puede asignar órdenes');
      const mechanics = (await mechanicsFor(input)).map(({ userId, userName, assignedUnits, allUnits }) => ({ userId, userName, assignedUnits, allUnits }));
      return { status: 200, body: { mechanics } };
    }
    assert(Object.hasOwn(MUTATIONS, endpoint || ''), 404, 'Acción de taller no disponible');
    assert(method === 'POST', 405, 'Método no permitido');
    const [handler, roles, create] = MUTATIONS[endpoint];
    assert(roles.has(session.role), 403, 'Tu rol no puede ejecutar esta acción');
    assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'Solicitud inválida');
    if (endpoint === 'stickerreview' || endpoint === 'hseaction' || (endpoint === 'sticker' && body.approve === true)) {
      assert(canReviewHse(session), 403, 'La revisión requiere autorización HSE');
    }
    const mutationId = text(body.mutationId, 'Identificador de operación', 36, true).toLowerCase();
    assert(UUID.test(mutationId), 400, 'Identificador de operación inválido');
    const key = `workshop:${endpoint}:${session.userId}:${mutationId}`;
    const operation = { ...body };
    delete operation.expectedUserId;
    const fingerprint = digest(operation);
    if (create) requireUnit(session, body.unit);
    if (endpoint === 'pmbatch') batchUnits(session, body.items);
    const linkedOrder = ['componentinterventions', 'warranties'].includes(endpoint) ? await getOrder({ ...input, body: undefined }, body.otId) : undefined;
    const prior = await sheets.replay({ key, fingerprint });
    if (prior) return { status: 200, body: { ...(endpoint === 'pmbatch' ? await pmBatchFolios(input, prior) : prior), replayed: true } };
    const date = new Date();
    const local = dateFormatter.format(date).split('-').reverse().join('/');
    return await handler({ ...input, key, mutationId, fingerprint, create, linkedOrder, now: date.toISOString(), date: local,
      time: timeFormatter.format(date), otId: `OT-${digest(key).slice(0, 16).toUpperCase()}` });
  } catch (error) {
    const status = Number(error?.status ?? error?.statusCode);
    if (error instanceof WorkshopError || isEvidenceError(error) || (error instanceof HermesSheetError && [400, 409].includes(status))) {
      return { status, body: { error: error.message } };
    }
    if (status === 409) return { status, body: { error: 'La operación ya existe o el registro cambió. Actualiza y vuelve a revisar.' } };
    return { status: 503, body: { error: method === 'GET' && endpoint === 'downtime'
      ? 'No se pudieron consultar los tiempos de mantenimiento. Reintenta la consulta.'
      : 'No se pudo confirmar el guardado en Taller. Reintenta la misma operación.' } };
  }
}
