import { createHash } from 'node:crypto';
import { PANAMA_DEMO_ISSUER } from './hermes-panama-demo.js';
import { isEvidenceError, verifyEvidence } from './hermes-evidence.js';
import { orderWriteGuard } from './hermes-workshop.js';
import { HermesSheetError } from './hermes-google-sheets.js';

export const PURCHASE_TABS = Object.freeze({
  orders: 'Órdenes de Compra',
  lines: 'OC_Lineas',
  requests: 'Cotizaciones_Pendientes',
  vendors: 'Proveedores',
  expenses: '02 Gastos',
  audit: '10 Control Cambios',
  catalog: '12 Inventario Rep.',
  inventoryMovements: 'Movimientos Repuestos PA',
});

const REQUEST_ROLES = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const EXPENSE_ROLES = new Set(['jefe_taller', 'coordinador', 'gerencia']);
const REQUEST_STATUS = new Set(['Pendiente', 'Pedido', 'Completado']);
const RECEIPT_ORDER_STATUS = new Set(['Aprobada', 'Recibida parcial', 'Recibida', 'Pagada']);
const OP_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DEFAULT_ISSUER = {
  id: 'ULTRATK_MX', name: 'ULTRATK SA DE CV', currency: 'MXN', taxLabel: 'IVA', taxBps: 1600,
  address: 'Juarez 312, Revolucion · Tecalitlan, Jalisco', phone: '314-115-1515', template: 'ultratk',
};
const PANAMA_ISSUER = Object.freeze({
  id: 'TP_PA', name: 'TRANSPLUS, S.A.', currency: 'USD', taxLabel: 'ITBMS', template: 'transplus',
  address: 'Costa del Este, Edificio Financial Park, piso 10, oficina 10-A',
  phone: '387-3710', taxId: 'RUC 2236707-1-778948 DV 15',
});

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const error = (status, message) => { throw new RequestError(status, message); };
const trim = (value) => String(value ?? '').trim();
const upper = (value) => trim(value).toUpperCase();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ok = (body) => ({ status: 200, body });
const entries = (rows) => rows.map((row, index) => ({ row, index })).slice(1);
const wholeRow = (tab, index, values) => ({ tab, row: index, values });
const append = (tab, rows) => ({ tab, append: rows });
const readTables = (sheets, ...tabs) => sheets.readMany?.(tabs) ?? Promise.all(tabs.map(tab => sheets.read(tab)));

function field(value, max, label, required = false) {
  const out = trim(value);
  if ((required && !out) || out.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(out)) {
    error(400, 'Revisa el campo ' + label + '.');
  }
  return out;
}

function decimal(value, precision, label, positive = false) {
  const raw = trim(value);
  const match = /^(0|[1-9]\d{0,11})(?:\.(\d+))?$/.exec(raw);
  const fraction = match?.[2] ?? '';
  if (!match || fraction.length > precision) error(400, 'Revisa el importe o cantidad de ' + label + '.');
  const units = BigInt(match[1] + fraction.padEnd(precision, '0'));
  if (positive && units === 0n) error(400, 'Indica una cantidad positiva para ' + label + '.');
  return units;
}

function decimalCell(value, precision, label, positive = false) {
  const raw = trim(value).replace(/[$,\s]/g, '');
  return decimal(raw || '0', precision, label, positive);
}

function formatted(value, precision) {
  const digits = String(value).padStart(precision + 1, '0');
  return digits.slice(0, -precision) + '.' + digits.slice(-precision);
}

const money = (value) => formatted(value, 2);
const quantity = (value) => formatted(value, 3).replace(/\.?0+$/, '');
const lineCost = (qty, price) => (qty * price + 500n) / 1000n;

function calendarDate(value, label, required) {
  const date = field(value, 10, label, required);
  if (!date) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error(400, 'Revisa la fecha de ' + label + '.');
  const time = Date.parse(date);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) {
    error(400, 'Revisa la fecha de ' + label + '.');
  }
  return date.slice(8) + '/' + date.slice(5, 7) + '/' + date.slice(0, 4);
}

function timestamp() {
  const now = new Date();
  const zone = { timeZone: 'America/Panama' };
  const date = new Intl.DateTimeFormat('en-GB', { ...zone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { ...zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  return { date, time, iso: now.toISOString() };
}

function canUseUnit(session, unit) {
  return session.allUnits === true || (Array.isArray(session.assignedUnits) &&
    session.assignedUnits.some((assigned) => upper(assigned) === upper(unit) && upper(unit) !== 'FLOTA'));
}

function requireUnit(session, value) {
  const unit = upper(field(value || 'FLOTA', 48, 'unidad', true));
  if (!canUseUnit(session, unit)) error(403, 'La unidad queda fuera de tu asignación.');
  return unit;
}

async function validateOperationalUnits(sheets, ...units) {
  const specific = units.filter(unit => unit !== 'FLOTA');
  if (!sheets.nativeOperations || !specific.length) return;
  const fleet = new Set((await sheets.read('01 Inventario')).slice(3).map(row => upper(row[1])));
  if (specific.some(unit => !fleet.has(unit))) error(400, 'La unidad no figura en el inventario TMF.');
}

function configuredIssuers(session) {
  const panama = session.project === 'tmf-panama';
  if (panama && session.previewDemo === true) return [PANAMA_DEMO_ISSUER];
  const source = process.env.HERMES_PURCHASE_ISSUERS_JSON;
  if (!source) return [panama ? PANAMA_ISSUER : DEFAULT_ISSUER];
  try {
    const data = JSON.parse(source);
    if (!Array.isArray(data) || new Set(data.map((i) => i.id)).size !== data.length) return [];
    return data.filter((i) =>
      typeof i.id === 'string' && /^[A-Z0-9_-]{2,40}$/.test(i.id) &&
      typeof i.name === 'string' && i.name.trim().length > 0 && i.name.length < 160 &&
      (panama ? ['USD', 'PAB'] : ['MXN', 'USD', 'PAB']).includes(i.currency) &&
      ((panama && i.taxBps === undefined) || (Number.isInteger(i.taxBps) && i.taxBps >= 0 && i.taxBps <= 10000)) &&
      typeof i.taxLabel === 'string' &&
      (panama ? i.template === 'transplus' : ['ultratk', 'transplus'].includes(i.template))
    ).map((i) => ({
      id: i.id, name: i.name, currency: i.currency, taxBps: i.taxBps, taxLabel: i.taxLabel,
      address: trim(i.address).slice(0, 500), phone: trim(i.phone).slice(0, 80),
      taxId: trim(i.taxId).slice(0, 80), template: i.template,
    }));
  } catch {
    return [];
  }
}

function vendorRecord(row) {
  return {
    name: trim(row[0]), rfc: trim(row[1]),
    address: row.slice(2, 6).map(trim).filter(Boolean).join(', '),
  };
}

function orderVendor(body, rows, panama) {
  if (panama && body.vendorSource === 'manual') {
    return {
      name: field(body.vendorName, 180, 'nombre del proveedor', true),
      rfc: field(body.vendorRfc, 80, 'identificación fiscal del proveedor'),
      address: field(body.vendorAddress, 500, 'dirección del proveedor'),
      source: 'manual',
    };
  }
  if (body.vendorSource !== undefined && body.vendorSource !== 'catalog') error(400, 'Revisa el origen del proveedor.');
  const vendors = entries(rows).map(({ row }) => vendorRecord(row)).filter((vendor) =>
    vendor.name && upper(vendor.name) === upper(body.vendorName) && upper(vendor.rfc) === upper(body.vendorRfc));
  if (vendors.length !== 1) error(400, 'Selecciona un proveedor único del catálogo.');
  return { ...vendors[0], source: 'catalog' };
}

function issuerSnapshot(row) {
  try {
    const issuer = JSON.parse(row[16] || 'null');
    return issuer && issuer.id && issuer.name && issuer.currency ? issuer : null;
  } catch {
    return null;
  }
}

function receiptHistory(row) {
  if (!row[11]) return [];
  try {
    const receipts = JSON.parse(row[11]);
    if (Array.isArray(receipts)) return receipts;
  } catch {
    // The existing cell will be preserved and surfaced as invalid on mutations.
  }
  error(409, 'El historial de recepciones de esta partida requiere conciliación.');
}

function ocLine(row) {
  return {
    id: trim(row[6]) || trim(row[0]) + '-L' + trim(row[1]), number: trim(row[1]),
    description: trim(row[2]), quantity: trim(row[3]), unitPrice: trim(row[4]), total: trim(row[5]),
    requestId: trim(row[7]), requestLineId: trim(row[8]), partNumber: trim(row[9]),
    received: trim(row[10]) || '0', receipts: receiptHistory(row),
  };
}

function recordedDocument(cell) {
  if (!cell) return null;
  try {
    const record = JSON.parse(cell);
    if (record?.reference && record.actorId && Number.isFinite(Date.parse(record.at))) return record;
  } catch {
    // An invalid existing record is preserved for reconciliation.
  }
  error(409, 'La referencia contable de esta orden requiere conciliación.');
}

function orderRecord(row, items) {
  const lines = items.map((item) => ocLine(item.row)).sort((a, b) => Number(a.number) - Number(b.number));
  const anyReceived = lines.some((line) => Number(line.received) > 0);
  const allReceived = lines.length > 0 && lines.every((line) => Number(line.received) >= Number(line.quantity));
  return {
    folio: trim(row[0]), date: trim(row[1]), vendorName: trim(row[2]), vendorRfc: trim(row[3]), vendorAddress: trim(row[4]),
    unit: trim(row[5]), subtotal: trim(row[6]), tax: trim(row[7]), shipping: trim(row[8]), other: trim(row[9]), total: trim(row[10]),
    discount: trim(row[25]) || '0.00', vendorSource: row[26] === 'manual' ? 'manual' : 'catalog',
    status: trim(row[11]) || 'Borrador', comments: trim(row[12]), approvedBy: trim(row[13]), deliveryDate: trim(row[14]),
    version: trim(row[15]) || 'legacy-' + hash([row, items.map((item) => item.row)]).slice(0, 24),
    issuer: issuerSnapshot(row), approvedById: trim(row[17]), approvedAt: trim(row[18]), requestedBy: trim(row[20]),
    approvalReason: trim(row[22]), invoice: recordedDocument(row[23]), payment: recordedDocument(row[24]),
    receiptStatus: allReceived ? 'Recibida' : anyReceived ? 'Recibida parcial' : 'Pendiente',
    lines,
  };
}

function hasRecordedApproval({ status, approvedBy, approvedById, approvedAt }) {
  return RECEIPT_ORDER_STATUS.has(status) && Boolean(approvedBy && approvedById) && Number.isFinite(Date.parse(approvedAt));
}

function receivingRecord({ folio, unit, vendorName, deliveryDate, receiptStatus, version, lines }) {
  return { folio, unit, vendorName, deliveryDate, receiptStatus, version, lines: lines.map((line) => ({
    id: line.id, number: line.number, description: line.description, partNumber: line.partNumber,
    quantity: line.quantity, received: line.received,
    receipts: line.receipts.map(({ id, at, by, quantity, reference, stockDisposition }) => ({ id, at, by, quantity, reference, stockDisposition })),
  })) };
}

function requestRecord(row, index) {
  return {
    id: trim(row[15]) || 'LEGACY-' + hash([index, row.slice(0, 15)]).slice(0, 24).toUpperCase(),
    pedidoId: trim(row[9]), fecha: trim(row[0]), hora: trim(row[10]), solicitante: trim(row[11]),
    partNum: trim(row[1]), descripcion: trim(row[2]), equipo: trim(row[3]), cantidad: trim(row[4]),
    precioUnit: trim(row[7]), fuente: trim(row[5]), estado: trim(row[6]) || 'Pendiente',
    urgencia: trim(row[12]), notas: trim(row[13]), total: trim(row[14]),
    ocFolio: trim(row[16]), version: trim(row[17]) || 'legacy-' + hash(row).slice(0, 24),
    unitPrice: trim(row[21]),
  };
}

function parseRequests(rows) {
  return entries(rows).flatMap(({ row, index }) =>
    trim(row[1]) && trim(row[2]) && REQUEST_STATUS.has(trim(row[6]) || 'Pendiente')
      ? [{ row, index, record: requestRecord(row, index) }]
      : []
  );
}

function orderLookup(folio, data, lines, session) {
  const matching = entries(data).filter((item) => upper(item.row[0]) === upper(folio));
  if (matching.length > 1) error(409, 'Este folio requiere conciliación de cabeceras duplicadas.');
  const header = matching[0];
  if (!header || header.row[11] === 'Eliminada') error(404, 'Orden de compra no encontrada.');
  requireUnit(session, header.row[5]);
  const items = entries(lines).filter((item) => upper(item.row[0]) === upper(folio));
  const record = orderRecord(header.row, items);
  if (new Set(record.lines.map((line) => line.id)).size !== record.lines.length) {
    error(409, 'Este folio requiere conciliación de partidas duplicadas.');
  }
  return { header, items, record };
}

function auditRow(session, operationId, action, folio, detail = '') {
  return append(PURCHASE_TABS.audit, [[
    operationId, timestamp().iso, session.userName, 'Compras', action, detail, folio, session.role + ' · ' + session.userId,
  ]]);
}

function mutate(action, body, session, sheets) {
  const operationId = field(body.operationId, 36, 'operación', true).toLowerCase();
  if (!OP_ID.test(operationId)) error(400, 'Identificador de operación inválido.');
  const key = 'compras:' + hash([session.userId, action, operationId]);
  const operation = { ...body };
  delete operation.expectedUserId;
  const fingerprint = hash([session.userId, action, operation]);
  return {
    operationId, key, fingerprint, version: sheets.nativeOperations ? hash(key) : operationId,
    async replay() {
      return sheets.replay({ key, fingerprint });
    },
    async commit(writes, result, guards = []) {
      const committed = await sheets.commit({ key, fingerprint, guards: [...new Set(guards)], writes, result });
      return ok(committed.result);
    },
  };
}

function checkVersion(body, record) {
  if (trim(body.version) !== record.version) error(409, 'El registro cambió. Actualiza la pantalla y revisa los datos.');
}

const orderGuard = (record) => 'oc:' + record.folio + ':' + record.version;
const requestGuard = (record) => 'ped:' + record.id + ':' + record.version;

function requestUpdate(entry, version, actor, ocFolio, status, previous) {
  const row = [...entry.row];
  row[6] = status;
  row[15] = entry.record.id;
  row[16] = ocFolio;
  row[17] = version;
  row[18] = actor;
  row[19] = previous;
  row[20] = timestamp().iso;
  return wholeRow(PURCHASE_TABS.requests, entry.index, Array.from(row, (value) => value ?? ''));
}

const normalizeCatalogKey = value => upper(value).normalize('NFD').replace(/\p{Diacritic}/gu, '');
const normalizeModel = value => normalizeCatalogKey(value).replace(/[^A-Z0-9]/g, '');

function catalogPart(rows, sku, required = true) {
  const headerIndex = rows.findIndex(row => normalizeCatalogKey(row[0]) === 'SKU' && normalizeCatalogKey(row[5]) === 'STOCK');
  if (headerIndex < 0) error(409, 'El catálogo no tiene un encabezado de existencias verificable.');
  const matching = rows.flatMap((row, index) => index > headerIndex && upper(row[0]) === upper(sku) ? [{ row, index }] : []);
  if (matching.length > 1) error(409, 'El SKU aparece varias veces en el catálogo. Concilia antes de continuar.');
  if (!matching.length && required) error(409, 'El SKU no está en el catálogo. Verifica el repuesto o usa la solicitud manual.');
  return matching[0];
}

function assertCompatible(part, fleet, unit) {
  const equipment = fleet.filter(row => upper(row[1]) === unit);
  if (equipment.length !== 1) error(409, 'La unidad no se pudo conciliar con la flota.');
  const unitKey = normalizeModel(unit);
  const model = normalizeModel(equipment[0][4]);
  const makeAndModel = normalizeModel([equipment[0][3], equipment[0][4]].join(' '));
  const supported = trim(part.row[10]).split(/[,;\n]+/).map(normalizeModel).filter(Boolean);
  if (!supported.some(key => key === unitKey || key === model || (model && key === makeAndModel))) {
    error(409, 'La compatibilidad de este repuesto con la unidad no está verificada. Revisa el catálogo.');
  }
}

function movementRecord(row) {
  return {
    id: trim(row[0]), at: trim(row[1]), kind: trim(row[2]), partNumber: trim(row[3]), quantity: trim(row[4]),
    unit: trim(row[5]), order: trim(row[6]), lineId: trim(row[7]), ot: trim(row[8]), reference: trim(row[9]),
    by: trim(row[10]), actorId: trim(row[11]), stockAfter: trim(row[12]), measurementUnit: trim(row[13]),
  };
}

function inventoryWrites({ part, nextStock, session, tx, kind, amount, unit, folio = '', lineId = '', ot = '', reference }) {
  return [
    { tab: PURCHASE_TABS.catalog, row: part.index, col: 5, values: [quantity(nextStock)] },
    append(PURCHASE_TABS.inventoryMovements, [[
      tx.version, timestamp().iso, kind, part.row[0], quantity(amount), unit, folio, lineId, ot, reference,
      session.userName, session.userId, quantity(nextStock), part.row[4] || '',
    ]]),
  ];
}

// Guard by the last committed operation, not by quantity. An issue followed by a
// return can restore the same numerical balance and must still permit new writes.
function inventoryGuard(part, history) {
  const last = history.findLast(row => upper(row[3]) === upper(part.row[0]));
  return 'stock:' + hash([upper(part.row[0]), last?.[0] ?? 'initial']);
}

async function stockForWriting(sheets, part) {
  const source = await sheets.read(PURCHASE_TABS.catalog, { valueRenderOption: 'FORMULA', requireExisting: true });
  const raw = source[part.index];
  if (upper(raw?.[0]) !== upper(part.row[0])) error(409, 'La ubicación del SKU cambió. Actualiza el catálogo y revisa.');
  if (trim(raw[5]).startsWith('=')) error(409, 'La existencia se calcula con una fórmula. Registra el movimiento en la fuente que alimenta esa fórmula.');
  const available = decimal(part.row[5], 3, 'existencia confirmada');
  if (decimal(raw[5], 3, 'existencia del maestro') !== available) error(409, 'La existencia cambió. Actualiza el catálogo y revisa.');
  return available;
}

async function moveInventory(body, session, sheets, tx) {
  const kind = body.kind;
  if (!['Salida', 'Devolución'].includes(kind)) error(400, 'Selecciona salida o devolución.');
  const ot = upper(field(body.ot, 90, 'OT', true));
  const sku = field(body.partNumber, 120, 'SKU', true);
  const amount = decimal(body.quantity, 3, 'movimiento', true);
  const reference = field(body.reference, 160, 'referencia del movimiento', true);
  const [movements, orders, fleet] = await Promise.all([
    sheets.read(PURCHASE_TABS.inventoryMovements), sheets.read('ORDENES_TRABAJO'), sheets.read('01 Inventario'),
  ]);
  const stock = await sheets.read(PURCHASE_TABS.catalog);
  const matches = entries(orders).filter(({ row }) => upper(row[1]) === ot);
  if (matches.length !== 1) error(404, 'La OT no está disponible para registrar repuestos.');
  const order = matches[0];
  const unit = requireUnit(session, order.row[3]);
  if (kind === 'Salida' && ['COMPLETADO','CANCELADO'].includes(normalizeCatalogKey(order.row[9]))) {
    error(409, 'No puedes sacar repuestos para una OT cerrada.');
  }
  const part = catalogPart(stock, sku);
  if (kind === 'Salida') assertCompatible(part, fleet, unit);
  const available = await stockForWriting(sheets, part);
  if (kind === 'Salida' && amount > available) error(409, 'La cantidad supera la existencia.');
  const history = entries(movements).map(({ row }) => row);
  const related = history.filter(row => upper(row[3]) === upper(sku) && upper(row[8]) === ot);
  if (related.some(row => row[2] === kind && upper(row[9]) === upper(reference))) {
    error(409, 'La referencia ya está registrada para este repuesto y OT.');
  }
  const issued = related.reduce((sum, row) =>
    sum + (row[2] === 'Salida' ? 1n : -1n) * decimalCell(row[4], 3, 'movimiento anterior'), 0n);
  if (kind === 'Devolución' && amount > issued) error(409, 'La devolución supera lo entregado a esta OT.');
  const nextStock = available + (kind === 'Salida' ? -amount : amount);
  const guards = [inventoryGuard(part, history)];
  const writes = inventoryWrites({ part, nextStock, session, tx, kind, amount, unit, ot, reference });
  if (kind === 'Salida' && sheets.nativeOperations) {
    guards.push(orderWriteGuard(order.row));
    writes.push({ tab: 'ORDENES_TRABAJO', row: order.index, col: 18, values: [tx.version] });
  }
  return tx.commit([
    ...writes,
    auditRow(session, tx.operationId, kind + ' de repuesto', ot, part.row[0] + ' · ' + quantity(amount)),
  ], { id: tx.operationId, stock: quantity(nextStock), ot }, guards);
}

async function submitRequest(body, session, sheets, tx) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    error(400, 'Agrega entre 1 y 100 partidas al pedido.');
  }
  const now = timestamp();
  const folio = 'PED-' + hash(tx.key).slice(0, 18).toUpperCase();
  const panamaCatalog = session.project === 'tmf-panama' && body.items.some(item => item?.isManual !== true);
  const [stock, fleet] = panamaCatalog
    ? await Promise.all([sheets.read(PURCHASE_TABS.catalog), sheets.read('01 Inventario')])
    : [[], []];
  const rows = body.items.map((item, index) => {
    const part = field(item.part_number, 120, 'número de parte', true);
    const description = field(item.description, 500, 'descripción', true);
    const qty = decimal(item.quantity, 3, 'pedido', true);
    const unitPrice = decimal(item.unit_price ?? 0, 2, 'precio unitario');
    const unit = requireUnit(session, field(item.equipment, 48, 'unidad', true));
    if (panamaCatalog && item.isManual !== true) assertCompatible(catalogPart(stock, part), fleet, unit);
    const source = item.isManual === true ? 'Manual' : field(item.source, 120, 'origen') || 'Catálogo';
    const priority = ['Normal', 'Urgente', 'Crítico'].includes(item.urgencia) ? item.urgencia : 'Normal';
    return [
      now.date, part, description, unit, quantity(qty), source, 'Pendiente', '', '', folio, now.time, session.userName,
      priority, field(item.notes, 1000, 'notas'), money(lineCost(qty, unitPrice)), folio + '-L' + (index + 1),
      '', tx.version, session.userId, '', now.iso, money(unitPrice),
    ];
  });
  await validateOperationalUnits(sheets, ...rows.map(row => row[3]));
  return tx.commit([
    append(PURCHASE_TABS.requests, rows),
    auditRow(session, tx.operationId, 'Pedido creado', folio, rows.length + ' partidas'),
  ], { folio, count: rows.length });
}

async function changeRequest(body, session, sheets, tx) {
  const id = field(body.id, 100, 'partida', true);
  const entry = parseRequests(await sheets.read(PURCHASE_TABS.requests)).find(({ record }) => record.id === id);
  if (!entry) error(404, 'Partida de pedido no encontrada.');
  const { record } = entry;
  requireUnit(session, record.equipo);
  checkVersion(body, record);
  if (record.ocFolio) error(409, 'Actualiza la partida desde la orden de compra vinculada.');
  const status = record.estado === 'Pendiente' ? 'Pedido' : record.estado === 'Pedido' ? 'Completado' : '';
  if (!status || body.status !== status) error(409, 'Cambio de estado no válido para esta partida.');
  const write = requestUpdate(entry, tx.version, session.userId, '', status, '');
  return tx.commit([
    write, auditRow(session, tx.operationId, 'Estado de partida de pedido', id, record.estado + ' → ' + status),
  ], { id, status, version: tx.version }, [requestGuard(record)]);
}

function requireDraft(order) {
  if (order.status !== 'Borrador') error(409, 'Solo se pueden editar partidas de un borrador.');
}

function buildOrderLines(body, unit, folio, current, requests, session) {
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100) {
    error(400, 'Agrega entre 1 y 100 partidas a la orden.');
  }
  const used = new Set();
  const usedRequests = new Set();
  return body.lines.map((line, index) => {
    const existing = current?.record.lines.find((old) => old.id === line.id);
    if (line.id && !existing) error(409, 'La partida de la orden cambió. Actualiza antes de guardar.');
    const id = existing?.id || folio + '-L' + hash([body.operationId, index]).slice(0, 14);
    if (used.has(id)) error(400, 'Hay partidas de la orden repetidas.');
    used.add(id);
    const requestLineId = field(line.requestLineId, 100, 'partida de pedido');
    const request = requestLineId ? requests.find((entry) => entry.record.id === requestLineId) : null;
    if (requestLineId && !request) error(404, 'La partida del pedido ya no está disponible.');
    const qty = decimal(line.quantity, 3, 'partida', true);
    const price = decimal(line.unitPrice, 2, 'precio unitario');
    if (request) {
      if (usedRequests.has(requestLineId)) error(409, 'Cada partida del pedido se puede convertir una sola vez.');
      usedRequests.add(requestLineId);
      const record = request.record;
      requireUnit(session, record.equipo);
      if (upper(record.equipo || 'FLOTA') !== unit) error(409, 'La unidad de la OC debe coincidir con la del pedido.');
      if (record.estado === 'Completado' || (record.ocFolio && record.ocFolio !== folio)) {
        error(409, 'La partida del pedido ya tiene una orden o está completada.');
      }
      if (qty !== decimalCell(record.cantidad, 3, 'pedido', true)) {
        error(409, 'La cantidad de la partida vinculada debe coincidir con la solicitada.');
      }
    }
    return {
      id, qty, price, request, requestLineId,
      partNumber: request?.record.partNum || field(line.partNumber, 120, 'número de parte'),
      description: request?.record.descripcion || field(line.description, 500, 'descripción', true),
      number: index + 1,
    };
  });
}

async function saveOrder(body, session, sheets, tx) {
  const [orderRows, lineRows, vendorRows, requestRows] = await readTables(
    sheets, PURCHASE_TABS.orders, PURCHASE_TABS.lines, PURCHASE_TABS.vendors, PURCHASE_TABS.requests,
  );
  const folio = upper(field(body.folio, 90, 'folio')) || 'OC-' + hash(tx.key).slice(0, 18).toUpperCase();
  const current = body.folio ? orderLookup(folio, orderRows, lineRows, session) : null;
  if (current) {
    requireDraft(current.record);
    checkVersion(body, current.record);
  } else if ([...entries(orderRows), ...entries(lineRows)].some(({ row }) => upper(row[0]) === folio)) {
    error(409, 'El folio ya existe en cabeceras o partidas. Se requiere conciliación.');
  }
  const unit = requireUnit(session, body.unit);
  await validateOperationalUnits(sheets, unit);
  const panama = session.project === 'tmf-panama';
  const issuer = configuredIssuers(session).find((item) => item.id === body.entity);
  if (!issuer) error(400, 'Selecciona una entidad emisora configurada.');
  const vendor = orderVendor(body, vendorRows, panama);
  const date = calendarDate(body.date, 'la orden', true);
  const deliveryDate = calendarDate(body.deliveryDate, 'entrega', false);
  const requests = parseRequests(requestRows);
  const items = buildOrderLines(body, unit, folio, current, requests, session);
  const subtotal = items.reduce((sum, line) => sum + lineCost(line.qty, line.price), 0n);
  const discount = panama ? decimal(body.discount ?? '0', 2, 'descuento') : 0n;
  if (discount > subtotal) error(400, 'El descuento debe ser menor o igual al subtotal.');
  const netSubtotal = subtotal - discount;
  const tax = panama && (session.previewDemo !== true || body.tax != null)
    ? decimal(body.tax, 2, 'ITBMS según documento')
    : (netSubtotal * BigInt(issuer.taxBps) + 5000n) / 10000n;
  const shipping = decimal(body.shipping ?? '0', 2, 'envío');
  const other = decimal(body.other ?? '0', 2, 'otros cargos');
  const total = netSubtotal + tax + shipping + other;
  const now = timestamp();
  const values = [
    folio, date, vendor.name, vendor.rfc, vendor.address, unit, money(subtotal), money(tax), money(shipping), money(other), money(total),
    'Borrador', field(body.comments, 2000, 'comentarios'), '', deliveryDate, tx.version, JSON.stringify(issuer),
    '', '', current?.header.row[19] || session.userId, current?.header.row[20] || session.userName, now.iso,
    ...(panama ? [current?.header.row[22] || '', current?.header.row[23] || '', current?.header.row[24] || '', money(discount), vendor.source] : []),
  ];
  const orderWrite = current ? wholeRow(PURCHASE_TABS.orders, current.header.index, values) : append(PURCHASE_TABS.orders, [values]);
  const writes = [orderWrite];
  const newLines = [];
  const lineRowsById = new Map(current?.items.map((item) => [ocLine(item.row).id, item]) || []);
  for (const item of items) {
    const line = [
      folio, String(item.number), item.description, quantity(item.qty), money(item.price), money(lineCost(item.qty, item.price)),
      item.id, item.request?.record.pedidoId || '', item.requestLineId, item.partNumber, '0', '[]',
    ];
    const old = lineRowsById.get(item.id);
    if (old) {
      writes.push(wholeRow(PURCHASE_TABS.lines, old.index, line));
      lineRowsById.delete(item.id);
    } else {
      newLines.push(line);
    }
  }
  if (newLines.length) writes.push(append(PURCHASE_TABS.lines, newLines));
  for (const old of lineRowsById.values()) {
    writes.push(wholeRow(PURCHASE_TABS.lines, old.index, Array(Math.max(12, old.row.length)).fill('')));
  }
  const guards = current ? [orderGuard(current.record)] : ['oc:create:' + folio];
  const linked = new Set(items.map((item) => item.requestLineId).filter(Boolean));
  for (const entry of requests) {
    if (linked.has(entry.record.id) && entry.record.ocFolio !== folio) {
      writes.push(requestUpdate(entry, tx.version, session.userId, folio, 'Pedido', entry.record.estado));
      guards.push(requestGuard(entry.record));
    }
    if (entry.record.ocFolio === folio && !linked.has(entry.record.id)) {
      writes.push(requestUpdate(entry, tx.version, session.userId, '', entry.row[19] || 'Pendiente', ''));
      guards.push(requestGuard(entry.record));
    }
  }
  writes.push(auditRow(session, tx.operationId, current ? 'OC editada' : 'OC creada', folio, items.length + ' partidas'));
  return tx.commit(writes, { folio, total: money(total), version: tx.version }, guards);
}

async function changeOrder(action, body, session, sheets, tx) {
  const folio = field(body.folio, 90, 'folio', true);
  const [orderRows, lineRows, requestRows] = await readTables(
    sheets, PURCHASE_TABS.orders, PURCHASE_TABS.lines, PURCHASE_TABS.requests,
  );
  const { record, header, items } = orderLookup(folio, orderRows, lineRows, session);
  if (action === 'order-receive' && session.project === 'tmf-panama') {
    const previous = await tx.replay();
    if (previous !== null) return ok(previous);
  }
  checkVersion(body, record);
  const guards = [orderGuard(record)];
  const values = [...header.row];
  values[15] = tx.version;
  values[21] = timestamp().iso;
  const writes = [];
  const requests = parseRequests(requestRows);
  const panama = session.project === 'tmf-panama';
  let detail = record.status;
  let auditAction;

  if (action === 'order-delete') {
    if (!['Borrador', 'Rechazada'].includes(record.status) || record.receiptStatus !== 'Pendiente') {
      error(409, 'La OC tiene un compromiso o recepción y requiere conservar su registro.');
    }
    values[11] = 'Eliminada';
  } else if (action === 'order-status') {
    const status = field(body.status, 32, 'estado', true);
    const allowed = {
      Borrador: ['Aprobada', 'Rechazada'],
      Aprobada: [...(panama ? [] : ['Pagada']), ...(record.receiptStatus === 'Pendiente' ? ['Rechazada'] : [])],
      'Recibida parcial': panama ? [] : ['Pagada'],
      Recibida: panama ? [] : ['Pagada'],
    };
    if (panama && status === 'Pagada') error(403, 'El pago conciliado lo registra Tesorería en su flujo.');
    if (!allowed[record.status]?.includes(status)) error(409, 'Cambio de estado no válido para esta orden.');
    if (panama) {
      const reason = field(body.reason, 1000, 'soporte o motivo de la decisión', true);
      values[22] = reason;
      detail += ' → ' + status + ' · ' + reason;
    }
    if (status === 'Aprobada') {
      if (!record.issuer || !record.lines.length || !record.vendorName) error(409, 'Completa la entidad, el proveedor y las partidas.');
      if (panama && record.vendorSource === 'manual') error(409, 'Selecciona el proveedor del catálogo en el borrador antes de aprobar.');
      values[13] = session.userName;
      values[17] = session.userId;
      values[18] = timestamp().iso;
    }
    if (status === 'Pagada' && !record.approvedById) error(409, 'La orden requiere un aprobador registrado.');
    values[11] = status;
  } else if (action === 'order-invoice' || action === 'order-payment') {
    const invoice = action === 'order-invoice';
    if (!hasRecordedApproval(record) || record.status !== 'Recibida' || record.receiptStatus !== 'Recibida' || !record.issuer) {
      error(409, 'Confirma todas las recepciones y la aprobación antes de conciliar la factura o el pago.');
    }
    if (record.approvedById === session.userId || record.lines.some(line => line.receipts.some(receipt => receipt.actorId === session.userId))) {
      error(403, 'La conciliación requiere una cuenta distinta de quien aprobó o recibió.');
    }
    const reference = field(body.reference, 160, invoice ? 'folio de factura' : 'referencia de pago', true);
    const amount = decimal(body.amount, 2, invoice ? 'factura' : 'pago', true);
    if (amount !== decimalCell(record.total, 2, 'total de OC', true)) {
      error(409, 'El importe debe coincidir con el total de la OC. Concilia las diferencias antes de registrar.');
    }
    const column = invoice ? 23 : 24;
    if (invoice ? record.invoice : record.payment) error(409, 'Esta orden ya tiene un registro de conciliación.');
    if (!invoice && !record.invoice) error(409, 'Vincula primero la factura conciliada.');
    if (!invoice && record.invoice.actorId === session.userId) error(403, 'El pago requiere una cuenta distinta de quien registró la factura.');
    const identity = [record.issuer.id, invoice ? upper(record.vendorRfc || record.vendorName) : '', upper(reference)];
    guards.push((invoice ? 'oc-invoice:' : 'oc-payment:') + hash(identity));
    const existing = entries(orderRows).some(({ row }) => {
      if (row === header.row || !row[column] || issuerSnapshot(row)?.id !== record.issuer.id) return false;
      if (invoice && upper(row[3] || row[2]) !== identity[1]) return false;
      return upper(recordedDocument(row[column])?.reference) === identity[2];
    });
    if (existing) error(409, 'Esta referencia ya está vinculada a otra orden.');
    values[column] = JSON.stringify({
      reference, amount: money(amount), currency: record.issuer.currency,
      at: timestamp().iso, by: session.userName, actorId: session.userId,
      ...(!invoice ? { invoiceReference: record.invoice.reference } : {}),
    });
    if (!invoice) values[11] = 'Pagada';
    detail = reference + ' · ' + record.issuer.currency + ' ' + money(amount);
    auditAction = invoice ? 'Factura de OC conciliada' : 'Pago de OC conciliado';
  } else {
    if (panama && record.approvedById === session.userId) error(403, 'La recepción requiere una cuenta distinta de quien aprobó la OC.');
    if (!['Aprobada', 'Recibida parcial', 'Pagada'].includes(record.status) || !record.approvedById
      || (session.project === 'tmf-panama' && !hasRecordedApproval(record))) {
      error(409, 'La orden necesita una aprobación registrada y saldo por recibir.');
    }
    const lineId = field(body.lineId, 120, 'partida', true);
    const idx = items.findIndex((item) => ocLine(item.row).id === lineId);
    if (idx < 0) error(404, 'Partida de orden no encontrada.');
    const item = items[idx];
    const line = ocLine(item.row);
    const received = decimalCell(line.received, 3, 'recibido');
    const requested = decimalCell(line.quantity, 3, 'ordenado', true);
    const increment = decimal(body.quantity, 3, 'recepción', true);
    const newReceived = received + increment;
    if (newReceived > requested) error(409, 'La cantidad supera el saldo por recibir.');
    const reference = field(body.reference, 160, 'referencia o remisión', panama);
    if (panama && line.receipts.some(receipt => upper(receipt.reference) === upper(reference))) {
      error(409, 'Esta remisión ya se registró para la partida. Consulta el historial.');
    }
    const receipt = {
      id: tx.version, at: timestamp().iso, by: session.userName, actorId: session.userId,
      quantity: quantity(increment), reference,
    };
    if (panama) receipt.stockDisposition = line.partNumber ? 'unregistered' : 'document';
    if (panama && line.partNumber) {
      const history = entries(await sheets.read(PURCHASE_TABS.inventoryMovements)).map(({ row }) => row);
      const part = catalogPart(await sheets.read(PURCHASE_TABS.catalog), line.partNumber, false);
      if (part) {
        receipt.stockDisposition = 'posted';
        const nextStock = await stockForWriting(sheets, part) + increment;
        writes.push(...inventoryWrites({ part, nextStock, session, tx, kind: 'Recepción', amount: increment,
          unit: record.unit, folio, lineId, reference }));
        guards.push(inventoryGuard(part, history));
      }
    }
    const receipts = JSON.stringify([...line.receipts, receipt]);
    if (receipts.length > 45000) error(409, 'El historial de la partida requiere archivarse antes de recibir más.');
    writes.push(wholeRow(PURCHASE_TABS.lines, item.index, [...item.row.slice(0, 10), quantity(newReceived), receipts]));
    const full = newReceived === requested && record.lines.every((other) =>
      other.id === lineId || decimalCell(other.received, 3, 'recibido') >= decimalCell(other.quantity, 3, 'ordenado', true));
    values[11] = record.status === 'Pagada' ? 'Pagada' : full ? 'Recibida' : 'Recibida parcial';
    if (newReceived === requested && line.requestLineId) {
      const request = requests.find((entry) => entry.record.id === line.requestLineId && entry.record.ocFolio === folio);
      if (!request) error(409, 'Falta conciliar el vínculo entre la partida recibida y el pedido.');
      writes.push(requestUpdate(request, tx.version, session.userId, folio, 'Completado', request.row[19] || ''));
      guards.push(requestGuard(request.record));
    }
    detail = lineId + ' · ' + quantity(increment) + ' recibida(s), saldo ' + quantity(requested - newReceived);
  }

  if (values[11] === 'Eliminada' || values[11] === 'Rechazada') {
    for (const entry of requests.filter((request) => request.record.ocFolio === folio)) {
      writes.push(requestUpdate(entry, tx.version, session.userId, '', entry.row[19] || 'Pendiente', ''));
      guards.push(requestGuard(entry.record));
    }
  }
  writes.push(wholeRow(PURCHASE_TABS.orders, header.index, Array.from(values, (value) => value ?? '')));
  writes.push(auditRow(session, tx.operationId, auditAction || (action === 'order-receive' ? 'Recepción de partida' : 'Estado de OC ' + values[11]), folio, detail));
  return tx.commit(writes, { folio, status: values[11], version: tx.version }, guards);
}

function expenseItems(lines) {
  if (!Array.isArray(lines) || lines.length > 100) error(400, 'Revisa las partidas del gasto.');
  return lines.map((item) => {
    const partNumber = field(item.part_number, 120, 'número de parte').replace(/[\[\]\|]/g, ' ');
    const description = field(item.description, 300, 'descripción', true).replace(/\|/g, ' ');
    const qty = decimal(item.qty, 3, 'partida de gasto', true);
    const unitPrice = decimal(item.unit_price, 2, 'precio unitario de gasto');
    return (partNumber ? '[' + partNumber + '] ' : '') + description + ' x' + quantity(qty) + ' $' + money(lineCost(qty, unitPrice));
  }).join(' | ');
}

function distributeTax(allocations, tax, total) {
  const shares = allocations.map((allocation, index) => ({
    ...allocation, index, tax: allocation.amount * tax / total, remainder: allocation.amount * tax % total,
  }));
  let remainder = tax - shares.reduce((sum, allocation) => sum + allocation.tax, 0n);
  const sorted = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const share of sorted) {
    if (!remainder) break;
    share.tax++;
    remainder--;
  }
  return shares;
}

function canReviewPanamaExpense(session) {
  return session.role === 'gerencia' && new Set(
    (process.env.HERMES_PANAMA_EXPENSE_REVIEWER_IDS ?? '').split(',').map(trim).filter(Boolean),
  ).has(session.userId);
}

function expenseMonth(value) {
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trim(value));
  return local ? local[3] + '-' + local[2] : /^(\d{4}-(?:0[1-9]|1[0-2])-\d{2})(?:T.*)?$/.exec(trim(value))?.[1]?.slice(0, 7) ?? '';
}

function closedExpensePeriod() {
  const cutoff = trim(process.env.HERMES_PANAMA_EXPENSE_CLOSED_THROUGH);
  if (cutoff && !/^\d{4}-(0[1-9]|1[0-2])$/.test(cutoff)) error(503, 'El cierre de períodos requiere revisión de configuración.');
  return cutoff;
}

function requireOpenExpensePeriod(documentDate, now = timestamp()) {
  const month = expenseMonth(documentDate);
  if (!month) error(409, 'Confirma el período del documento con Contabilidad.');
  const cutoff = closedExpensePeriod();
  if ((cutoff && month <= cutoff) || (!cutoff && month < expenseMonth(now.date))) {
    error(409, 'El período está cerrado o pendiente de confirmar. Tramita el ajuste con Contabilidad.');
  }
}

function expenseOptions(session) {
  return {
    entities: configuredIssuers(session).map(({ id, name, currency, taxLabel }) => ({ id, name, currency, taxLabel })),
    canReview: session.project === 'tmf-panama' && canReviewPanamaExpense(session),
    closedThrough: session.project === 'tmf-panama' ? closedExpensePeriod() : '',
  };
}

async function saveExpense(body, session, sheets, tx, evidenceStorage) {
  const expense = body.expense ?? {};
  const type = field(expense.tipo, 30, 'tipo de gasto', true);
  const method = field(expense.metodo_pago, 30, 'método de pago', true);
  if (!['Refaccion', 'Combustible', 'Servicio', 'Otro'].includes(type) || !['Efectivo', 'Transferencia', 'Tarjeta'].includes(method)) {
    error(400, 'Revisa el tipo de gasto y el método de pago.');
  }
  const vendor = field(expense.proveedor, 180, 'proveedor', true);
  const subtotal = decimal(expense.subtotal, 2, 'subtotal');
  const tax = decimal(expense.iva, 2, 'impuesto del documento');
  const total = decimal(expense.total, 2, 'total', true);
  if (subtotal + tax !== total) error(400, 'El subtotal y el impuesto deben sumar el total.');
  if (!Array.isArray(body.allocations) || !body.allocations.length || body.allocations.length > 100) {
    error(400, 'Indica cómo se reparte el gasto.');
  }
  const allocations = body.allocations.map((allocation) => ({
    unit: requireUnit(session, allocation.unit),
    amount: decimal(allocation.amount, 2, 'reparto', true),
  }));
  if (new Set(allocations.map((allocation) => allocation.unit)).size !== allocations.length ||
      allocations.reduce((sum, allocation) => sum + allocation.amount, 0n) !== total) {
    error(400, 'Las unidades deben ser distintas y sus importes deben sumar el total.');
  }
  await validateOperationalUnits(sheets, ...allocations.map(({ unit }) => unit));
  const panama = session.project === 'tmf-panama';
  const image = field(expense.imagen_url, 1200, 'recibo');
  if (image && panama) {
    await verifyEvidence([image], { kind: 'receipt', units: allocations.map(({ unit }) => unit), operationId: tx.operationId,
      session, storage: evidenceStorage });
  } else if (image) {
    const allowed = trim(process.env.HERMES_EXPENSE_RECEIPT_URL_PREFIX);
    if (!allowed) error(409, 'Los adjuntos de Gastos están pendientes de activar. Conserva el recibo en el canal vigente de Compras.');
    const source = parseHttpsUrl(allowed);
    const receipt = parseHttpsUrl(image);
    if (!source || !receipt || receipt.origin !== source.origin || !receipt.pathname.startsWith(source.pathname.replace(/\/?$/, '/'))) {
      error(400, 'El recibo debe estar en el almacenamiento autorizado.');
    }
  }
  const items = expenseItems(expense.line_items);
  const now = timestamp();
  const issuer = panama ? configuredIssuers(session).find(({ id }) => id === expense.entity) : null;
  if (panama && (!issuer || expense.currency !== issuer.currency)) error(400, 'Selecciona la entidad y moneda autorizadas para el documento.');
  const documentDate = panama ? calendarDate(expense.document_date, 'documento', true) : now.date;
  if (panama) {
    const [day, month, year] = now.date.split('/');
    if (expense.document_date > [year, month, day].join('-')) error(400, 'La fecha del documento no puede ser futura.');
    requireOpenExpensePeriod(documentDate, now);
  }
  const folio = 'GST-' + hash(tx.key).slice(0, 18).toUpperCase();
  const rfc = field(expense.rfc_proveedor, 60, 'identificación del proveedor');
  const invoice = field(expense.folio_factura, 120, 'factura');
  const ot = field(expense.ot_id, 90, 'orden de trabajo');
  const rows = distributeTax(allocations, tax, total).map((allocation, index) => [
    folio + '-' + (index + 1), documentDate, now.time, type, vendor, rfc, invoice,
    money(allocation.amount - allocation.tax), money(allocation.tax), money(allocation.amount), allocation.unit,
    ot, session.userName, method, items, image, panama ? 'Pendiente' : 'Aprobado', folio, session.userId, money(total), tx.operationId,
    ...(issuer ? [issuer.id, issuer.currency, issuer.taxLabel, documentDate, '', '', '', now.iso] : []),
  ]);
  return tx.commit([
    append(PURCHASE_TABS.expenses, rows),
    auditRow(session, tx.operationId, 'Gasto registrado', folio, allocations.length + ' unidad(es)'),
  ], { folio, ids: rows.map((row) => row[0]) });
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

async function changeExpense(action, body, session, sheets, tx) {
  const id = field(body.id, 100, 'gasto', true);
  const rows = entries(await sheets.read(PURCHASE_TABS.expenses));
  const matches = rows.filter(({ row }) => trim(row[0]) === id);
  if (matches.length > 1) error(409, 'El folio de gasto requiere conciliación.');
  const entry = matches[0];
  if (!entry || entry.row[16] === 'Eliminado') error(404, 'Gasto no encontrado.');
  const group = trim(entry.row[17]);
  const affected = group ? rows.filter(({ row }) => trim(row[17]) === group && row[16] !== 'Eliminado') : [entry];
  const review = action === 'expense-review';
  const panama = session.project === 'tmf-panama';
  const status = review ? body.status : 'Eliminado';
  if (review && !['Aprobado', 'Rechazado'].includes(status)) error(400, 'Indica el resultado de la revisión.');
  for (const { row } of affected) {
    requireUnit(session, row[10]);
    if (!panama) continue;
    requireOpenExpensePeriod(row[24] || row[1]);
    if (review && row[18] === session.userId) error(403, 'La captura debe revisarla otra persona.');
    if (review && !trim(row[18])) error(409, 'El gasto requiere conciliar su autor antes de revisarlo.');
    if (row[16] !== 'Pendiente' || !row[21] || !row[22]) error(409, 'El gasto requiere ajuste documentado con Contabilidad.');
    if (!review && row[18] !== session.userId) error(403, 'Solo quien capturó el gasto pendiente puede anularlo.');
  }
  const reason = field(body.reason, 350, 'motivo', review);
  const now = timestamp();
  const ids = affected.map(({ row }) => row[0]);
  const changes = affected.flatMap(({ index }) => [
    { tab: PURCHASE_TABS.expenses, row: index, col: 16, values: [status] },
    ...(review ? [{ tab: PURCHASE_TABS.expenses, row: index, col: 25, values: [session.userId, now.iso, reason] }] : []),
  ]);
  return tx.commit([
    ...changes,
    auditRow(session, tx.operationId, review ? 'Gasto ' + status.toLowerCase() : 'Gasto eliminado',
      group || id, (review ? 'Pendiente → ' + status + ' · ' + reason : affected.length + ' unidad(es)')),
  ], { id, status, ...(review ? { ids } : { removed: ids }) },
  affected.map(({ row }) => 'gst:' + row[0] + ':' + hash(row)));
}

const WRITES = new Set(['request-submit', 'request-status', 'order-save', 'order-status', 'order-receive', 'order-invoice', 'order-payment', 'order-delete', 'inventory-move', 'expense-save', 'expense-delete', 'expense-review']);
const READS = new Set(['orders', 'order', 'receiving', 'requests', 'expenses', 'inventory-movements', 'expense-options']);

export async function dispatchPurchasing({ path, method, body = {}, query = {}, session, sheets, evidenceStorage }) {
  const action = path.replace(/^api\/purchasing\//, '');
  let tx;
  try {
    if (!session?.userId || !session?.userName) error(401, 'Inicia sesión para continuar.');
    if (!READS.has(action) && !WRITES.has(action)) error(404, 'Ruta de compras desconocida.');
    if (READS.has(action) ? method !== 'GET' : method !== 'POST') error(405, 'Método no permitido.');
    const panama = session.project === 'tmf-panama';
    const warehouseAccess = panama && session.canReceivePurchases === true && session.canApprovePurchases !== true;
    const accountingAccess = panama && session.role === 'gerencia' && session.canApprovePurchases !== true && session.canReceivePurchases !== true;
    const invoiceAccess = accountingAccess && session.canRecordPurchaseInvoices === true && session.canRecordPurchasePayments !== true;
    const paymentAccess = accountingAccess && session.canRecordPurchasePayments === true && session.canRecordPurchaseInvoices !== true;
    const roleAllowed = action === 'receiving' ? warehouseAccess
      : action === 'order-receive' ? (panama ? warehouseAccess : session.role === 'gerencia')
      : action === 'inventory-move' ? warehouseAccess
      : action === 'inventory-movements' ? panama && (warehouseAccess || REQUEST_ROLES.has(session.role))
      : action === 'order-invoice' ? invoiceAccess
      : action === 'order-payment' ? paymentAccess
      : action === 'requests' ? REQUEST_ROLES.has(session.role)
      : action === 'request-submit' ? session.role === 'jefe_taller'
      : action === 'expense-review' ? panama && canReviewPanamaExpense(session)
      : action === 'expenses' || action.startsWith('expense-') ? EXPENSE_ROLES.has(session.role) : session.role === 'gerencia';
    if (!roleAllowed || (action === 'order-status' && session.canApprovePurchases !== true)) {
      error(403, 'Tu cuenta no tiene permiso para realizar esta acción.');
    }
    if (action === 'inventory-movements') {
      const ot = upper(field(query.ot, 90, 'OT'));
      const rows = entries(await sheets.read(PURCHASE_TABS.inventoryMovements));
      const items = rows.map(({ row }) => movementRecord(row))
        .filter(item => item.id && canUseUnit(session, item.unit) && (!ot || upper(item.ot) === ot));
      return ok({ items: items.reverse() });
    }
    if (action === 'requests') {
      const data = parseRequests(await sheets.read(PURCHASE_TABS.requests));
      return ok({ items: data.filter(({ record }) => canUseUnit(session, record.equipo)).map(({ record }) => record).reverse() });
    }
    if (action === 'expense-options') return ok(expenseOptions(session));
    if (action === 'expenses') {
      const rows = entries(await sheets.read(PURCHASE_TABS.expenses));
      return ok({ rows: rows.filter(({ row }) => trim(row[0]) && canUseUnit(session, row[10])).map(({ row }) => row), ...expenseOptions(session) });
    }
    if (action === 'order' || action === 'orders' || action === 'receiving') {
      const [orders, lines] = await readTables(sheets, PURCHASE_TABS.orders, PURCHASE_TABS.lines);
      if (action === 'order') {
        const { record } = orderLookup(field(query.folio, 90, 'folio', true), orders, lines, session);
        return ok({ order: record });
      }
      const rows = entries(orders).filter(({ row }) => trim(row[0]) && trim(row[11]) !== 'Eliminada');
      const linked = new Map();
      for (const item of entries(lines)) {
        const folio = upper(item.row[0]);
        if (!folio) continue;
        if (!linked.has(folio)) linked.set(folio, []);
        linked.get(folio).push(item);
      }
      if (action === 'receiving') {
        return ok({ orders: rows.filter(({ row }) => canUseUnit(session, row[5]) && RECEIPT_ORDER_STATUS.has(trim(row[11])))
          .map(({ row }) => orderRecord(row, linked.get(upper(row[0])) || []))
          .filter(hasRecordedApproval).map(receivingRecord).reverse() });
      }
      const headerFolios = new Set(entries(orders).map(({ row }) => upper(row[0])).filter(Boolean));
      const orphanFolios = session.allUnits === true ? [...linked.keys()].filter((folio) => !headerFolios.has(folio)) : [];
      const vendors = entries(await sheets.read(PURCHASE_TABS.vendors)).map(({ row }) => vendorRecord(row)).filter((vendor) => vendor.name);
      return ok({
        orders: rows.filter(({ row }) => canUseUnit(session, row[5]))
          .map(({ row }) => orderRecord(row, linked.get(upper(row[0])) || [])).reverse(),
        vendors, orphanFolios, issuers: configuredIssuers(session), canApprove: session.canApprovePurchases === true,
        canRecordInvoice: invoiceAccess, canRecordPayment: paymentAccess,
      });
    }
    tx = mutate(action, body, session, sheets);
    if (panama && action === 'order-receive') return await changeOrder(action, body, session, sheets, tx);
    const previous = await tx.replay();
    if (previous !== null) return ok(previous);
    if (action === 'request-submit') return await submitRequest(body, session, sheets, tx);
    if (action === 'request-status') return await changeRequest(body, session, sheets, tx);
    if (action === 'inventory-move') return await moveInventory(body, session, sheets, tx);
    if (action === 'order-save') return await saveOrder(body, session, sheets, tx);
    if (action === 'expense-save') return await saveExpense(body, session, sheets, tx, evidenceStorage);
    if (action === 'expense-delete' || action === 'expense-review') return await changeExpense(action, body, session, sheets, tx);
    return await changeOrder(action, body, session, sheets, tx);
  } catch (cause) {
    const status = Number(cause?.status);
    if (tx && (status === 409 || status === 404)) {
      const replayed = await tx.replay().catch(() => null);
      if (replayed !== null) return ok(replayed);
    }
    if (cause instanceof RequestError || isEvidenceError(cause) || status === 409 || (cause instanceof HermesSheetError && status === 400)) {
      return { status, body: { error: cause.message } };
    }
    return { status: 503, body: { error: 'No pudimos confirmar el guardado o la lectura. Actualiza o reintenta la misma operación.' } };
  }
}
