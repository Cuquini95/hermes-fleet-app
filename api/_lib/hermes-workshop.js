import { createHash } from 'node:crypto';
import { STICKER_INSPECTION_TEMPLATES } from '../../src/data/sticker-inspection-templates.js';

const TAB = {
  inventory: '01 Inventario', orders: 'ORDENES_TRABAJO', history: 'OT_STATUS_LOG', failures: 'Averias',
  inspections: '14 Inspecciones', pm: 'Ordenes Mantenimiento', pmHistory: '05 Historial PM', schedule: 'WORKSHOP_SCHEDULE',
  stickers: 'Inspeccion_Stickers', findings: 'Inspeccion_Hallazgos',
};
const ORDER_READ = new Set(['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const ASSIGN = new Set(['jefe_taller', 'coordinador', 'gerencia']);
const CLOSE = new Set(['jefe_taller', 'supervisor', 'gerencia']);
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
const PRIORITIES = new Set(['CRITICA', 'ALTA', 'MEDIA', 'BAJA']);
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

async function equipmentFor({ sheets, session }, value) {
  const code = requireUnit(session, value);
  const rows = await sheets.read(TAB.inventory);
  const row = rows.find((r) => (r[1] || '').trim().toUpperCase() === code);
  assert(row, 404, 'Unidad no encontrada en el inventario');
  return { code, model: [row[3], row[4]].filter(Boolean).join(' '), type: row[2] || '', meter: row[9] || '' };
}

function orderVisible(session, row) {
  const unit = row[3]?.trim().toUpperCase();
  return Boolean(unit && /^OT-/.test(row[1] || '') && scopeAllows(session, unit)
    && (session.role !== 'mecanico' || row[17] === session.userId));
}

function attachmentUrls(context, input, buckets) {
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
      && buckets.some((bucket) => url.pathname.startsWith(`/storage/v1/object/public/${bucket}/`)), 400, 'Evidencia inválida');
    return clean;
  });
}

function historyRow(context, otId, field, before, after) {
  return [context.now, otId, field, before, after, context.session.userName, context.session.role, context.session.userId];
}

function orderRow(context, data) {
  const { id, unit, type, description, priority, photos = [], reference = '', parts = '', notes = '', mechanic } = data;
  return [context.mutationId, id, context.date, unit, type, description, priority, priority, mechanic?.userName || '', 'Abierta',
    photos.join(', '), reference, parts, '', '', notes, '0', mechanic?.userId || '', context.mutationId, context.session.userId];
}

function failureWrites(context, data) {
  const { id, unit, type, description, priority, photos, downtime = '', notes = '' } = data;
  return [
    { tab: TAB.failures, append: [[context.date, context.time, unit, type, description, priority, context.session.userName,
      downtime, '', 'Abierta', '', notes, '', id, (photos || []).join(', ')]] },
    { tab: TAB.orders, append: [orderRow(context, { ...data, reference: id })] },
    { tab: TAB.history, append: [historyRow(context, id, 'estado', '', 'Abierta')] },
  ];
}

async function commit(context, writes, result, guard) {
  const saved = await context.sheets.commit({ key: context.key, fingerprint: context.fingerprint, guard, writes, result });
  return { status: saved.replayed ? 200 : context.create ? 201 : 200, body: { ...saved.result, replayed: saved.replayed } };
}

async function report(context) {
  const { body } = context;
  const { code } = await equipmentFor(context, body.unit);
  const type = text(body.type, 'Tipo de falla', 60, true);
  const description = text(body.description, 'Descripción', 3000, true);
  const customer = text(body.customer, 'Cliente', 120);
  const location = text(body.location, 'Ubicación', 180);
  const downtime = text(body.downtime, 'Tiempo de paro', 40);
  assert(typeof body.canMove === 'boolean', 400, 'Indica si la unidad puede moverse');
  const photos = attachmentUrls(context, body.photos, ['falla-photos']);
  const clientAffected = !['', 'n/a', 'ninguno', '--', 'na', 'none'].includes(customer.toLowerCase());
  const priority = body.canMove ? 'MEDIA' : clientAffected ? 'CRITICA' : 'ALTA';
  const notes = `Ubicación: ${location}. Cliente: ${customer}. Puede moverse: ${body.canMove ? 'Sí' : 'No'}`;
  return commit(context, failureWrites(context, { id: context.otId, unit: code, type, description, priority, photos, downtime, notes }), { otId: context.otId });
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
  const photos = attachmentUrls(context, body.photos, ['dvir-photos']);
  const otId = result === 'reprobado' ? context.otId : null;
  const inspectionId = `INS-${context.otId.slice(3)}`;
  const writes = [{ tab: TAB.inspections, append: [[context.mutationId, inspectionId, date, time, code, model, session.userName,
    body.type, meter, ...checks.map((c) => c.status), score, result, observations, photos.join(', '), otId || '', otId ? 'Pendiente' : '', session.userName]] }];
  if (otId) writes.push(...failureWrites(context, {
    id: otId, unit: code, type: 'DVIR', description: observations || 'Inspección DVIR reprobada', priority: 'ALTA', photos, notes: inspectionId,
  }));
  return commit(context, writes, { inspectionId, otId, result, score });
}

function orderVersion(row) {
  return row[18] || digest(row);
}

function historyTime(value = '') {
  const sheet = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{2}:\d{2}(?::\d{2})?))?$/.exec(value);
  const local = sheet
    ? `${sheet[3]}-${sheet[2].padStart(2, '0')}-${sheet[1].padStart(2, '0')}T${sheet[4] || '00:00:00'}`
    : value.replace(' ', 'T');
  const zone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local) ? '-06:00' : '';
  return Date.parse(`${local}${zone}`) || 0;
}

async function getOrder(context, value) {
  const otId = text(value, 'Folio de OT', 90, true);
  const [rows, logs] = await Promise.all([context.sheets.read(TAB.orders), context.sheets.read(TAB.history)]);
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => row[1] === otId);
  assert(matches.length <= 1, 409, 'Hay más de una fila para ese folio. Revisa la orden.');
  const found = matches[0];
  assert(found, 404, 'OT no encontrada');
  assert(orderVisible(context.session, found.row), 403, 'OT fuera de tu alcance');
  const effective = [...found.row];
  for (const log of logs.filter((row) => row[1] === otId).sort((a, b) => historyTime(a[0]) - historyTime(b[0]))) {
    if (Object.hasOwn(FIELD_COLUMNS, log[2])) effective[FIELD_COLUMNS[log[2]]] = log[4];
  }
  return { otId, ...found, effective, version: orderVersion(found.row) };
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

async function transition(context) {
  const { body, session, sheets, mutationId } = context;
  const order = await getOrder(context, body.otId);
  const { otId, row, index, effective, version } = order;
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

  if (field === 'estado') {
    if (value === 'Completado') assert(CLOSE.has(session.role), 403, 'Tu rol no puede cerrar una OT');
    assert(value === before || STATUSES[before || 'Abierta']?.includes(value), 409, 'Transición de estado inválida');
    const failures = await sheets.read(TAB.failures);
    const linked = failures.map((failure, rowIndex) => ({ failure, rowIndex })).filter(({ failure }) => failure[13] === otId && failure[2] === row[3]);
    assert(linked.length <= 1, 409, 'Hay averías duplicadas vinculadas al folio');
    if (linked[0]) writes.push({ tab: TAB.failures, row: linked[0].rowIndex, col: 9, values: [value] });
    if (value === 'Completado') {
      writes.push({ tab: TAB.orders, row: index, col: 14, values: [context.now] });
      if (row[4] === 'DVIR') {
        const inspections = await sheets.read(TAB.inspections);
        for (const [rowIndex, inspection] of inspections.entries()) {
          if (inspection[25] === otId && inspection[4] === row[3]) writes.push({ tab: TAB.inspections, row: rowIndex, col: 26, values: ['Resuelta'] });
        }
      }
    }
  }
  if (field === 'mecanico_asignado') {
    const assignee = await mechanicFor(context, value, row[3].toUpperCase());
    writes.push({ tab: TAB.orders, row: index, col: 17, values: [assignee?.userId || ''] });
    value = assignee?.userName || '';
  }
  if (field === 'prioridad') assert(PRIORITIES.has(value), 400, 'Prioridad inválida');
  if (field === 'progreso') value = String(decimal(value, 'Progreso', 0, 100));
  if (field === 'costo_estimado') value = decimal(value, 'Costo estimado', 0, 1e9).toFixed(2);
  if (field === 'foto_url') {
    const photos = attachmentUrls(context, body.value, ['falla-photos']);
    assert(photos.length > 0, 400, 'Adjunta una evidencia');
    value = [...new Set([...before.split(', ').filter(Boolean), ...photos])].join(', ');
    assert(value.length <= 48000, 409, 'La orden alcanzó el límite de evidencia');
  }

  writes.push(
    { tab: TAB.orders, row: index, col, values: [value] },
    { tab: TAB.orders, row: index, col: 18, values: [mutationId] },
    { tab: TAB.history, append: [historyRow(context, otId, field, before, value)] },
  );
  return commit(context, writes, { otId }, `workshop-order:${otId}:${version}`);
}

function scheduleValue(context, { otId, unit, mechanic, hours, date, priority, notes }) {
  return [context.mutationId, date, otId, unit, mechanic?.userName || 'Sin asignar', String(hours), priority, 'Programado', notes,
    mechanic?.userId || '', context.session.userId];
}

async function pm(context) {
  const { body, session } = context;
  const { code, model, meter } = await equipmentFor(context, body.unit);
  const level = text(body.level, 'Nivel PM', 25, true);
  assert(/^PM[ -]?\d{1,5}$/i.test(level), 400, 'Nivel PM inválido');
  const included = text(body.includedLevels, 'Niveles incluidos', 180, true);
  const notes = text(body.notes, 'Observaciones', 2000);
  const parts = text(body.parts, 'Partes', 5000);
  const date = isoDate(body.scheduledDate);
  const hours = decimal(body.hours, 'Horas estimadas', 0.25, 240);
  const mechanic = await mechanicFor(context, body.mechanicId, code);
  const otId = context.otId;
  const priority = 'MEDIA';
  const description = `Mantenimiento Preventivo ${level}. Incluye: ${included}`;
  const schedule = scheduleValue(context, { otId, unit: code, mechanic, hours, date, priority, notes });
  const common = [code, model, level, included, meter];
  return commit(context, [
    { tab: TAB.pm, append: [[otId, context.date, ...common, description, String(hours), mechanic?.userName || 'Sin asignar', session.userName, 'Programada', parts, notes]] },
    { tab: TAB.pmHistory, append: [[context.date, otId, ...common, String(hours), mechanic?.userName || 'Sin asignar', session.userName, 'Programada', parts, notes]] },
    { tab: TAB.orders, append: [orderRow(context, { id: otId, unit: code, type: 'PM', description, priority, parts, notes, mechanic })] },
    { tab: TAB.history, append: [historyRow(context, otId, 'estado', '', 'Abierta')] },
    { tab: TAB.schedule, append: [schedule] },
  ], { otId, schedule });
}

async function schedule(context) {
  const { body, sheets } = context;
  const { otId, row, index, effective, version } = await getOrder(context, body.otId);
  assert(['Abierta', 'En Espera de Asignación', 'En Reparación', 'Esperando Pieza'].includes(effective[9]), 409, 'La OT no está disponible para programar');
  const unit = row[3].toUpperCase();
  const changeAssignee = Object.hasOwn(body, 'mechanicId');
  const mechanic = changeAssignee
    ? await mechanicFor(context, body.mechanicId, unit)
    : effective[8] ? { userId: effective[17], userName: effective[8] } : null;
  const date = isoDate(body.date);
  const hours = decimal(body.hours, 'Horas estimadas', 0.25, 24);
  const notes = text(body.notes, 'Notas', 1000);
  const result = scheduleValue(context, { otId, unit, mechanic, hours, date, priority: effective[7] || 'MEDIA', notes });
  const rows = await sheets.read(TAB.schedule);
  const matching = rows.flatMap((entry, index) => entry[2] === otId ? [index] : []);
  assert(matching.length <= 1, 409, 'Hay más de una programación para esta OT');
  const previous = matching[0] ?? -1;
  const writes = [
    previous >= 0 ? { tab: TAB.schedule, row: previous, values: result } : { tab: TAB.schedule, append: [result] },
    { tab: TAB.orders, row: index, col: 18, values: [context.mutationId] },
    { tab: TAB.history, append: [historyRow(context, otId, 'programacion', previous >= 0 ? rows[previous][1] : '',
      `${date} · ${hours} h · ${mechanic?.userName || 'Sin asignar'}`)] },
  ];
  if (changeAssignee) writes.push(
    { tab: TAB.orders, row: index, col: 8, values: [mechanic?.userName || ''] },
    { tab: TAB.orders, row: index, col: 17, values: [mechanic?.userId || ''] },
    { tab: TAB.history, append: [historyRow(context, otId, 'mecanico_asignado', effective[8] || '', mechanic?.userName || '')] },
  );
  return commit(context, writes, { schedule: result }, `workshop-order:${otId}:${version}`);
}

const STICKER_COLORS = ['green', 'yellow', 'red'];
const STICKER_STATUSES = ['cumple', 'condicionado', 'no_cumple', 'no_aplica'];
const PENDING_STICKER = 'pendiente_supervisor';
const APPROVED_STICKER = 'aprobado_supervisor';
const fmtSheetDate = (value) => value.split('-').reverse().join('/');

function templateClass(type) {
  const name = type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/excavadora/.test(name)) return 'excavadora';
  if (/tractor.*oruga|bulldozer/.test(name)) return 'tractor_oruga';
  if (/cargador.*frontal/.test(name)) return 'cargador_frontal';
  if (/camion.*articulado|dumper/.test(name)) return 'camion_articulado';
  return '';
}

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
  const expected = templateClass(type);
  assert(template && (!expected || expected === template.id), 400, 'La lista de inspección debe corresponder al equipo');
  const company = text(body.company, 'Empresa', 100, true);
  const date = isoDate(body.date);
  const time = localTime(body.time);
  const expiry = new Date(`${date}T00:00:00Z`);
  expiry.setUTCDate(expiry.getUTCDate() + 15);
  const approved = body.approve === true;
  const today = dateFormatter.format(new Date(context.now));
  assert(date <= today, 400, 'La inspección no puede tener una fecha futura');
  if (approved) {
    assert(SUPERVISE.has(session.role), 403, 'Tu rol no puede aprobar el sticker');
    assert(expiry.toISOString().slice(0, 10) >= today, 409, 'La inspección está vencida');
  }
  assert(Array.isArray(body.checks) && body.checks.length === template.items.length, 400, 'Completa la lista de inspección');
  const checkByItem = new Map(body.checks.map((check) => [check?.itemId, check]));
  const photos = attachmentUrls(context, body.photos, ['sticker-inspection-photos']);
  const findings = [];
  for (const item of template.items) {
    const check = checkByItem.get(item.id);
    assert(STICKER_STATUSES.includes(check?.status), 400, 'Completa la lista de inspección');
    assert(!item.hardStop || check.status !== 'no_aplica', 400, 'Los puntos críticos requieren una comprobación');
    if (check.status !== 'no_cumple' && check.status !== 'condicionado') continue;
    const comment = text(check.comment, 'Comentario del hallazgo', 500, true);
    const evidence = attachmentUrls(context, check.photos, ['sticker-inspection-photos']);
    assert(evidence.length > 0 && evidence.every((url) => photos.includes(url)), 400, 'Adjunta la evidencia de cada hallazgo');
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
  return commit(context, writes, stickerPayload(row));
}

async function stickerReview(context) {
  const { body, session, sheets } = context;
  const folio = text(body.folio, 'Folio', 100, true);
  const [stickers, findings] = await Promise.all([sheets.read(TAB.stickers), sheets.read(TAB.findings)]);
  const matches = stickers.map((row, index) => ({ row, index })).filter(({ row }) => row[1] === folio);
  assert(matches.length === 1, matches.length ? 409 : 404, 'Inspección no disponible para aprobar');
  const { row, index } = matches[0];
  requireUnit(session, row[5]);
  assert(row[10] === PENDING_STICKER, 409, 'La inspección ya fue revisada');
  assert(row[18] && row[17] && STICKER_COLORS.includes(row[12]), 409, 'La inspección requiere validar su origen');
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
  return commit(context, writes, stickerPayload(resolved), `workshop-sticker:${folio}:${PENDING_STICKER}`);
}

async function readinessSources({ session, sheets }) {
  const definitions = [
    ['failures', TAB.failures, 2, [0, 2, 9]],
    ['stickers', TAB.stickers, 5, [1, 2, 3, 4, 5, 10, 12, 13, 14, 17]],
    ['inspections', TAB.inspections, 4, [2, 3, 4, 22, 23, 26]],
  ];
  const results = await Promise.allSettled(definitions.map(([, tab]) => sheets.read(tab, { cached: true, requireExisting: true })));
  const response = { unavailable: [] };
  for (const [index, [name, , unitColumn, selected]] of definitions.entries()) {
    const result = results[index];
    if (result.status !== 'fulfilled') response.unavailable.push(name);
    response[name] = (result.status === 'fulfilled' ? result.value : []).filter((row) => {
      const unit = row[unitColumn]?.trim().toUpperCase();
      return unit && scopeAllows(session, unit);
    }).map((row) => {
      const cells = Array(selected.at(-1) + 1).fill('');
      for (const col of selected) cells[col] = row[col] || '';
      if (name === 'stickers') {
        try {
          const payload = JSON.parse(cells[17] || '{}');
          cells[17] = (payload.findings || []).map((finding) => finding.dueDate).filter(Boolean).sort()[0] || '';
        } catch { cells[17] = ''; }
      }
      return cells;
    });
  }
  return response;
}

const MUTATIONS = {
  report: [report, ROLES, true], dvir: [dvir, INSPECT, true], transition: [transition, ORDER_READ, false],
  pm: [pm, ASSIGN, true], schedule: [schedule, ASSIGN, false],
  sticker: [sticker, ROLES, true], stickerreview: [stickerReview, SUPERVISE, false],
};

export async function dispatchWorkshop(input) {
  const { path, method, session, body, sheets } = input;
  const endpoint = path?.match(/^api\/workshop\/([a-z]+)$/)?.[1];
  try {
    assert(session?.userId && session.userName && ROLES.has(session.role), 401, 'Sesión inválida');
    if (method === 'GET' && endpoint === 'readiness') {
      return { status: 200, body: await readinessSources(input) };
    }
    if (method === 'GET' && endpoint === 'stickers') {
      assert(SUPERVISE.has(session.role), 403, 'Tu rol no puede revisar stickers');
      const rows = await sheets.read(TAB.stickers, { cached: true });
      return { status: 200, body: { stickers: rows.filter((row) => row[10] === PENDING_STICKER && row[18]
        && row[5] && scopeAllows(session, row[5].toUpperCase())).map(stickerPayload) } };
    }
    if (method === 'GET' && endpoint === 'orders') {
      assert(ORDER_READ.has(session.role), 403, 'Tu rol no puede consultar el taller');
      const [rows, logs] = await Promise.all([sheets.read(TAB.orders, { cached: true }), sheets.read(TAB.history, { cached: true })]);
      const orders = rows.filter((row) => orderVisible(session, row));
      const ids = new Set(orders.map((row) => row[1]));
      return { status: 200, body: { orders, history: logs.filter((row) => ids.has(row[1])) } };
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
    const mutationId = text(body.mutationId, 'Identificador de operación', 36, true).toLowerCase();
    assert(UUID.test(mutationId), 400, 'Identificador de operación inválido');
    const key = `workshop:${endpoint}:${session.userId}:${mutationId}`;
    const fingerprint = digest(body);
    if (create) requireUnit(session, body.unit);
    const prior = await sheets.replay({ key, fingerprint });
    if (prior) return { status: 200, body: { ...prior, replayed: true } };
    const date = new Date();
    const local = dateFormatter.format(date).split('-').reverse().join('/');
    return await handler({ ...input, key, mutationId, fingerprint, create, now: date.toISOString(), date: local,
      time: timeFormatter.format(date), otId: `OT-${digest(key).slice(0, 16).toUpperCase()}` });
  } catch (error) {
    const status = Number(error?.status ?? error?.statusCode);
    if (error instanceof WorkshopError) return { status, body: { error: error.message } };
    if (status === 409) return { status, body: { error: 'La operación ya existe o el registro cambió. Actualiza y vuelve a revisar.' } };
    return { status: 503, body: { error: 'No se pudo confirmar el guardado en Taller. Reintenta la misma operación.' } };
  }
}
