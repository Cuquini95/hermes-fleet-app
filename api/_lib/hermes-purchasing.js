import { createHash } from 'node:crypto';
import { PANAMA_DEMO_ISSUER } from './hermes-panama-demo.js';
import { isEvidenceError, verifyEvidence } from './hermes-evidence.js';
import { orderWriteGuard } from './hermes-workshop.js';
import { HermesSheetError } from './hermes-google-sheets.js';
import { isPurchaseSignature, readPurchaseNumber } from './hermes-operational-store.js';
import { panamaPartCompatibility, visiblePanamaParts } from './hermes-part-prices.js';
import { EXPENSE_ADJUSTMENTS_TAB, projectExpenseAdjustments } from './hermes-panama-expense-adjustments.js';

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
const MOVEMENT_WAREHOUSE = 16;
const MOVEMENT_RESERVATION = 17;
const MOVEMENT_DISPATCH = 18;
const LINE_WAREHOUSE = 13;
const LINE_DISPATCHES = 14;
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

function dispatchHistory(cell) {
  try {
    const records = JSON.parse(cell);
    if (Array.isArray(records) && records.every(record => record && typeof record.id === 'string'
      && typeof record.reference === 'string' && typeof record.quantity === 'string'
      && record.id && record.reference && Number.isFinite(Date.parse(record.at))
      && (!record.cancelledAt || Number.isFinite(Date.parse(record.cancelledAt))))) return records;
  } catch { /* Reconcile an invalid history without changing the source. */ }
  return null;
}

function dispatchBalances(line) {
  if (line.dispatchReview) error(409, 'Concilia los despachos de esta partida.');
  const shipments = new Map();
  for (const shipment of line.dispatches ?? []) {
    const destination = shipment.warehouse || line.warehouse;
    if (!destination || (!shipment.cancelledAt && upper(destination) !== upper(line.warehouse)) || shipments.has(shipment.id)) {
      error(409, 'Concilia el almacén y las guías de esta partida.');
    }
    shipments.set(shipment.id, { ...shipment, warehouse: destination, remaining: decimal(shipment.quantity, 3, 'despacho confirmado', true) });
  }
  const receiptIds = new Set();
  let receiptTotal = 0n;
  for (const receipt of shipments.size ? line.receipts : []) {
    const amount = decimal(receipt?.quantity, 3, 'recepción del despacho', true);
    if (!receipt.id || receiptIds.has(receipt.id)) error(409, 'Concilia las remisiones duplicadas de la partida.');
    receiptIds.add(receipt.id);
    receiptTotal += amount;
    if (!receipt?.dispatchId) continue;
    const shipment = shipments.get(receipt.dispatchId);
    if (!shipment || amount > shipment.remaining || upper(receipt.warehouse) !== upper(shipment.warehouse)) {
      error(409, 'La recepción no concilia con el despacho y su almacén.');
    }
    shipment.remaining -= amount;
  }
  let inTransit = 0n;
  for (const shipment of shipments.values()) {
    if (shipment.cancelledAt) shipment.remaining = 0n;
    inTransit += shipment.remaining;
  }
  const received = decimal(line.received, 3, 'recibido');
  if ((shipments.size && receiptTotal !== received) || inTransit + received > decimal(line.quantity, 3, 'ordenado', true)) {
    error(409, 'El tránsito y las recepciones superan la cantidad ordenada.');
  }
  return { shipments, inTransit };
}

function ocLine(row) {
  const dispatches = row[LINE_DISPATCHES] ? dispatchHistory(row[LINE_DISPATCHES]) : undefined;
  return {
    id: trim(row[6]) || trim(row[0]) + '-L' + trim(row[1]), number: trim(row[1]),
    description: trim(row[2]), quantity: trim(row[3]), unitPrice: trim(row[4]), total: trim(row[5]),
    requestId: trim(row[7]), requestLineId: trim(row[8]), partNumber: trim(row[9]),
    received: trim(row[10]) || '0', receipts: receiptHistory(row),
    ...(trim(row[12]) && { ot: trim(row[12]) }),
    ...(trim(row[LINE_WAREHOUSE]) && { warehouse: trim(row[LINE_WAREHOUSE]) }),
    ...(dispatches ? { dispatches } : dispatches === null ? { dispatchReview: true } : {}),
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
  const record = {
    folio: trim(row[0]), number: readPurchaseNumber(row), date: trim(row[1]), vendorName: trim(row[2]), vendorRfc: trim(row[3]), vendorAddress: trim(row[4]),
    unit: trim(row[5]), subtotal: trim(row[6]), tax: trim(row[7]), shipping: trim(row[8]), other: trim(row[9]), total: trim(row[10]),
    discount: trim(row[25]) || '0.00', vendorSource: row[26] === 'manual' ? 'manual' : 'catalog',
    status: trim(row[11]) || 'Borrador', comments: trim(row[12]), approvedBy: trim(row[13]), deliveryDate: trim(row[14]),
    version: trim(row[15]) || 'legacy-' + hash([row, items.map((item) => item.row)]).slice(0, 24),
    issuer: issuerSnapshot(row), approvedById: trim(row[17]), approvedAt: trim(row[18]), requestedBy: trim(row[20]),
    approvalReason: trim(row[22]), invoice: recordedDocument(row[23]), payment: recordedDocument(row[24]),
    receiptStatus: allReceived ? 'Recibida' : anyReceived ? 'Recibida parcial' : 'Pendiente',
    lines,
  };
  return { ...record, invoiceReconciled: record.status === 'Pagada' ? Boolean(record.invoice?.match) : invoiceMatchesCurrent(record) };
}

function hasRecordedApproval({ status, approvedBy, approvedById, approvedAt }) {
  return RECEIPT_ORDER_STATUS.has(status) && Boolean(approvedBy && approvedById) && Number.isFinite(Date.parse(approvedAt));
}

function receivingRecord({ folio, number, unit, vendorName, deliveryDate, receiptStatus, version, lines }, stock) {
  return { folio, number, unit, vendorName, deliveryDate, receiptStatus, version, lines: lines.map((line) => ({
    id: line.id, number: line.number, description: line.description, partNumber: line.partNumber,
    quantity: line.quantity, received: line.received,
    ...(line.warehouse && { warehouse: line.warehouse }),
    warehouses: [...new Set(stock.filter(part => part.warehouse && upper(part.row[0]) === upper(line.partNumber)).map(part => part.warehouse))],
    ...receivingDispatches(line),
    receipts: line.receipts.map(({ id, at, by, quantity, reference, stockDisposition }) => ({ id, at, by, quantity, reference, stockDisposition })),
  })) };
}

function receivingDispatches(line) {
  if (!line.dispatches && !line.dispatchReview) return {};
  try {
    return { dispatches: [...dispatchBalances(line).shipments.values()]
      .map(({ id, reference, remaining }) => ({ id, reference, remaining: quantity(remaining) })) };
  } catch {
    return { dispatchReview: true };
  }
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
    ...(trim(row[22]) && { ot: trim(row[22]) }),
    ...(trim(row[23]) && { requiredDate: trim(row[23]) }),
    ...(trim(row[24]) && { equipmentSerial: trim(row[24]) }),
  };
}

function parseRequests(rows) {
  return entries(rows).flatMap(({ row, index }) =>
    trim(row[1]) && trim(row[2]) && REQUEST_STATUS.has(trim(row[6]) || 'Pendiente')
      ? [{ row, index, record: requestRecord(row, index) }]
      : []
  );
}

function allocationIndex(orders, lines) {
  const headers = new Map();
  for (const { row } of entries(orders)) {
    const folio = upper(row[0]);
    if (folio) headers.set(folio, headers.has(folio) ? null : row);
  }
  const byRequest = new Map();
  for (const { row } of entries(lines)) {
    const id = trim(row[8]);
    if (!id) continue;
    const header = headers.get(upper(row[0]));
    if (header && ['Eliminada', 'Rechazada'].includes(header[11])) continue;
    const bucket = byRequest.get(id) ?? [];
    bucket.push({ header, row });
    byRequest.set(id, bucket);
  }
  return byRequest;
}

function requestBalance(record, index) {
  const allocations = [];
  const used = new Set();
  let allocated = 0n, received = 0n;
  const wanted = decimalCell(record.cantidad, 3, 'pedido', true);
  for (const { header, row } of index.get(record.id) ?? []) {
    const folio = upper(row[0]);
    if (!header || used.has(folio) || upper(header[5]) !== upper(record.equipo || 'FLOTA') || upper(row[9]) !== upper(record.partNum)
      || (record.ot && upper(row[12]) !== upper(record.ot))) error(409, 'El vínculo de la partida requiere conciliación.');
    used.add(folio);
    const qty = decimalCell(row[3], 3, 'asignado', true);
    const delivery = decimalCell(row[10] || '0', 3, 'recibido');
    if (delivery > qty) error(409, 'La recepción de la partida requiere conciliación.');
    allocated += qty;
    received += delivery;
    allocations.push({ folio: trim(header[0]), number: readPurchaseNumber(header), vendor: trim(header[2]),
      quantity: quantity(qty), received: quantity(delivery), status: trim(header[11]) || 'Borrador' });
  }
  if (allocated > wanted || (record.ocFolio && !used.has(upper(record.ocFolio)))) {
    error(409, 'Concilia el saldo y las órdenes vinculadas de la partida.');
  }
  return { wanted, allocated, received, allocations };
}

function allocationUpdate(entry, nextIndex, tx, session, writes, guards) {
  const next = requestBalance({ ...entry.record, ocFolio: '' }, nextIndex);
  const prior = entry.row[19] || (entry.record.ocFolio ? 'Pendiente' : entry.record.estado);
  const status = next.received === next.wanted ? 'Completado' : next.allocated > 0n ? 'Pedido' : prior;
  writes.push(requestUpdate(entry, tx.version, session.userId, next.allocations[0]?.folio ?? '', status, next.allocated > 0n ? prior : ''));
  guards.push(requestGuard(entry.record));
}

function orderLookup(folio, data, lines, session) {
  const matching = entries(data).filter(({ row }) => upper(row[0]) === upper(folio) || readPurchaseNumber(row) === folio);
  if (matching.length > 1) error(409, 'Este folio requiere conciliación de cabeceras duplicadas.');
  const header = matching[0];
  if (!header || header.row[11] === 'Eliminada') error(404, 'Orden de compra no encontrada.');
  requireUnit(session, header.row[5]);
  const items = entries(lines).filter((item) => upper(item.row[0]) === upper(header.row[0]));
  const record = orderRecord(header.row, items);
  if (new Set(record.lines.map((line) => line.id)).size !== record.lines.length) {
    error(409, 'Este folio requiere conciliación de partidas duplicadas.');
  }
  return { header, items, record };
}

async function purchaseNumbers(sheets, session, linkedFolios) {
  if (session.project !== 'tmf-panama' || !linkedFolios.some(Boolean)) return new Map();
  const rows = await Promise.resolve().then(() => sheets.read(PURCHASE_TABS.orders)).catch(() => []);
  return new Map(entries(rows).filter(({ row }) => canUseUnit(session, row[5]))
    .map(({ row }) => [trim(row[0]), readPurchaseNumber(row)]));
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
  const includePurchaseNumber = session.project === 'tmf-panama' && action.startsWith('order-');
  return {
    operationId, key, fingerprint, version: sheets.nativeOperations ? hash(key) : operationId,
    async replay() {
      return sheets.replay({ key, fingerprint, includePurchaseNumber });
    },
    async commit(writes, result, guards = [], purchaseSignature) {
      const committed = await sheets.commit({ key, fingerprint, guards: [...new Set(guards)], writes, result, includePurchaseNumber, purchaseSignature });
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
const normalizedTaxId = value => upper(value).replace(/[^A-Z0-9]/g, '');

function catalogStockRows(rows) {
  const headerIndex = rows.findIndex(row => normalizeCatalogKey(row[0]) === 'SKU' && normalizeCatalogKey(row[5]) === 'STOCK');
  if (headerIndex < 0) error(409, 'El catálogo no tiene un encabezado de existencias verificable.');
  const columns = rows[headerIndex].flatMap((cell, index) => ['ALMACEN', 'BODEGA'].includes(normalizeCatalogKey(cell)) ? [index] : []);
  if (columns.length > 1) error(409, 'Concilia la columna autorizada de almacén.');
  const [warehouseColumn] = columns;
  return rows.flatMap((row, index) => index > headerIndex && trim(row[0])
    ? [{ row, index, warehouseColumn, warehouse: warehouseColumn === undefined ? '' : trim(row[warehouseColumn]) }] : []);
}

function catalogPart(rows, sku, required = true, warehouse = '') {
  const matching = catalogStockRows(rows).filter(part => upper(part.row[0]) === upper(sku)
    && (!warehouse || upper(part.warehouse) === upper(warehouse)));
  if (matching.length > 1) error(409, 'El SKU tiene varios registros. Selecciona un almacén con saldo único.');
  if (!matching.length && required) error(409, 'El SKU no está en el catálogo. Verifica el repuesto o usa la solicitud manual.');
  if (!matching.length && warehouse) error(409, 'El SKU no figura en ese almacén.');
  return matching[0];
}

function assertCompatible(part, fleet, unit) {
  const equipment = fleet.filter(row => upper(row[1]) === unit);
  if (equipment.length !== 1) error(409, 'La unidad no se pudo conciliar con la flota.');
  const compatibility = panamaPartCompatibility(part.row, equipment[0]);
  if (compatibility === 'pin') error(409, 'El PIN o la serie de la unidad no coincide con la compatibilidad del repuesto.');
  if (compatibility !== 'match') {
    error(409, 'La compatibilidad de este repuesto con la unidad no está verificada. Revisa el catálogo.');
  }
}

function movementRecord(row) {
  return {
    id: trim(row[0]), at: trim(row[1]), kind: trim(row[2]), partNumber: trim(row[3]), quantity: trim(row[4]),
    unit: trim(row[5]), order: trim(row[6]), lineId: trim(row[7]), ot: trim(row[8]), reference: trim(row[9]),
    by: trim(row[10]), actorId: trim(row[11]), stockAfter: trim(row[12]), measurementUnit: trim(row[13]),
    originalIssueId: trim(row[14]), valuation: recordedInventoryValue(row[15]),
    warehouse: trim(row[MOVEMENT_WAREHOUSE]), reservationId: trim(row[MOVEMENT_RESERVATION]),
    dispatchId: trim(row[MOVEMENT_DISPATCH]),
  };
}

function valueDefinition(input) {
  const { unitCost, currency, reference } = input ?? {};
  return /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(String(unitCost ?? ''))
    && ['USD', 'PAB'].includes(currency) && typeof reference === 'string' && reference.trim() && reference.length <= 160
    ? { unitCost: money(decimal(unitCost, 2, 'costo autorizado')), currency, reference: reference.trim() } : null;
}

function approvedInventoryValue(session, supplied, sku) {
  if (session.previewDemo && supplied === undefined) return null;
  try {
    const rows = supplied ?? JSON.parse(process.env.HERMES_PANAMA_INVENTORY_VALUATIONS_JSON || '[]');
    const matches = rows.filter(row => upper(row?.partNumber) === upper(sku));
    if (!matches.length) return null;
    const value = matches.length === 1 ? valueDefinition(matches[0]) : null;
    if (!value) error(409, 'Concilia la valuación autorizada de este SKU.');
    return value;
  } catch {
    error(409, 'No se pudo verificar la valuación autorizada del repuesto.');
  }
}

function recordedInventoryValue(cell) {
  if (!cell) return null;
  try {
    const value = JSON.parse(cell);
    const definition = valueDefinition(value);
    if (definition && typeof value.delta === 'string' && /^-?\d+\.\d{2}$/.test(value.delta)) {
      return { ...definition, delta: value.delta };
    }
  } catch {
    // Preserve the original cell for a documented reconciliation.
  }
  return null;
}

function movementScope(row) {
  return JSON.stringify([upper(row[8]), upper(row[5]), upper(row[3])]);
}

function issueBalance(issue, related) {
  const issues = related.filter(row => row[2] === 'Salida');
  const returns = related.filter(row => row[2] === 'Devolución');
  const legacy = returns.filter(row => !trim(row[14]));
  if (legacy.length && issues.length !== 1) error(409, 'Concilia las devoluciones anteriores antes de devolver otra salida de esta OT.');
  const applied = returns.filter(row => trim(row[14]) === trim(issue[0]) || !trim(row[14]));
  const returned = applied.reduce((sum, row) => sum + decimalCell(row[4], 3, 'devolución anterior', true), 0n);
  const issued = decimalCell(issue[4], 3, 'salida anterior', true);
  if (returned > issued) error(409, 'El saldo de la salida original requiere conciliación.');
  return { returned, left: issued - returned, hasLegacy: legacy.length > 0 };
}

function inventoryMovement({ part, nextStock, session, tx, kind, amount, unit, folio = '', lineId = '', ot = '', reference,
  originalIssueId = '', valuation = null, reservationId = '', dispatchId = '' }) {
  const extension = part.warehouse || reservationId || dispatchId
    ? [originalIssueId, valuation ? JSON.stringify(valuation) : '', part.warehouse, reservationId, ...(dispatchId ? [dispatchId] : [])]
    : originalIssueId || valuation ? [originalIssueId, valuation ? JSON.stringify(valuation) : ''] : [];
  return append(PURCHASE_TABS.inventoryMovements, [[
    tx.version, timestamp().iso, kind, part.row[0], quantity(amount), unit, folio, lineId, ot, reference,
    session.userName, session.userId, quantity(nextStock), part.row[4] || '', ...extension,
  ]]);
}

function inventoryWrites({ part, nextStock, ...movement }) {
  return [
    { tab: PURCHASE_TABS.catalog, row: part.index, col: 5, values: [quantity(nextStock)] },
    inventoryMovement({ part, nextStock, ...movement }),
  ];
}

// Guard by the last committed operation, not by quantity. An issue followed by a
// return can restore the same numerical balance and must still permit new writes.
function inventoryGuard(part, history) {
  const last = history.findLast(row => upper(row[3]) === upper(part.row[0])
    && !['Despacho', 'Cancelación de despacho'].includes(row[2]));
  return 'stock:' + hash([upper(part.row[0]), last?.[0] ?? 'initial']);
}

function verifyWarehouseStock(part, history, physical) {
  if (!part.warehouse) return;
  const last = history.findLast(row => upper(row[3]) === upper(part.row[0])
    && upper(row[MOVEMENT_WAREHOUSE]) === upper(part.warehouse) && ['Recepción', 'Salida', 'Devolución'].includes(row[2]));
  if (last && decimal(last[12], 3, 'existencia del último movimiento') !== physical) {
    error(409, 'Las existencias no concilian con el último movimiento del almacén.');
  }
}

async function stockForWriting(sheets, part) {
  const source = await sheets.read(PURCHASE_TABS.catalog, { valueRenderOption: 'FORMULA', requireExisting: true });
  const raw = source[part.index];
  if (upper(raw?.[0]) !== upper(part.row[0])
    || (part.warehouseColumn !== undefined && upper(raw?.[part.warehouseColumn]) !== upper(part.warehouse))) {
    error(409, 'La ubicación del SKU cambió. Actualiza el catálogo y revisa.');
  }
  if (trim(raw[5]).startsWith('=')) error(409, 'La existencia se calcula con una fórmula. Registra el movimiento en la fuente que alimenta esa fórmula.');
  const available = decimal(part.row[5], 3, 'existencia confirmada');
  if (decimal(raw[5], 3, 'existencia del maestro') !== available) error(409, 'La existencia cambió. Actualiza el catálogo y revisa.');
  return available;
}

function reservationBalances(history, part) {
  const reservations = new Map();
  for (const row of history) {
    if (upper(row[3]) !== upper(part.row[0]) || upper(row[MOVEMENT_WAREHOUSE]) !== upper(part.warehouse)) continue;
    const linked = trim(row[MOVEMENT_RESERVATION]);
    if (row[2] === 'Reserva') {
      const id = trim(row[0]);
      if (!id || reservations.has(id) || !row[5] || !row[8]) error(409, 'Concilia el historial de reservas del almacén.');
      reservations.set(id, { id, unit: upper(row[5]), ot: upper(row[8]), reference: trim(row[9]),
        remaining: decimal(row[4], 3, 'reserva registrada', true) });
    } else if (row[2] === 'Liberación' || (row[2] === 'Salida' && linked)) {
      const original = reservations.get(linked);
      const amount = decimal(row[4], 3, 'movimiento de reserva', true);
      if (!original || original.unit !== upper(row[5]) || original.ot !== upper(row[8]) || amount > original.remaining) {
        error(409, 'Concilia el historial de reservas del almacén.');
      }
      original.remaining -= amount;
    }
  }
  return { reservations, reserved: [...reservations.values()].reduce((sum, row) => sum + row.remaining, 0n) };
}

function stockOrder(orders, session, identifier) {
  const matches = entries(orders).filter(({ row }) => upper(row[1]) === identifier || upper(row[25]) === identifier);
  if (matches.length !== 1 || !trim(matches[0].row[3])) error(404, 'La OT no está disponible para registrar repuestos.');
  const order = matches[0];
  return { order, ot: upper(order.row[1]), unit: requireUnit(session, order.row[3]) };
}

function requireOpenStockOrder(order) {
  if (['COMPLETADO', 'CANCELADO', 'CANCELADA'].includes(normalizeCatalogKey(order.row[9]))) {
    error(409, 'No puedes asignar repuestos para una OT cerrada.');
  }
}

async function reserveInventory(body, session, sheets, tx) {
  const kind = body.kind;
  if (!['Reserva', 'Liberación'].includes(kind)) error(400, 'Selecciona reservar o liberar.');
  const requestedOt = upper(field(body.ot, 90, 'OT', true));
  const { order, ot, unit } = stockOrder(await sheets.read('ORDENES_TRABAJO'), session, requestedOt);
  const prior = await tx.replay();
  if (prior !== null) return ok(prior);
  const sku = field(body.partNumber, 120, 'SKU', true);
  const warehouse = field(body.warehouse, 120, 'almacén', true);
  const reference = field(body.reference, 160, 'referencia de reserva', true);
  const amount = decimal(body.quantity, 3, 'reserva', true);
  const [catalog, movements] = await readTables(sheets, PURCHASE_TABS.catalog, PURCHASE_TABS.inventoryMovements);
  const part = catalogPart(catalog, sku, true, warehouse);
  const physical = await stockForWriting(sheets, part);
  const history = entries(movements).map(({ row }) => row);
  verifyWarehouseStock(part, history, physical);
  const { reservations, reserved } = reservationBalances(history, part);
  if (reserved > physical) error(409, 'Las reservas superan la existencia registrada. Concilia el almacén.');
  const reservationId = field(body.reservationId, 120, 'reserva original', kind === 'Liberación');
  if (kind === 'Reserva') {
    requireOpenStockOrder(order);
    assertCompatible(part, await sheets.read('01 Inventario'), unit);
    if (reservationId) error(400, 'La nueva reserva no puede indicar una reserva anterior.');
    if (amount > physical - reserved) error(409, 'La cantidad supera la existencia disponible del almacén.');
  } else {
    const original = reservations.get(reservationId);
    if (!original || original.ot !== ot || original.unit !== unit || amount > original.remaining) {
      error(409, 'La liberación supera el saldo o no corresponde a la reserva de esta OT y almacén.');
    }
  }
  if (history.some(row => row[2] === kind && upper(row[3]) === upper(sku) && upper(row[8]) === ot
      && upper(row[MOVEMENT_WAREHOUSE]) === upper(warehouse) && upper(row[9]) === upper(reference))) {
    error(409, 'La referencia ya se registró para esta OT y repuesto.');
  }
  const guards = [inventoryGuard(part, history)];
  const writes = [inventoryMovement({ part, nextStock: physical, session, tx, kind, amount, unit, ot, reference, reservationId }),
    auditRow(session, tx.operationId, kind + ' de repuesto', ot, [sku, warehouse, quantity(amount), reference].join(' · '))];
  if (kind === 'Reserva' && sheets.nativeOperations) {
    guards.push(orderWriteGuard(order.row));
    writes.push({ tab: 'ORDENES_TRABAJO', row: order.index, col: 18, values: [tx.version] });
  }
  return tx.commit(writes, { id: tx.version, ot, warehouse: part.warehouse }, guards);
}

async function moveInventory(body, session, sheets, tx, inventoryValuations) {
  const kind = body.kind;
  if (!['Salida', 'Devolución'].includes(kind)) error(400, 'Selecciona salida o devolución.');
  const ot = upper(field(body.ot, 90, 'OT', true));
  const sku = field(body.partNumber, 120, 'SKU', true);
  const amount = decimal(body.quantity, 3, 'movimiento', true);
  const reference = field(body.reference, 160, 'referencia del movimiento', true);
  const { order, unit, ot: internalOt } = stockOrder(await sheets.read('ORDENES_TRABAJO'), session, ot);
  const prior = await tx.replay();
  if (prior !== null) return ok(prior);
  const [movements, stock] = await readTables(sheets, PURCHASE_TABS.inventoryMovements, PURCHASE_TABS.catalog);
  let warehouse = field(body.warehouse, 120, 'almacén');
  const reservationId = field(body.reservationId, 120, 'reserva original');
  if (kind === 'Devolución' && reservationId) error(400, 'La devolución se vincula a la salida original.');
  const history = entries(movements).map(({ row }) => row);
  const scope = JSON.stringify([internalOt, unit, upper(sku)]);
  const related = history.filter(row => movementScope(row) === scope);
  if (related.some(row => row[2] === kind && upper(row[9]) === upper(reference))) {
    error(409, 'La referencia ya está registrada para este repuesto y OT.');
  }
  let originalIssueId = '';
  let valuation = null;
  if (kind === 'Salida') {
    requireOpenStockOrder(order);
    const approved = approvedInventoryValue(session, inventoryValuations, sku);
    if (approved) valuation = { ...approved, delta: money(lineCost(amount, decimal(approved.unitCost, 2, 'costo autorizado'))) };
  } else {
    const requested = field(body.originalIssueId, 120, 'salida original');
    const issues = related.filter(row => row[2] === 'Salida' && (!requested || trim(row[0]) === requested));
    if (issues.length !== 1) error(409, 'Selecciona una salida original de esta OT, unidad y SKU.');
    const [issue] = issues;
    const originalWarehouse = trim(issue[MOVEMENT_WAREHOUSE]);
    if (warehouse && upper(warehouse) !== upper(originalWarehouse)) error(409, 'Devuelve el repuesto al almacén de la salida original.');
    warehouse = originalWarehouse;
    originalIssueId = trim(issue[0]);
    if (!originalIssueId || history.filter(row => trim(row[0]) === originalIssueId).length !== 1) {
      error(409, 'La salida original requiere conciliación.');
    }
    const { returned, left, hasLegacy } = issueBalance(issue, related);
    if (amount > left) error(409, 'La devolución supera el saldo de la salida original.');
    const original = recordedInventoryValue(issue[15]);
    if (issue[15] && (!original || hasLegacy)) error(409, 'Concilia el costo de las devoluciones previas antes de continuar.');
    if (original) {
      const originalPrice = decimal(original.unitCost, 2, 'costo original');
      const issued = returned + left;
      if (original.delta !== money(lineCost(issued, originalPrice))) error(409, 'La valuación de la salida original no cuadra.');
      const reversal = lineCost(returned + amount, originalPrice) - lineCost(returned, originalPrice);
      valuation = { ...original, delta: reversal === 0n ? '0.00' : '-' + money(reversal) };
    }
  }
  const part = catalogPart(stock, sku, true, warehouse);
  const physical = await stockForWriting(sheets, part);
  verifyWarehouseStock(part, history, physical);
  if (kind === 'Devolución' && !warehouse && part.warehouse) error(409, 'Concilia el almacén de la salida original antes de devolver.');
  if (kind === 'Salida') {
    assertCompatible(part, await sheets.read('01 Inventario'), unit);
    const { reservations, reserved } = reservationBalances(history, part);
    const original = reservations.get(reservationId);
    if (reserved > physical || (reservationId
      ? !original || original.ot !== internalOt || original.unit !== unit || amount > original.remaining
      : amount > physical - reserved)) error(409, 'La cantidad supera el disponible o el saldo de la reserva para esta OT y almacén.');
  }
  const nextStock = physical + (kind === 'Salida' ? -amount : amount);
  const guards = [inventoryGuard(part, history)];
  const writes = inventoryWrites({ part, nextStock, session, tx, kind, amount, unit, ot: internalOt, reference, originalIssueId, valuation, reservationId });
  if (kind === 'Salida' && sheets.nativeOperations) {
    guards.push(orderWriteGuard(order.row));
    writes.push({ tab: 'ORDENES_TRABAJO', row: order.index, col: 18, values: [tx.version] });
  }
  return tx.commit([
    ...writes,
    auditRow(session, tx.operationId, kind + ' de repuesto', internalOt,
      [part.row[0], quantity(amount), originalIssueId, valuation ? valuation.currency + ' ' + valuation.delta : 'Costo pendiente'].filter(Boolean).join(' · ')),
  ], { id: tx.version, stock: quantity(nextStock), ot: internalOt, originalIssueId, valuation }, guards);
}

const warehouseStockKey = (sku, warehouse) => JSON.stringify([upper(sku), upper(warehouse)]);
const orderLineKey = (folio, lineId) => JSON.stringify([upper(folio), trim(lineId)]);

function reconcileTransit(line, balance, folio, history) {
  const movements = history.filter(row => row[MOVEMENT_DISPATCH] && orderLineKey(row[6], row[7]) === orderLineKey(folio, line.id));
  let expected = 0;
  const contains = (shipment, kind, amount, eventId) => {
    expected++;
    return movements.filter(row => row[2] === kind && row[MOVEMENT_DISPATCH] === shipment.id
      && upper(row[3]) === upper(line.partNumber) && upper(row[MOVEMENT_WAREHOUSE]) === upper(shipment.warehouse)
      && (!eventId || row[0] === eventId) && decimal(row[4], 3, 'cantidad del movimiento', true) === amount).length === 1;
  };
  for (const shipment of balance.shipments.values()) {
    const dispatched = decimal(shipment.quantity, 3, 'cantidad despachada', true);
    let received = 0n;
    let consistent = contains(shipment, 'Despacho', dispatched, shipment.id);
    for (const receipt of line.receipts.filter(item => item.dispatchId === shipment.id)) {
      const amount = decimal(receipt.quantity, 3, 'recepción del despacho', true);
      received += amount;
      consistent = contains(shipment, 'Recepción', amount, receipt.id) && consistent;
    }
    if (shipment.cancelledAt) consistent = contains(shipment, 'Cancelación de despacho', dispatched - received) && consistent;
    if (!consistent) error(409, 'La guía y el libro de movimientos del almacén no concilian.');
  }
  if (movements.length !== expected) error(409, 'Hay movimientos de tránsito sin una guía conciliada.');
}

function orderDeliveryDate(value) {
  const date = trim(value);
  const parts = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = parts ? parts[3] + '-' + parts[2] + '-' + parts[1] : date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const time = Date.parse(iso);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? iso : null;
}

function replenishmentOrders(orders, lines, history, part) {
  const sku = upper(part.partNumber);
  const warehouse = upper(part.warehouse);
  const headers = new Map();
  for (const { row } of entries(orders)) {
    const folio = upper(row[0]);
    if (folio) headers.set(folio, headers.has(folio) ? null : row);
  }
  const relevant = entries(lines).filter(({ row }) => upper(row[9]) === sku);
  const lineCounts = new Map();
  for (const { row } of relevant) {
    const key = orderLineKey(row[0], trim(row[6]) || trim(row[1]));
    lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
  }
  const openOrders = [], issues = [];
  for (const { row } of relevant) {
    const destination = upper(row[LINE_WAREHOUSE]);
    if (destination && destination !== warehouse) continue;
    const folio = trim(row[0]);
    const header = headers.get(upper(folio));
    const number = readPurchaseNumber(header);
    const lineId = trim(row[6]) || folio + '-L' + trim(row[1]);
    const issue = reason => issues.push({ folio, ...(number && { number }), lineId, reason });
    if (!header) {
      issue('Cabecera de la OC por conciliar');
      continue;
    }
    const status = trim(header[11]);
    if (['Borrador', 'Rechazada', 'Eliminada'].includes(status)) continue;
    if (!trim(header[5]) || !hasRecordedApproval({
      status, approvedBy: header[13], approvedById: header[17], approvedAt: header[18],
    })) {
      issue('Aprobación o estado de la OC por conciliar');
      continue;
    }
    try {
      if (lineCounts.get(orderLineKey(folio, trim(row[6]) || trim(row[1]))) !== 1) error(409, 'Partida duplicada');
      const line = ocLine(row);
      const ordered = decimal(line.quantity, 3, 'ordenado', true);
      const received = decimal(row[10], 3, 'recibido');
      const remaining = ordered - received;
      if (remaining < 0n || (remaining > 0n && ['Recibida', 'Pagada'].includes(status))
        || (received > 0n && status === 'Aprobada')) error(409, 'Estado y saldo incompatibles');
      if (remaining === 0n) continue;
      if (!destination) {
        issue('Almacén de la partida por confirmar');
        continue;
      }
      const balance = dispatchBalances(line);
      reconcileTransit(line, balance, folio, history);
      const receiptIds = new Set();
      let posted = 0n;
      for (const receipt of line.receipts) {
        if (!receipt?.id || receiptIds.has(receipt.id) || !trim(receipt.reference)
          || !Number.isFinite(Date.parse(receipt.at)) || upper(receipt.warehouse) !== warehouse
          || receipt.stockDisposition !== 'posted') error(409, 'Recepción por conciliar');
        const amount = decimal(receipt.quantity, 3, 'recepción', true);
        const matches = history.filter(move => move[0] === receipt.id && move[2] === 'Recepción' && upper(move[3]) === sku
          && upper(move[MOVEMENT_WAREHOUSE]) === warehouse && orderLineKey(move[6], move[7]) === orderLineKey(folio, lineId)
          && decimal(move[4], 3, 'recepción de almacén', true) === amount);
        if (matches.length !== 1) error(409, 'Recepción sin movimiento único');
        receiptIds.add(receipt.id);
        posted += amount;
      }
      if (posted !== received) error(409, 'Total recibido por conciliar');
      const due = orderDeliveryDate(header[14]);
      if (!due) issue('Fecha de entrega de la OC por confirmar');
      openOrders.push({ folio, ...(number && { number }), lineId, remaining: quantity(remaining), inTransit: quantity(balance.inTransit), due });
    } catch {
      issue('Saldo o movimientos de la partida por conciliar');
    }
  }
  return { openOrders, issues };
}

async function inventoryByWarehouse(sheets, session, replenishmentQuery, snapshot) {
  const [catalog, movements, orders, lines, workOrders, scopedFleet] = snapshot ?? await readTables(sheets,
    PURCHASE_TABS.catalog, PURCHASE_TABS.inventoryMovements, PURCHASE_TABS.orders, PURCHASE_TABS.lines, 'ORDENES_TRABAJO');
  const folios = new Map(entries(workOrders).filter(({ row }) => canUseUnit(session, row[3]) && /^OT-\d{4,15}$/.test(row[25] ?? ''))
    .map(({ row }) => [upper(row[1]), row[25]]));
  const history = entries(movements).map(({ row }) => row);
  const approved = new Set(entries(orders).map(({ row }) => row).filter(row => hasRecordedApproval({
    status: row[11], approvedBy: row[13], approvedById: row[17], approvedAt: row[18],
  }) && canUseUnit(session, row[5])).map(row => upper(row[0])));
  const transit = new Map();
  const invalidTransit = new Set();
  for (const { row } of entries(lines)) {
    if (!row[LINE_DISPATCHES] || !approved.has(upper(row[0]))) continue;
    const key = warehouseStockKey(row[9], row[LINE_WAREHOUSE]);
    try {
      const line = ocLine(row);
      const balance = dispatchBalances(line);
      reconcileTransit(line, balance, row[0], history);
      const { inTransit } = balance;
      transit.set(key, (transit.get(key) ?? 0n) + inTransit);
    } catch {
      invalidTransit.add(key);
    }
  }
  const catalogParts = catalogStockRows(catalog);
  const visible = session.allUnits === true ? null : new Set(visiblePanamaParts(
    catalogParts.map(part => part.row), scopedFleet ?? await sheets.read('01 Inventario'), session,
  ));
  const counts = new Map();
  for (const part of catalogParts) {
    const key = warehouseStockKey(part.row[0], part.warehouse);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seen = new Set();
  const items = catalogParts.filter(part => !visible || visible.has(part.row)).flatMap(part => {
    const key = warehouseStockKey(part.row[0], part.warehouse);
    if (seen.has(key)) return [];
    seen.add(key);
    const minimum = trim(part.row[6]);
    const info = { partNumber: trim(part.row[0]), description: trim(part.row[1]), oem: trim(part.row[2]),
      warehouse: part.warehouse, measure: trim(part.row[4]), minimum: /^\d{1,12}(?:\.\d{1,3})?$/.test(minimum) ? minimum : null };
    try {
      if (counts.get(key) !== 1) error(409, 'SKU duplicado en este almacén.');
      const physical = decimal(part.row[5], 3, 'existencia');
      if (!part.warehouse) return [{ ...info, physical: quantity(physical), available: null, reserved: null, inTransit: null,
        reservations: [], review: 'Almacén por confirmar' }];
      verifyWarehouseStock(part, history, physical);
      const { reserved, reservations } = reservationBalances(history, part);
      if (reserved > physical) error(409, 'Reservas superiores a la existencia.');
      return [{ ...info, physical: quantity(physical), available: quantity(physical - reserved), reserved: quantity(reserved),
        inTransit: invalidTransit.has(key) ? null : quantity(transit.get(key) ?? 0n),
        reservations: [...reservations.values()].filter(row => row.remaining > 0n && canUseUnit(session, row.unit))
          .map(({ remaining, ...row }) => ({ ...row, folio: folios.get(row.ot), remaining: quantity(remaining) })),
        ...(invalidTransit.has(key) && { review: 'Despachos por conciliar' }) }];
    } catch {
      return [{ ...info, physical: null, available: null, reserved: null, inTransit: null,
        reservations: [], review: 'Existencias o reservas por conciliar' }];
    }
  });
  items.sort((a, b) => a.warehouse.localeCompare(b.warehouse) || a.partNumber.localeCompare(b.partNumber));
  const unmatchedDispatches = new Set([...invalidTransit, ...[...transit].filter(([, amount]) => amount > 0n).map(([key]) => key)]
    .filter(key => !seen.has(key))).size;
  if (!replenishmentQuery) return { items, unmatchedDispatches, transitScoped: session.allUnits !== true };
  const partNumber = field(replenishmentQuery.partNumber, 100, 'SKU', true);
  const warehouse = field(replenishmentQuery.warehouse, 120, 'almacén', true);
  const unit = requireUnit(session, field(replenishmentQuery.unit, 48, 'unidad', true));
  const item = items.find(stock => warehouseStockKey(stock.partNumber, stock.warehouse) === warehouseStockKey(partNumber, warehouse));
  if (!item) error(404, 'El SKU no figura en ese almacén.');
  assertCompatible(catalogPart(catalog, partNumber, true, warehouse), await sheets.read('01 Inventario'), unit);
  const { physical, reserved, available, minimum, measure } = item;
  const cut = timestamp();
  return { stock: { physical, reserved, available, minimum, measure }, readAt: cut.iso, today: orderDeliveryDate(cut.date),
    ...replenishmentOrders(orders, lines, history, item) };
}

function workOrderEquipment(fleet, unit) {
  const matches = fleet.filter(row => upper(row[1]) === unit);
  return matches.length === 1 ? matches[0] : undefined;
}

async function readWorkOrderPart(sheets, session, query) {
  const identifier = upper(field(query.ot, 90, 'OT', true));
  const partNumber = upper(field(query.partNumber, 120, 'número de parte'));
  const [snapshot, fleet] = await Promise.all([
    partNumber
      ? readTables(sheets, PURCHASE_TABS.catalog, PURCHASE_TABS.inventoryMovements, PURCHASE_TABS.orders, PURCHASE_TABS.lines, 'ORDENES_TRABAJO')
      : readTables(sheets, 'ORDENES_TRABAJO'),
    sheets.read('01 Inventario'),
  ]);
  const workOrders = snapshot.at(-1);
  const { order, ot, unit } = stockOrder(workOrders, session, identifier);
  const equipment = workOrderEquipment(fleet, unit);
  const context = { ot, folio: trim(order.row[25]) || ot, unit, serial: trim(equipment?.[6]) };
  if (!partNumber) return context;

  const catalog = catalogStockRows(snapshot[0]);
  const bySku = catalog.filter(({ row }) => upper(row[0]) === partNumber);
  const candidates = bySku.length ? bySku : catalog.filter(({ row }) => upper(row[2]) === partNumber);
  const compatible = candidates.filter(({ row }) => equipment && panamaPartCompatibility(row, equipment) === 'match');
  const skus = new Set(compatible.map(({ row }) => upper(row[0])));
  if (skus.size !== 1) return { ...context, match: skus.size > 1 ? 'ambiguous' : 'unverified', items: [] };
  const [sku] = skus;
  // Keep duplicate or contradictory catalog entries visible as unconfirmed stock.
  const warehouses = new Set(compatible.map(({ row, warehouse }) => warehouseStockKey(row[0], warehouse)));
  const balances = await inventoryByWarehouse(sheets, session, undefined, [...snapshot, fleet]);
  const items = balances.items.filter(row => upper(row.partNumber) === sku && warehouses.has(warehouseStockKey(row.partNumber, row.warehouse)))
    .map(({ reservations, ...row }) => ({
      ...row, reservedForOt: row.reserved === null ? null : quantity(reservations
        .filter(reservation => reservation.ot === ot && reservation.unit === unit)
        .reduce((sum, reservation) => sum + decimal(reservation.remaining, 3, 'reserva de la OT'), 0n)),
    }));
  return { ...context, partNumber: trim(compatible[0].row[0]), match: 'verified', items, transitScoped: balances.transitScoped };
}

async function submitRequest(body, session, sheets, tx) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    error(400, 'Agrega entre 1 y 100 partidas al pedido.');
  }
  const now = timestamp();
  const folio = 'PED-' + hash(tx.key).slice(0, 18).toUpperCase();
  const panama = session.project === 'tmf-panama';
  const panamaCatalog = panama && body.items.some(item => item?.isManual !== true);
  const hasWorkOrder = panama && body.items.some(item => item?.ot);
  const dated = panama && body.items.some(item => item?.requiredDate);
  const [stock, fleet, workOrders] = await Promise.all([
    panamaCatalog ? sheets.read(PURCHASE_TABS.catalog) : [],
    panamaCatalog || dated ? sheets.read('01 Inventario') : [],
    hasWorkOrder ? sheets.read('ORDENES_TRABAJO') : [],
  ]);
  const openOrders = new Map();
  const rows = body.items.map((item, index) => {
    const part = field(item.part_number, 120, 'número de parte', true);
    const description = field(item.description, 500, 'descripción', true);
    const qty = decimal(item.quantity, 3, 'pedido', true);
    const unitPrice = decimal(item.unit_price ?? 0, 2, 'precio unitario');
    const unit = requireUnit(session, field(item.equipment, 48, 'unidad', true));
    const identifier = panama ? upper(field(item.ot, 90, 'orden de trabajo')) : '';
    const requiredDate = panama ? field(item.requiredDate, 10, 'fecha requerida') : '';
    let ot = '';
    let serial = '';
    if (requiredDate) {
      calendarDate(requiredDate, 'requerida', true);
      if (!identifier) error(400, 'La fecha requerida se registra con una OT.');
    }
    if (identifier) {
      const linked = stockOrder(workOrders, session, identifier);
      ot = linked.ot;
      if (!/^OT-[A-Z0-9_-]+$/.test(ot) || linked.unit !== unit) {
        error(404, 'La OT no está disponible para la unidad del pedido.');
      }
      if (requiredDate) {
        requireOpenStockOrder(linked.order);
        serial = trim(workOrderEquipment(fleet, unit)?.[6]);
        openOrders.set(linked.order.index, linked.order);
      }
    }
    if (panamaCatalog && item.isManual !== true) {
      const matches = catalogStockRows(stock).filter(record => upper(record.row[0]) === upper(part));
      const canonical = matches[0] ?? catalogPart(stock, part);
      if (matches.length > 1 && (matches.some(record => !record.warehouse || record.row[2] !== canonical.row[2]
        || record.row[3] !== canonical.row[3] || record.row[4] !== canonical.row[4] || record.row[10] !== canonical.row[10])
        || new Set(matches.map(record => upper(record.warehouse))).size !== matches.length)) {
        error(409, 'Concilia el catálogo de este SKU entre almacenes.');
      }
      assertCompatible(canonical, fleet, unit);
    }
    const source = item.isManual === true ? 'Manual' : field(item.source, 120, 'origen') || 'Catálogo';
    const priority = ['Normal', 'Urgente', 'Crítico'].includes(item.urgencia) ? item.urgencia : 'Normal';
    return [
      now.date, part, description, unit, quantity(qty), source, 'Pendiente', '', '', folio, now.time, session.userName,
      priority, field(item.notes, 1000, 'notas'), money(lineCost(qty, unitPrice)), folio + '-L' + (index + 1),
      '', tx.version, session.userId, '', now.iso, money(unitPrice), ...(ot ? [ot] : []),
      ...(requiredDate ? [requiredDate, serial] : []),
    ];
  });
  await validateOperationalUnits(sheets, ...rows.map(row => row[3]));
  const guarded = sheets.nativeOperations ? [...openOrders.values()] : [];
  return tx.commit([
    append(PURCHASE_TABS.requests, rows),
    auditRow(session, tx.operationId, 'Pedido creado', folio, rows.length + ' partidas'),
    ...guarded.map(order => ({ tab: 'ORDENES_TRABAJO', row: order.index, col: 18, values: [tx.version] })),
  ], { folio, count: rows.length }, guarded.map(order => orderWriteGuard(order.row)));
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

function buildOrderLines(body, unit, folio, current, requests, session, allocations) {
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
      if (record.estado === 'Completado' || (!allocations && record.ocFolio && record.ocFolio !== folio)) {
        error(409, 'La partida del pedido ya tiene una orden o está completada.');
      }
      if (allocations) {
        const balance = requestBalance(record, allocations);
        const includingCurrent = balance.allocations.find(entry => upper(entry.folio) === upper(folio));
        const own = includingCurrent ? decimalCell(includingCurrent.quantity, 3, 'asignado') : 0n;
        if (qty > balance.wanted - balance.allocated + own) error(409, 'La cantidad supera el saldo por asignar de la partida.');
      } else if (qty !== decimalCell(record.cantidad, 3, 'pedido', true)) {
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
  const lookup = upper(field(body.folio, 90, 'folio'));
  const current = body.folio ? orderLookup(lookup, orderRows, lineRows, session) : null;
  const folio = current?.record.folio ?? 'OC-' + hash(tx.key).slice(0, 18).toUpperCase();
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
  const allocations = panama ? allocationIndex(orderRows, lineRows) : null;
  const items = buildOrderLines(body, unit, folio, current, requests, session, allocations);
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
  const projectedLines = [];
  const lineRowsById = new Map(current?.items.map((item) => [ocLine(item.row).id, item]) || []);
  for (const item of items) {
    const old = lineRowsById.get(item.id);
    const line = [
      folio, String(item.number), item.description, quantity(item.qty), money(item.price), money(lineCost(item.qty, item.price)),
      item.id, item.request?.record.pedidoId || '', item.requestLineId, item.partNumber, '0', '[]', ...(item.request?.record.ot ? [item.request.record.ot] : []),
    ];
    if (old?.row.length > 12 && line.length === 12) line.push('');
    projectedLines.push(line);
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
  if (allocations) {
    current?.record.lines.forEach(line => { if (line.requestLineId) linked.add(line.requestLineId); });
    const next = allocationIndex([...orderRows.filter(row => upper(row[0]) !== upper(folio)), values],
      [...lineRows.filter(row => upper(row[0]) !== upper(folio)), ...projectedLines]);
    for (const entry of requests.filter(item => linked.has(item.record.id))) {
      requestBalance(entry.record, allocations);
      allocationUpdate(entry, next, tx, session, writes, guards);
    }
  } else {
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
  }
  writes.push(auditRow(session, tx.operationId, current ? 'OC editada' : 'OC creada', folio, items.length + ' partidas'));
  return tx.commit(writes, { folio, total: money(total), version: tx.version }, guards);
}

function matchInvoice(record, body) {
  const differences = [];
  const currency = upper(field(body.currency, 3, 'moneda', true));
  const tax = decimal(body.tax, 2, 'impuesto de la factura');
  if (currency !== record.issuer.currency) differences.push('La moneda difiere de la OC.');
  if (tax !== decimal(record.tax, 2, 'impuesto de la OC')) differences.push(record.issuer.taxLabel + ' difiere de la OC.');
  if (!Array.isArray(body.lines) || body.lines.length > 100) error(400, 'Ingresa las partidas de la factura.');
  const expected = new Map(record.lines.map(line => [line.id, line]));
  const matched = new Map();
  const receiptIds = new Set();
  if (expected.size !== record.lines.length) error(409, 'La OC contiene partidas duplicadas.');
  for (const item of body.lines) {
    const id = field(item?.lineId, 120, 'partida de factura', true);
    const line = expected.get(id);
    if (!line || matched.has(id)) error(409, 'La factura contiene una partida duplicada o ajena a la OC.');
    const qty = decimal(item.quantity, 3, 'cantidad facturada', true);
    const price = decimal(item.unitPrice, 2, 'precio facturado');
    const ordered = decimal(line.quantity, 3, 'cantidad ordenada', true);
    const received = decimal(line.received, 3, 'cantidad recibida', true);
    let supported = 0n;
    const ids = [];
    const receiptEvidence = [];
    const references = new Set();
    for (const receipt of line.receipts) {
      const reference = upper(receipt.reference);
      if (!trim(receipt.id) || !reference || receiptIds.has(receipt.id) || references.has(reference)
          || !trim(receipt.actorId) || receipt.actorId === record.approvedById || !Number.isFinite(Date.parse(receipt.at))) {
        error(409, 'Partida ' + line.number + ': las remisiones requieren conciliación.');
      }
      receiptIds.add(receipt.id);
      references.add(reference);
      ids.push(receipt.id);
      const receiptQuantity = decimal(receipt.quantity, 3, 'cantidad de la remisión', true);
      supported += receiptQuantity;
      receiptEvidence.push(hash([receipt.id, trim(receipt.reference), receipt.actorId, receipt.at, quantity(receiptQuantity)]));
    }
    if (qty !== ordered || qty !== received || qty !== supported) {
      differences.push('Partida ' + line.number + ': cantidad facturada ' + quantity(qty) + ', OC ' + quantity(ordered)
        + ', recibida ' + quantity(received) + ', con remisión ' + quantity(supported) + '.');
    }
    if (price !== decimal(line.unitPrice, 2, 'precio de la OC')) {
      differences.push('Partida ' + line.number + ': precio facturado ' + money(price) + ', OC ' + line.unitPrice + '.');
    }
    matched.set(id, { lineId: id, quantity: quantity(qty), unitPrice: money(price), receiptIds: ids, receiptEvidence });
  }
  if (matched.size !== expected.size) differences.push('Faltan partidas de la OC en la factura.');
  if (differences.length) error(409, differences.slice(0, 8).join(' ') + (differences.length > 8 ? ' Revisa las demás partidas.' : ''));
  return { tax: money(tax), lines: record.lines.map(line => matched.get(line.id)) };
}

function invoiceMatchesCurrent(record) {
  const invoice = record.invoice;
  if (!invoice?.match || !record.issuer || !trim(invoice.matchReviewedById) || !Number.isFinite(Date.parse(invoice.matchReviewedAt))) return false;
  if (invoice.matchReviewedById === record.approvedById
      || record.lines.some(line => line.receipts.some(receipt => receipt.actorId === invoice.matchReviewedById))) return false;
  try {
    if (decimal(invoice.amount, 2, 'factura registrada') !== decimal(record.total, 2, 'total de la OC')) return false;
    const checked = matchInvoice(record, { ...invoice.match, currency: invoice.currency });
    const saved = new Map(invoice.match.lines.map(line => [line.lineId, line.receiptEvidence]));
    return checked.lines.every(line => {
      const evidence = saved.get(line.lineId);
      return Array.isArray(evidence) && evidence.length === line.receiptEvidence.length
        && line.receiptEvidence.every(digest => evidence.includes(digest));
    });
  } catch {
    return false;
  }
}

const AP_INVOICES = 'HERMES_PA_FACTURAS_OC';
const AP_PAYMENTS = 'HERMES_PA_PAGOS_FACTURA';
const apCharges = ['tax', 'discount', 'shipping', 'other'];
const centsFor = (record, field) => decimalCell(record[field], 2, field);
const sumCents = (records, field) => records.reduce((sum, record) => sum + centsFor(record, field), 0n);

async function readApTables(sheets) {
  const [orders, lines, invoiceRows, paymentRows] = await readTables(sheets, PURCHASE_TABS.orders, PURCHASE_TABS.lines, AP_INVOICES, AP_PAYMENTS);
  const records = (rows) => entries(rows).map(({ row }) => ({ id: row[0], parent: row[1], ...recordedDocument(row[2]) }));
  const invoices = records(invoiceRows);
  const payments = records(paymentRows);
  return { orders, lines, invoices, payments };
}

function isoTodayPanama() {
  const [day, month, year] = timestamp().date.split('/');
  return year + '-' + month + '-' + day;
}

function apDate(value, label) {
  const date = field(value, 10, label, true);
  calendarDate(date, label);
  return date;
}

function apInvoiceSummary(invoice, order, allPayments) {
  const payments = allPayments.filter(payment => payment.parent === invoice.id);
  const paid = sumCents(payments, 'amount');
  const total = centsFor(invoice, 'total');
  const { id, reference, issueDate, dueDate, currency, lines, legacy } = invoice;
  return {
    id, reference, issueDate, dueDate, currency, lines, legacy, total: money(total),
    ...Object.fromEntries(apCharges.map(key => [key, money(centsFor(invoice, key))])),
    folio: order.folio, version: order.version, number: order.number, unit: order.unit, vendorName: order.vendorName,
    vendorTaxId: order.vendorRfc, entity: order.issuer.name, entityId: order.issuer.id,
    paid: money(paid), balance: money(total - paid), status: paid === total ? 'Pagada' : paid ? 'Parcial' : 'Pendiente',
    payments: payments.map(({ id, reference, date, amount }) => ({ id, reference, date, amount })),
  };
}

function apOrderLines(order, invoices) {
  return order.lines.map(line => {
    const purchased = invoices.flatMap(invoice => invoice.lines).filter(item => item.lineId === line.id);
    const invoiced = purchased.reduce((sum, item) => sum + decimalCell(item.quantity, 3, 'facturado'), 0n);
    const received = decimalCell(line.received, 3, 'recibido');
    return { ...line, ordered: line.quantity, invoiced: quantity(invoiced), available: quantity(received - invoiced), purchased };
  });
}

function apRead(data, session, capabilities) {
  const orders = [];
  const invoices = [];
  const linesByOrder = new Map();
  for (const item of entries(data.lines)) {
    const key = upper(item.row[0]);
    const lines = linesByOrder.get(key) ?? [];
    lines.push(item);
    linesByOrder.set(key, lines);
  }
  for (const { row } of entries(data.orders)) {
    if (!canUseUnit(session, row[5]) || !RECEIPT_ORDER_STATUS.has(row[11])) continue;
    const order = orderRecord(row, linesByOrder.get(upper(row[0])) ?? []);
    if (!order.issuer || !hasRecordedApproval(order)) continue;
    const matched = data.invoices.filter(invoice => invoice.parent === order.folio);
    const { folio, number, version, status, unit, vendorName, issuer, total } = order;
    orders.push({ folio, number, version, status, unit, vendorName, issuer, total, legacy: Boolean(order.invoice),
      unbilledTotal: money(centsFor(order, 'total') - (order.invoice ? centsFor(order.invoice, 'amount') : sumCents(matched, 'total'))),
      lines: apOrderLines(order, matched).map(({ id, number, description, partNumber, ordered, received, invoiced, available, unitPrice }) =>
        ({ id, number, description, partNumber, ordered, received, invoiced, available, unitPrice })) });
    invoices.push(...matched.map(invoice => apInvoiceSummary(invoice, order, data.payments)));
    if (order.invoice) {
      const id = 'legacy:' + folio;
      const legacy = { id, reference: order.invoice.reference, total: order.invoice.amount, currency: order.invoice.currency,
        issueDate: '', dueDate: '', lines: [], legacy: true };
      const paid = order.payment ? [{ ...order.payment, parent: id, id: id + ':paid', date: '' }] : [];
      invoices.push(apInvoiceSummary(legacy, order, paid));
    }
  }
  return ok({ orders: orders.reverse(), invoices: invoices.reverse(), ...capabilities });
}

function allocateApReceipts(line, quantityRequested, approver) {
  const used = new Map();
  for (const previous of line.purchased) {
    for (const receipt of previous.receipts) {
      used.set(receipt.id, (used.get(receipt.id) ?? 0n) + decimalCell(receipt.quantity, 3, 'facturado'));
    }
  }
  let remainder = quantityRequested;
  let supported = 0n;
  const ids = new Set();
  const allocated = [];
  for (const receipt of line.receipts) {
    const available = decimal(receipt.quantity, 3, 'remisión', true);
    const consumed = used.get(receipt.id) ?? 0n;
    if (!receipt.id || ids.has(receipt.id) || !receipt.reference || !receipt.actorId || receipt.actorId === approver
      || !Number.isFinite(Date.parse(receipt.at)) || consumed > available) error(409, 'Revisa las remisiones de la partida ' + line.number + '.');
    ids.add(receipt.id);
    supported += available;
    const use = remainder < available - consumed ? remainder : available - consumed;
    if (use > 0n) allocated.push({ id: receipt.id, reference: receipt.reference, quantity: quantity(use) });
    remainder -= use;
  }
  if (remainder || supported !== decimalCell(line.received, 3, 'recibido') || [...used.keys()].some(id => !ids.has(id))) {
    error(409, 'La cantidad facturada supera la recepción verificable de la partida ' + line.number + '.');
  }
  return allocated;
}

function invoiceApOrder(body, order, invoices, priorInvoices, actorId) {
  const reference = field(body.reference, 160, 'folio de factura', true);
  const issueDate = apDate(body.issueDate, 'fecha de factura');
  const dueDate = apDate(body.dueDate, 'vencimiento');
  if (issueDate > isoTodayPanama() || dueDate < issueDate) error(400, 'Revisa la fecha y el vencimiento de la factura.');
  const currency = upper(field(body.currency, 3, 'moneda', true));
  if (currency !== order.issuer.currency) error(409, 'La moneda debe coincidir con la OC.');
  const vendor = upper(order.vendorRfc || order.vendorName);
  const identity = [order.issuer.id, vendor, upper(reference)];
  if (invoices.some(invoice => invoice.entityId === identity[0] && invoice.vendorKey === identity[1] && upper(invoice.reference) === identity[2])) {
    error(409, 'El folio de factura ya está registrado para este proveedor.');
  }
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > order.lines.length) {
    error(400, 'Agrega las partidas facturadas.');
  }
  const availableLines = new Map(apOrderLines(order, priorInvoices).map(line => [line.id, line]));
  const seen = new Set();
  let subtotal = 0n;
  const lines = body.lines.map(item => {
    const id = field(item?.lineId, 120, 'partida', true);
    const line = availableLines.get(id);
    if (!line || seen.has(id)) error(409, 'La partida debe pertenecer a la OC y aparecer una sola vez.');
    seen.add(id);
    const qty = decimal(item.quantity, 3, 'cantidad facturada', true);
    const price = decimal(item.unitPrice, 2, 'precio de factura');
    if (qty > decimalCell(line.available, 3, 'recibido sin facturar')) error(409, 'La cantidad supera el saldo recibido sin facturar de la partida ' + line.number + '.');
    if (price !== centsFor(line, 'unitPrice')) error(409, 'El precio de factura no coincide con la partida ' + line.number + ' de la OC.');
    const receipts = allocateApReceipts(line, qty, order.approvedById);
    subtotal += lineCost(qty, price);
    return { lineId: id, quantity: quantity(qty), unitPrice: money(price), receipts };
  });
  const charges = Object.fromEntries(apCharges.map(key => [key, decimal(body[key] ?? (key === 'tax' ? '' : '0'), 2, key)]));
  if (apCharges.some(key => charges[key] + sumCents(priorInvoices, key) > centsFor(order, key))) {
    error(409, 'El impuesto, descuento o cargo supera el importe disponible de la OC.');
  }
  const total = subtotal + charges.tax + charges.shipping + charges.other - charges.discount;
  const submitted = decimal(body.amount, 2, 'total de factura', true);
  if (total !== submitted || charges.discount > subtotal || total + sumCents(priorInvoices, 'total') > centsFor(order, 'total')) {
    error(409, 'El total de la factura no concilia con sus partidas y el saldo de la OC.');
  }
  return { identity, record: { reference, issueDate, dueDate, currency, entityId: identity[0], vendorKey: vendor, actorId, at: timestamp().iso,
    total: money(total), ...Object.fromEntries(apCharges.map(key => [key, money(charges[key])])), lines } };
}

async function changeAp(action, body, session, sheets, tx) {
  const data = await readApTables(sheets);
  const isInvoice = action === 'ap-invoice';
  const invoiceId = isInvoice ? null : field(body.invoiceId, 100, 'factura', true);
  const invoice = data.invoices.find(item => item.id === invoiceId);
  if (!isInvoice && !invoice) error(404, 'Factura no encontrada.');
  const { record: order, header } = orderLookup(invoice?.parent ?? field(body.folio, 90, 'OC', true), data.orders, data.lines, session);
  checkVersion(body, order);
  if (!order.issuer || !hasRecordedApproval(order) || !['Recibida parcial', 'Recibida'].includes(order.status) || order.invoice || order.payment) {
    error(409, 'La OC requiere recepción registrada y conciliación en un solo flujo.');
  }
  if (session.userId === order.approvedById || order.lines.some(line => line.receipts.some(receipt => receipt.actorId === session.userId))
    || (invoice && invoice.actorId === session.userId)) error(403, 'Usa una cuenta distinta de quien aprobó, recibió o registró la factura.');
  const prior = data.invoices.filter(item => item.parent === order.folio);
  const values = [...header.row];
  values[15] = tx.version;
  values[21] = timestamp().iso;
  let id;
  let guard;
  let write;
  let reference;
  let amount;
  if (isInvoice) {
    const created = invoiceApOrder(body, order, data.invoices, prior, session.userId);
    const { identity, record } = created;
    const legacy = entries(data.orders).some(({ row }) => row[23] && issuerSnapshot(row)?.id === identity[0]
      && upper(row[3] || row[2]) === identity[1] && upper(recordedDocument(row[23]).reference) === identity[2]);
    if (legacy) error(409, 'Esta factura ya está registrada en una OC.');
    guard = 'oc-invoice:' + hash(identity);
    id = 'FAP-' + hash(tx.key).slice(0, 20).toUpperCase();
    reference = record.reference;
    amount = record.total;
    write = append(AP_INVOICES, [[id, order.folio, JSON.stringify(record)]]);
  } else {
    reference = field(body.reference, 160, 'referencia bancaria', true);
    const date = apDate(body.date, 'fecha del pago');
    if (date < invoice.issueDate || date > isoTodayPanama()) error(400, 'La fecha del pago debe estar entre la fecha de factura y hoy.');
    const submitted = decimal(body.amount, 2, 'pago confirmado', true);
    const payments = data.payments.filter(payment => payment.parent === invoice.id);
    if (submitted + sumCents(payments, 'amount') > centsFor(invoice, 'total')) error(409, 'El pago supera el saldo de la factura.');
    if (data.payments.some(payment => payment.entityId === order.issuer.id && upper(payment.reference) === upper(reference))
      || entries(data.orders).some(({ row }) => row[24] && issuerSnapshot(row)?.id === order.issuer.id && upper(recordedDocument(row[24]).reference) === upper(reference))) {
      error(409, 'La referencia bancaria ya está registrada para esta entidad.');
    }
    guard = 'oc-payment:' + hash([order.issuer.id, '', upper(reference)]);
    id = 'PAP-' + hash(tx.key).slice(0, 20).toUpperCase();
    amount = money(submitted);
    write = append(AP_PAYMENTS, [[id, invoice.id, JSON.stringify({ reference, date, amount,
      entityId: order.issuer.id, by: session.userName, actorId: session.userId, at: timestamp().iso })]]);
    const fullyBilled = order.status === 'Recibida' && sumCents(prior, 'total') === centsFor(order, 'total')
      && apOrderLines(order, prior).every(line => decimalCell(line.invoiced, 3, 'facturado') === decimalCell(line.ordered, 3, 'ordenado'));
    if (fullyBilled && prior.every(item => {
      const paid = sumCents(data.payments.filter(payment => payment.parent === item.id), 'amount');
      return paid + (item.id === invoice.id ? submitted : 0n) === centsFor(item, 'total');
    })) values[11] = 'Pagada';
  }
  return tx.commit([write, wholeRow(PURCHASE_TABS.orders, header.index, Array.from(values, value => value ?? '')),
    auditRow(session, tx.operationId, isInvoice ? 'Factura AP conciliada' : 'Pago AP registrado', order.folio,
      reference + ' · ' + order.issuer.currency + ' ' + amount)],
  { id, folio: order.folio, number: order.number, version: tx.version }, [orderGuard(order), guard]);
}

async function purchaseApprovalPng(sheets, session, submitted) {
  const source = await sheets.registeredPurchaseSignatureSource?.(session.userId);
  if (source) {
    const png = await sheets.readPurchaseSignature?.(source);
    if (!png) error(503, 'No se pudo recuperar tu firma registrada. Reintenta antes de aprobar.');
    return png;
  }
  if (submitted === undefined) return undefined;
  if (!isPurchaseSignature(submitted)) error(400, 'Dibuja tu firma para esta OC.');
  return submitted;
}

async function changeOrder(action, body, session, sheets, tx) {
  const lookup = field(body.folio, 90, 'folio', true);
  const [orderRows, lineRows, requestRows] = await readTables(
    sheets, PURCHASE_TABS.orders, PURCHASE_TABS.lines, PURCHASE_TABS.requests,
  );
  const { record, header, items } = orderLookup(lookup, orderRows, lineRows, session);
  const { folio } = record;
  if (['order-receive', 'order-dispatch'].includes(action) && session.project === 'tmf-panama') {
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
  let purchaseSignature;

  if (action === 'order-sign') {
    if (!hasRecordedApproval(record) || record.issuer?.template !== 'transplus') error(409, 'La OC requiere una aprobación vigente.');
    if (record.approvedById !== session.userId) error(403, 'La firma corresponde a la cuenta que aprobó esta OC.');
    if (await sheets.readPurchaseSignature?.(record)) error(409, 'La OC ya tiene firma archivada.');
    const png = await purchaseApprovalPng(sheets, session, body.signature);
    if (!png) error(400, 'Esta cuenta requiere una firma para esta OC.');
    const { approvedById, approvedAt } = record;
    return tx.commit([auditRow(session, tx.operationId, 'OC firmada', folio, 'Firma de la aprobación del ' + approvedAt)],
      { folio, status: record.status, version: record.version, signed: true }, [],
      { folio, approvedById, approvedAt, png });
  }

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
    if (panama && status === 'Rechazada' && record.lines.some(line => (line.dispatches || line.dispatchReview)
      && dispatchBalances(line).inTransit > 0n)) {
      error(409, 'Cancela los despachos pendientes antes de rechazar la orden.');
    }
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
      const signatureApplies = panama && session.previewDemo !== true && record.issuer.template === 'transplus';
      if (!signatureApplies && body.signature !== undefined) error(400, 'La firma no aplica a esta OC.');
      const png = signatureApplies ? await purchaseApprovalPng(sheets, session, body.signature) : undefined;
      if (png) purchaseSignature = { folio, approvedById: session.userId, approvedAt: values[18], png };
    }
    if (status === 'Pagada' && !record.approvedById) error(409, 'La orden requiere un aprobador registrado.');
    values[11] = status;
  } else if (action === 'order-invoice' || action === 'order-payment') {
    const invoice = action === 'order-invoice';
    if ((await sheets.read(AP_INVOICES)).some(row => row[1] === record.folio)) {
      error(409, 'La OC tiene facturas en Cuentas por pagar.');
    }
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
    const previousInvoice = invoice && !record.invoiceReconciled ? record.invoice : null;
    if (invoice ? record.invoiceReconciled : record.payment) error(409, 'Esta orden ya tiene un registro de conciliación.');
    if (previousInvoice && (upper(previousInvoice.reference) !== upper(reference) || previousInvoice.currency !== record.issuer.currency
        || decimal(previousInvoice.amount, 2, 'factura registrada') !== amount)) {
      error(409, 'Concilia la factura registrada conservando su referencia, importe y moneda.');
    }
    if (!invoice && !record.invoice) error(409, 'Vincula primero la factura conciliada.');
    if (!invoice && [record.invoice.actorId, record.invoice.matchReviewedById].includes(session.userId)) {
      error(403, 'El pago requiere una cuenta distinta de quien registró o verificó la factura.');
    }
    if (!invoice && !record.invoiceReconciled) error(409, 'Contabilidad debe verificar las partidas y remisiones vigentes de la factura antes del pago.');
    const match = invoice ? matchInvoice(record, body) : undefined;
    const identity = [record.issuer.id, invoice ? upper(record.vendorRfc || record.vendorName) : '', upper(reference)];
    guards.push(previousInvoice ? 'oc-invoice-match:' + hash([...identity, record.version])
      : (invoice ? 'oc-invoice:' : 'oc-payment:') + hash(identity));
    const existing = entries(orderRows).some(({ row }) => {
      if (row === header.row || !row[column] || issuerSnapshot(row)?.id !== record.issuer.id) return false;
      if (invoice && upper(row[3] || row[2]) !== identity[1]) return false;
      return upper(recordedDocument(row[column])?.reference) === identity[2];
    });
    if (existing) error(409, 'Esta referencia ya está vinculada a otra orden.');
    const at = timestamp().iso;
    if (previousInvoice?.match) {
      writes.push(auditRow(session, tx.operationId, 'Conciliación anterior de factura', folio, JSON.stringify(previousInvoice)));
    }
    values[column] = JSON.stringify({
      reference, amount: money(amount), currency: record.issuer.currency,
      at, by: session.userName, actorId: session.userId,
      ...previousInvoice,
      ...(invoice ? { match, matchReviewedById: session.userId, matchReviewedAt: at } : { invoiceReference: record.invoice.reference }),
    });
    if (!invoice) values[11] = 'Pagada';
    detail = reference + ' · ' + record.issuer.currency + ' ' + money(amount);
    auditAction = previousInvoice ? 'Factura de OC verificada nuevamente' : invoice ? 'Factura de OC conciliada' : 'Pago de OC conciliado';
  } else if (action === 'order-dispatch') {
    if (!hasRecordedApproval(record) || !['Aprobada', 'Recibida parcial'].includes(record.status)) {
      error(409, 'La partida debe pertenecer a una OC aprobada con saldo pendiente.');
    }
    if (record.approvedById === session.userId) error(403, 'El despacho requiere una cuenta distinta de quien aprobó la OC.');
    const lineId = field(body.lineId, 120, 'partida', true);
    const item = items.find(entry => ocLine(entry.row).id === lineId);
    if (!item) error(404, 'Partida de orden no encontrada.');
    const line = ocLine(item.row);
    if (!line.partNumber) error(409, 'La partida requiere un SKU de inventario.');
    const balance = dispatchBalances(line);
    if (line.dispatches) reconcileTransit(line, balance, folio, entries(await sheets.read(PURCHASE_TABS.inventoryMovements)).map(({ row }) => row));
    const { shipments, inTransit } = balance;
    const cancelId = field(body.cancelDispatchId, 120, 'despacho original');
    const reference = field(body.reference, 160, cancelId ? 'motivo de la cancelación' : 'guía del despacho', true);
    const updated = [...item.row];
    let movementWarehouse;
    let movementAmount;
    if (cancelId) {
      if (!shipments.has(cancelId) || shipments.get(cancelId).remaining <= 0n) error(409, 'El despacho no tiene saldo por cancelar.');
      movementWarehouse = line.warehouse;
      movementAmount = shipments.get(cancelId).remaining;
      updated[LINE_DISPATCHES] = JSON.stringify(line.dispatches.map(shipment => shipment.id === cancelId
        ? { ...shipment, warehouse: movementWarehouse, cancelledAt: timestamp().iso, cancelledById: session.userId, cancelReference: reference } : shipment));
      if (!line.receipts.length && inTransit === movementAmount) updated[LINE_WAREHOUSE] = '';
      auditAction = 'Cancelación de saldo en tránsito';
      detail = [lineId, cancelId, reference].join(' · ');
    } else {
      const requestedWarehouse = field(body.warehouse || line.warehouse, 120, 'almacén', true);
      if (line.warehouse && upper(requestedWarehouse) !== upper(line.warehouse)) error(409, 'El almacén de destino de la partida ya está confirmado.');
      const part = catalogPart(await sheets.read(PURCHASE_TABS.catalog), line.partNumber, true, requestedWarehouse);
      const amount = decimal(body.quantity, 3, 'despacho confirmado', true);
      movementWarehouse = part.warehouse;
      movementAmount = amount;
      if (amount + inTransit + decimal(line.received, 3, 'recibido') > decimal(line.quantity, 3, 'ordenado', true)) {
        error(409, 'La cantidad supera el saldo de la partida por despachar.');
      }
      if ([...shipments.values()].some(shipment => upper(shipment.reference) === upper(reference))) {
        error(409, 'Esta guía ya se registró para la partida.');
      }
      updated[LINE_WAREHOUSE] = part.warehouse;
      const dispatches = [...(line.dispatches ?? []), { id: tx.version, reference, warehouse: part.warehouse, quantity: quantity(amount),
        at: timestamp().iso, actorId: session.userId }];
      dispatchBalances({ ...line, warehouse: part.warehouse, dispatches });
      updated[LINE_DISPATCHES] = JSON.stringify(dispatches);
      auditAction = 'Despacho de proveedor confirmado';
      detail = [lineId, part.warehouse, quantity(amount), reference].join(' · ');
    }
    if (updated[LINE_DISPATCHES].length > 45000) error(409, 'El historial requiere archivo antes de agregar más despachos.');
    writes.push(wholeRow(PURCHASE_TABS.lines, item.index, Array.from(updated, value => value ?? '')));
    writes.push(wholeRow(PURCHASE_TABS.orders, header.index, Array.from(values, value => value ?? '')));
    writes.push(append(PURCHASE_TABS.inventoryMovements, [[tx.version, timestamp().iso, cancelId ? 'Cancelación de despacho' : 'Despacho',
      line.partNumber, quantity(movementAmount), record.unit, folio, lineId, line.ot || '', reference,
      session.userName, session.userId, '', '', '', '', movementWarehouse, '', cancelId || tx.version]]));
    writes.push(auditRow(session, tx.operationId, auditAction, folio, detail));
    return tx.commit(writes, { folio, status: record.status, version: tx.version, ...(cancelId ? {} : { dispatchId: tx.version }) }, guards);
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
    let warehouse = '';
    if (panama) receipt.stockDisposition = line.partNumber ? 'unregistered' : 'document';
    if (panama && !line.partNumber && (body.warehouse || body.dispatchId)) error(400, 'La partida no tiene SKU para recibir en inventario.');
    if (panama && line.partNumber) {
      const requestedWarehouse = field(body.warehouse, 120, 'almacén');
      if (requestedWarehouse && line.warehouse && upper(requestedWarehouse) !== upper(line.warehouse)) {
        error(409, 'Recibe en el almacén de destino de la partida.');
      }
      const dispatchId = field(body.dispatchId, 120, 'despacho confirmado');
      const balance = dispatchBalances(line);
      const { shipments, inTransit } = balance;
      const shipment = dispatchId ? shipments.get(dispatchId) : null;
      if (dispatchId ? !shipment || increment > shipment.remaining : increment > requested - received - inTransit) {
        error(409, 'Selecciona el despacho de esta partida o usa únicamente el saldo que aún no tiene guía.');
      }
      const [movementRows, catalog] = await readTables(sheets, PURCHASE_TABS.inventoryMovements, PURCHASE_TABS.catalog);
      const history = entries(movementRows).map(({ row }) => row);
      if (line.dispatches) reconcileTransit(line, balance, folio, history);
      const part = catalogPart(catalog, line.partNumber, false, line.warehouse || requestedWarehouse);
      if (part) {
        receipt.stockDisposition = 'posted';
        warehouse = part.warehouse;
        if (warehouse) receipt.warehouse = warehouse;
        if (dispatchId) receipt.dispatchId = dispatchId;
        const physical = await stockForWriting(sheets, part);
        verifyWarehouseStock(part, history, physical);
        const nextStock = physical + increment;
        writes.push(...inventoryWrites({ part, nextStock, session, tx, kind: 'Recepción', amount: increment,
          unit: record.unit, folio, lineId, reference, dispatchId }));
        guards.push(inventoryGuard(part, history));
      }
    }
    const receipts = JSON.stringify([...line.receipts, receipt]);
    if (receipts.length > 45000) error(409, 'El historial de la partida requiere archivarse antes de recibir más.');
    const updatedLine = [...item.row.slice(0, 10), quantity(newReceived), receipts, ...item.row.slice(12)];
    if (warehouse) updatedLine[LINE_WAREHOUSE] = warehouse;
    writes.push(wholeRow(PURCHASE_TABS.lines, item.index, Array.from(updatedLine, value => value ?? '')));
    const full = newReceived === requested && record.lines.every((other) =>
      other.id === lineId || decimalCell(other.received, 3, 'recibido') >= decimalCell(other.quantity, 3, 'ordenado', true));
    values[11] = record.status === 'Pagada' ? 'Pagada' : full ? 'Recibida' : 'Recibida parcial';
    if (panama && line.requestLineId) {
      const request = requests.find(entry => entry.record.id === line.requestLineId);
      if (!request) error(409, 'Falta conciliar el vínculo entre la partida recibida y el pedido.');
      requestBalance(request.record, allocationIndex(orderRows, lineRows));
      const next = allocationIndex(orderRows, lineRows.map((row, index) => index === item.index ? updatedLine : row));
      allocationUpdate(request, next, tx, session, writes, guards);
    } else if (newReceived === requested && line.requestLineId) {
      const request = requests.find((entry) => entry.record.id === line.requestLineId && entry.record.ocFolio === folio);
      if (!request) error(409, 'Falta conciliar el vínculo entre la partida recibida y el pedido.');
      writes.push(requestUpdate(request, tx.version, session.userId, folio, 'Completado', request.row[19] || ''));
      guards.push(requestGuard(request.record));
    }
    detail = lineId + ' · ' + quantity(increment) + ' recibida(s), saldo ' + quantity(requested - newReceived);
  }

  if (values[11] === 'Eliminada' || values[11] === 'Rechazada') {
    if (panama) {
      const current = allocationIndex(orderRows, lineRows);
      const next = allocationIndex(orderRows.map((row, index) => index === header.index ? values : row), lineRows);
      const linkedIds = new Set(record.lines.map(line => line.requestLineId).filter(Boolean));
      for (const entry of requests.filter(request => linkedIds.has(request.record.id))) {
        requestBalance(entry.record, current);
        allocationUpdate(entry, next, tx, session, writes, guards);
      }
    } else {
      for (const entry of requests.filter((request) => request.record.ocFolio === folio)) {
        writes.push(requestUpdate(entry, tx.version, session.userId, '', entry.row[19] || 'Pendiente', ''));
        guards.push(requestGuard(entry.record));
      }
    }
  }
  writes.push(wholeRow(PURCHASE_TABS.orders, header.index, Array.from(values, (value) => value ?? '')));
  writes.push(auditRow(session, tx.operationId, auditAction || (action === 'order-receive' ? 'Recepción de partida' : 'Estado de OC ' + values[11]), folio, detail));
  return tx.commit(writes, { folio, status: values[11], version: tx.version, ...(purchaseSignature && { signed: true }) }, guards, purchaseSignature);
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
  let ot = field(expense.ot_id, 90, 'orden de trabajo');
  if (panama && type === 'Servicio' && ot) {
    if (!invoice) error(400, 'Indica la factura del servicio vinculado a la OT.');
    if (!normalizedTaxId(rfc)) error(400, 'Indica el registro fiscal del proveedor del servicio.');
    const order = resolveCostOrder(await sheets.read('ORDENES_TRABAJO'), ot, session);
    if (allocations.length !== 1 || allocations[0].unit !== order.unit) {
      error(409, 'Asigna el servicio únicamente a la unidad de la OT.');
    }
    ot = order.row[1];
  }
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

async function expenseAdjustment(action, params, session, sheets, tx) {
  const expenseId = field(params.id, 100, 'gasto', true);
  const [expenses, history] = await readTables(sheets, PURCHASE_TABS.expenses, EXPENSE_ADJUSTMENTS_TAB);
  const matches = entries(expenses).filter(({ row }) => trim(row[0]) === expenseId);
  if (!matches.length) error(404, 'Gasto no encontrado.');
  if (matches.length !== 1) error(409, 'El folio de gasto requiere conciliación.');
  const [{ row }] = matches;
  const unit = requireUnit(session, field(row[10], 48, 'unidad del gasto', true));
  if (tx) {
    const saved = await tx.replay();
    if (saved !== null) return ok(saved);
  }
  const cutoff = closedExpensePeriod();
  const period = expenseMonth(row[24] || row[1]);
  if (!cutoff || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period) || period > cutoff) {
    error(409, 'Contabilidad debe confirmar el cierre de este período.');
  }
  const currency = row[22];
  if (row[16] !== 'Aprobado' || !trim(row[21]) || !['USD', 'PAB'].includes(currency) || !trim(row[18])) {
    error(409, 'El ajuste requiere un gasto aprobado con entidad, moneda y autor conciliados.');
  }
  let originalAmount;
  try {
    const subtotal = decimal(row[7], 2, 'subtotal');
    const tax = decimal(row[8], 2, 'impuesto');
    const total = decimal(row[9], 2, 'importe original', true);
    if (subtotal + tax !== total) throw new Error();
    originalAmount = money(total);
  } catch {
    error(409, 'El importe original requiere conciliación.');
  }
  const scope = projectExpenseAdjustments(history, expenseId, originalAmount, row);
  if (!scope) error(409, 'El original y la bitácora del ajuste requieren conciliación.');
  const { items, pending, effectiveAmount, originalVersion, version } = scope;
  const canPropose = row[18] === session.userId && !pending;
  const canReview = pending !== null && canReviewPanamaExpense(session)
    && pending.authorId !== session.userId && row[18] !== session.userId;
  if (!tx) return ok({ expenseId, unit, period, currency, originalAmount, effectiveAmount, items, version, canPropose, canReview });

  checkVersion(params, scope);
  const actor = { id: session.userId, name: session.userName };
  const at = timestamp().iso;
  let id, event, kind, status;
  if (action === 'expense-adjustment-propose') {
    if (row[18] !== session.userId) error(403, 'Solo quien capturó este gasto puede proponer un ajuste.');
    if (pending) error(409, 'Revisa el ajuste pendiente antes de registrar otro.');
    const newAmount = money(decimal(params.amount, 2, 'importe ajustado'));
    if (newAmount === effectiveAmount) error(400, 'El importe nuevo debe ser distinto del importe anterior.');
    const reason = field(params.reason, 350, 'motivo del ajuste', true);
    id = 'AJG-' + hash(tx.key).slice(0, 18).toUpperCase();
    kind = 'propose';
    status = 'Pendiente';
    event = { originalVersion, actor, at, previousAmount: effectiveAmount, newAmount, reason };
  } else {
    id = field(params.adjustmentId, 40, 'ajuste', true);
    if (!pending || pending.id !== id) error(409, 'El ajuste ya no está pendiente de revisión.');
    if (!canReview) error(403, 'El ajuste requiere una revisión independiente de Contabilidad.');
    status = params.status;
    if (!['Aprobado', 'Rechazado'].includes(status)) error(400, 'Indica el resultado de la revisión.');
    const reason = field(params.reason, 350, 'motivo de revisión', status === 'Rechazado');
    kind = 'review';
    event = { originalVersion, actor, at, status, reason };
  }
  return tx.commit([append(EXPENSE_ADJUSTMENTS_TAB, [[expenseId, id, kind, JSON.stringify(event)]])],
    { adjustmentId: id, status }, ['gst-adjustment:' + version]);
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function sameExpenseDocument(a, b) {
  if (!upper(a[6]) || upper(a[6]) !== upper(b[6]) || upper(a[21]) !== upper(b[21])) return false;
  const aId = normalizedTaxId(a[5]);
  const bId = normalizedTaxId(b[5]);
  return aId && bId ? aId === bId : normalizeCatalogKey(a[4]).replace(/\s+/g, ' ') === normalizeCatalogKey(b[4]).replace(/\s+/g, ' ');
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
  const documentGuards = [];
  if (panama && review && status === 'Aprobado' && affected.some(({ row }) => row[3] === 'Servicio' && trim(row[11]))) {
    const row = entry.row;
    if (affected.length !== 1 || !group || !normalizedTaxId(row[5]) || !trim(row[6])) {
      error(409, 'Concilia la factura, el proveedor y la unidad del servicio vinculado.');
    }
    if (rows.some(other => other.index !== entry.index && other.row[16] === 'Aprobado' && sameExpenseDocument(row, other.row))) {
      error(409, 'La factura ya figura en otro gasto aprobado.');
    }
    documentGuards.push('pa-service-invoice:' + hash([upper(row[21]), normalizedTaxId(row[5]), upper(row[6])]));
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
  [...documentGuards, ...affected.map(({ row }) => 'gst:' + row[0] + ':' + hash(row))]);
}

function resolveCostOrder(orders, value, session) {
  const requested = upper(field(value, 90, 'orden de trabajo', true));
  const matches = entries(orders).filter(({ row }) => upper(row[1]) === requested || upper(row[25]) === requested);
  const isVisible = row => /^OT-/.test(row[1] ?? '') && trim(row[3]) && upper(row[3]) !== 'FLOTA' && canUseUnit(session, row[3]);
  if (!matches.some(({ row }) => isVisible(row))) error(404, 'Orden de trabajo no encontrada.');
  if (matches.length > 1) error(409, 'El folio de OT requiere conciliación.');
  const { row } = matches[0];
  return { row, ot: upper(row[1]), unit: requireUnit(session, row[3]), folio: trim(row[25]) || row[1] };
}

function addLaborCost({ row, ot, unit }, session, supplied, add, flag) {
  try {
    const execution = JSON.parse(row[20]);
    const review = JSON.parse(row[21]);
    if (row[9] !== 'Completado' || !execution?.userId || !execution.functionalTest || !review?.userId
        || review.userId === execution.userId || !(Date.parse(execution.submittedAt) <= Date.parse(review.acceptedAt))) {
      return flag('labor', 'Falta una aceptación técnica independiente.');
    }
    const hours = decimal(execution.laborHours, 3, 'horas aceptadas', true);
    const definitions = supplied ?? (session.previewDemo ? [] : JSON.parse(process.env.HERMES_PANAMA_LABOR_VALUATIONS_JSON || '[]'));
    const candidates = definitions.filter(item => upper(item?.ot) === ot && upper(item.unit) === unit
      && item.executorId === execution.userId && item.acceptedAt === review.acceptedAt);
    const rate = candidates.length === 1 ? candidates[0] : null;
    const value = rate && valueDefinition({ unitCost: rate.hourlyRate, currency: rate.currency, reference: rate.reference });
    if (!value || decimal(rate.hours, 3, 'horas autorizadas', true) !== hours) {
      return flag('labor', 'Falta conciliar la tarifa autorizada con las horas aceptadas.');
    }
    add('labor', value.currency, lineCost(hours, decimal(value.unitCost, 2, 'tarifa')), value.reference, review.acceptedAt);
  } catch {
    flag('labor', 'Faltan horas aceptadas o una tarifa autorizada verificable.');
  }
}

function addInventoryCosts(rows, { ot, unit, folio }, add, flag) {
  const ledger = entries(rows).map(({ row }) => row);
  const matches = new Set([ot, upper(folio)]);
  const idCount = new Map();
  const linkedReturns = new Map();
  for (const row of ledger) {
    idCount.set(trim(row[0]), (idCount.get(trim(row[0])) ?? 0) + 1);
    if (row[2] !== 'Devolución' || !trim(row[14])) continue;
    const original = trim(row[14]);
    const linked = linkedReturns.get(original) ?? [];
    linked.push(row);
    linkedReturns.set(original, linked);
  }
  const movements = ledger.filter(row => matches.has(upper(row[8])) && ['Salida', 'Devolución'].includes(row[2]));
  const returns = movements.filter(row => row[2] === 'Devolución');
  const used = new Set();
  for (const issue of movements.filter(row => row[2] === 'Salida')) {
    const id = trim(issue[0]);
    const value = recordedInventoryValue(issue[15]);
    let issued, rate;
    try {
      if (upper(issue[5]) !== unit || !id || idCount.get(id) !== 1 || !trim(issue[3]) || !trim(issue[9]) || !value) throw new Error();
      issued = decimal(issue[4], 3, 'salida', true);
      rate = decimal(value.unitCost, 2, 'costo de salida');
      if (value.delta !== money(lineCost(issued, rate))) throw new Error();
      add('parts', value.currency, lineCost(issued, rate), trim(issue[9]), id, value.reference);
    } catch {
      flag('parts', 'Hay salidas sin valuación o vínculo verificable.');
      continue;
    }
    const linked = linkedReturns.get(id) ?? [];
    const adjustments = [];
    let returned = 0n, reversal = 0n;
    try {
      for (const row of linked) {
        used.add(row);
        const credit = recordedInventoryValue(row[15]);
        const returnId = trim(row[0]);
        if (!matches.has(upper(row[8])) || upper(row[5]) !== unit || upper(row[3]) !== upper(issue[3])
            || !returnId || idCount.get(returnId) !== 1 || !trim(row[9])
            || !credit || credit.unitCost !== value.unitCost || credit.currency !== value.currency || credit.reference !== value.reference
            || !/^(?:-\d+\.\d{2}|0\.00)$/.test(credit.delta)) throw new Error();
        const qty = decimal(row[4], 3, 'devolución', true);
        const amount = decimal(credit.delta.replace(/^-/, ''), 2, 'costo devuelto');
        const minimum = qty * rate / 1000n;
        if (amount < minimum || amount > (qty * rate + 999n) / 1000n) throw new Error();
        returned += qty;
        reversal += amount;
        adjustments.push([trim(row[9]), returnId, -amount]);
      }
      if (returned > issued || reversal !== lineCost(returned, rate)) throw new Error();
      for (const [reference, sourceId, amount] of adjustments) add('returns', value.currency, amount, reference, sourceId, value.reference);
    } catch {
      flag('returns', 'Hay devoluciones cuyo saldo o valuación original requiere conciliación.');
    }
  }
  if (returns.some(row => !used.has(row))) flag('returns', 'Hay devoluciones sin una salida original verificable.');
}

function addServiceCosts(rows, { ot, unit, folio }, add, flag) {
  const active = entries(rows).map(({ row }) => row).filter(row => !['Eliminado', 'Rechazado'].includes(row[16]));
  const approved = active.filter(row => row[16] === 'Aprobado');
  const groups = new Map();
  const ids = new Map();
  for (const row of active) {
    const group = trim(row[17]);
    const id = trim(row[0]);
    groups.set(group, [...(groups.get(group) ?? []), row]);
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const row of active.filter(row => row[3] === 'Servicio' && [ot, upper(folio)].includes(upper(row[11])))) {
    try {
      const group = trim(row[17]);
      const id = trim(row[0]);
      if (upper(row[10]) !== unit || row[16] !== 'Aprobado' || !group || !id || ids.get(id) !== 1 || groups.get(group)?.length !== 1
          || approved.some(other => other !== row && trim(other[17]) !== group && sameExpenseDocument(row, other))
          || !trim(row[4]) || !normalizedTaxId(row[5]) || !trim(row[6]) || !trim(row[21]) || !trim(row[24])
          || !trim(row[18]) || !trim(row[25]) || row[18] === row[25] || !Number.isFinite(Date.parse(row[26]))
          || !['USD', 'PAB'].includes(row[22])) throw new Error();
      const amount = decimal(row[9], 2, 'importe de factura', true);
      if (decimal(row[7], 2, 'subtotal') + decimal(row[8], 2, 'impuesto') !== amount
          || decimal(row[19], 2, 'total del documento') !== amount) throw new Error();
      add('services', row[22], amount, trim(row[6]), group);
    } catch {
      flag('services', 'Hay facturas de servicio pendientes de aprobación o conciliación.');
    }
  }
}

async function readWorkOrderCost(sheets, session, identifier, laborValuations) {
  // Check scope before reading supporting ledgers. Native readers take one snapshot of the related data.
  resolveCostOrder(await sheets.read('ORDENES_TRABAJO'), identifier, session);
  const [orders, movements, expenses] = await readTables(sheets, 'ORDENES_TRABAJO', PURCHASE_TABS.inventoryMovements, PURCHASE_TABS.expenses);
  const order = resolveCostOrder(orders, identifier, session);
  const totals = new Map();
  const lines = [];
  const pending = [];
  const flag = (kind, reason) => {
    if (!pending.some(item => item.kind === kind && item.reason === reason)) pending.push({ kind, reason });
  };
  const signedMoney = cents => cents < 0n ? '-' + money(-cents) : money(cents);
  const add = (kind, currency, cents, reference, sourceId, valuationReference) => {
    const group = totals.get(currency) ?? { labor: 0n, parts: 0n, returns: 0n, services: 0n, amount: 0n };
    group[kind] += cents;
    group.amount += cents;
    totals.set(currency, group);
    lines.push({ kind, currency, amount: signedMoney(cents), reference, sourceId, ...(valuationReference && { valuationReference }) });
  };
  addLaborCost(order, session, laborValuations, add, flag);
  addInventoryCosts(movements, order, add, flag);
  addServiceCosts(expenses, order, add, flag);
  return { ot: order.ot, folio: order.folio, unit: order.unit, project: session.project, lines, pending,
    totals: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, group]) => ({ currency,
      ...Object.fromEntries(Object.entries(group).map(([key, value]) => [key, signedMoney(value)])),
    })) };
}

const WRITES = new Set(['ap-invoice', 'ap-payment', 'request-submit', 'request-status', 'order-save', 'order-status', 'order-sign', 'order-receive', 'order-dispatch', 'order-invoice', 'order-payment', 'order-delete', 'inventory-move', 'inventory-reservation', 'expense-save', 'expense-delete', 'expense-review', 'expense-adjustment-propose', 'expense-adjustment-review']);
const READS = new Set(['ap', 'orders', 'order', 'receiving', 'requests', 'expenses', 'inventory-movements', 'inventory-stock', 'inventory-replenishment', 'ot-part', 'expense-options', 'workorder-cost', 'expense-adjustments']);

export async function dispatchPurchasing({ path, method, body = {}, query = {}, session, sheets, evidenceStorage, inventoryValuations, laborValuations }) {
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
      : ['inventory-move', 'inventory-reservation', 'order-dispatch'].includes(action) ? warehouseAccess
      : ['inventory-movements', 'inventory-stock', 'ot-part'].includes(action) ? panama && (warehouseAccess || REQUEST_ROLES.has(session.role))
      : action === 'inventory-replenishment' ? panama && session.allUnits === true && (warehouseAccess || session.role === 'gerencia')
      : action === 'workorder-cost' ? panama && session.role === 'gerencia'
      : action === 'ap' ? panama && session.role === 'gerencia' && (session.previewDemo !== true || invoiceAccess || paymentAccess)
      : action === 'ap-invoice' ? invoiceAccess
      : action === 'ap-payment' ? paymentAccess
      : action === 'order-invoice' ? invoiceAccess
      : action === 'order-payment' ? paymentAccess
      : action === 'requests' ? REQUEST_ROLES.has(session.role)
      : action === 'request-submit' ? session.role === 'jefe_taller'
      : action === 'expense-review' ? panama && canReviewPanamaExpense(session)
      : action === 'expense-adjustment-review' ? panama && !session.previewDemo && canReviewPanamaExpense(session)
      : ['expense-adjustments', 'expense-adjustment-propose'].includes(action) ? panama && !session.previewDemo && EXPENSE_ROLES.has(session.role)
      : action === 'expenses' || action.startsWith('expense-') ? EXPENSE_ROLES.has(session.role) : session.role === 'gerencia';
    if (!roleAllowed || (['order-status', 'order-sign'].includes(action) && session.canApprovePurchases !== true)
      || (action === 'order-sign' && (!panama || session.previewDemo === true))) {
      error(403, 'Tu cuenta no tiene permiso para realizar esta acción.');
    }
    if (action === 'ap') return apRead(await readApTables(sheets), session,
      { canRecordInvoice: invoiceAccess, canRecordPayment: paymentAccess });
    if (action === 'workorder-cost') return ok(await readWorkOrderCost(sheets, session, query.ot, laborValuations));
    if (action === 'inventory-stock') return ok(await inventoryByWarehouse(sheets, session));
    if (action === 'inventory-replenishment') return ok(await inventoryByWarehouse(sheets, session, query));
    if (action === 'ot-part') return ok(await readWorkOrderPart(sheets, session, query));
    if (action === 'inventory-movements') {
      const ot = upper(field(query.ot, 90, 'OT'));
      const [movements, workOrders] = await readTables(sheets, PURCHASE_TABS.inventoryMovements, 'ORDENES_TRABAJO');
      const folios = new Map(entries(workOrders).filter(({ row }) => canUseUnit(session, row[3]) && /^OT-\d{4,15}$/.test(row[25] ?? ''))
        .map(({ row }) => [upper(row[1]), row[25]]));
      const rows = entries(movements).map(({ row }) => row)
        .filter(row => trim(row[0]) && canUseUnit(session, row[5]) && (!ot || upper(row[8]) === ot || folios.get(upper(row[8])) === ot));
      const groups = new Map();
      for (const row of rows) {
        const key = movementScope(row), group = groups.get(key) ?? [];
        group.push(row);
        groups.set(key, group);
      }
      const items = rows.map(row => {
        const item = { ...movementRecord(row), otFolio: folios.get(upper(row[8])) };
        if (item.kind !== 'Salida') return item;
        try {
          return { ...item, returnable: quantity(issueBalance(row, groups.get(movementScope(row))).left) };
        } catch {
          return { ...item, returnable: null };
        }
      });
      const numbers = await purchaseNumbers(sheets, session, items.map(item => item.order));
      return ok({ items: items.reverse().map(item => ({ ...item, orderNumber: numbers.get(item.order) })) });
    }
    if (action === 'requests') {
      if (panama) {
        const [requests, orders, lines] = await readTables(sheets, PURCHASE_TABS.requests, PURCHASE_TABS.orders, PURCHASE_TABS.lines);
        const index = allocationIndex(orders, lines);
        const items = parseRequests(requests).filter(({ record }) => canUseUnit(session, record.equipo)).reverse().map(({ record }) => {
          try {
            const balance = requestBalance(record, index);
            return { ...record, allocations: balance.allocations, allocatedQuantity: quantity(balance.allocated),
              receivedQuantity: quantity(balance.received), unallocatedQuantity: quantity(balance.wanted - balance.allocated),
              ocNumber: balance.allocations.find(entry => entry.folio === record.ocFolio)?.number };
          } catch (cause) {
            if (!(cause instanceof RequestError) || cause.status !== 409) throw cause;
            return { ...record, allocationReview: true };
          }
        });
        return ok({ items });
      }
      const data = parseRequests(await sheets.read(PURCHASE_TABS.requests));
      const items = data.filter(({ record }) => canUseUnit(session, record.equipo)).map(({ record }) => record).reverse();
      const numbers = await purchaseNumbers(sheets, session, items.map(item => item.ocFolio));
      return ok({ items: items.map(item => ({ ...item, ocNumber: numbers.get(item.ocFolio) })) });
    }
    if (action === 'expense-options') return ok(expenseOptions(session));
    if (action === 'expense-adjustments') return await expenseAdjustment(action, query, session, sheets);
    if (action === 'expenses') {
      const rows = entries(await sheets.read(PURCHASE_TABS.expenses));
      return ok({ rows: rows.filter(({ row }) => trim(row[0]) && canUseUnit(session, row[10])).map(({ row }) => row), ...expenseOptions(session) });
    }
    if (action === 'order' || action === 'orders' || action === 'receiving') {
      const [orders, lines] = await readTables(sheets, PURCHASE_TABS.orders, PURCHASE_TABS.lines);
      if (action === 'order') {
        const { record } = orderLookup(field(query.folio, 90, 'folio', true), orders, lines, session);
        const approvalSignature = panama && session.previewDemo !== true && record.issuer?.template === 'transplus'
          && hasRecordedApproval(record) ? await sheets.readPurchaseSignature?.(record) : undefined;
        const canSign = panama && session.previewDemo !== true && session.canApprovePurchases === true
          && record.issuer?.template === 'transplus' && hasRecordedApproval(record) && record.approvedById === session.userId;
        const awaitingSignature = canSign && !approvalSignature;
        const usesRegisteredSignature = awaitingSignature && Boolean(await sheets.registeredPurchaseSignatureSource?.(session.userId));
        return ok({ order: record, ...(approvalSignature && { approvalSignature }), ...(awaitingSignature && { canSign: true }),
          ...(usesRegisteredSignature && { usesRegisteredSignature: true }) });
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
        const stock = await Promise.resolve().then(async () => catalogStockRows(await sheets.read(PURCHASE_TABS.catalog))).catch(() => []);
        return ok({ orders: rows.filter(({ row }) => canUseUnit(session, row[5]) && RECEIPT_ORDER_STATUS.has(trim(row[11])))
          .map(({ row }) => orderRecord(row, linked.get(upper(row[0])) || []))
          .filter(hasRecordedApproval).map(order => receivingRecord(order, stock)).reverse() });
      }
      const headerFolios = new Set(entries(orders).map(({ row }) => upper(row[0])).filter(Boolean));
      const orphanFolios = session.allUnits === true ? [...linked.keys()].filter((folio) => !headerFolios.has(folio)) : [];
      const vendors = entries(await sheets.read(PURCHASE_TABS.vendors)).map(({ row }) => vendorRecord(row)).filter((vendor) => vendor.name);
      const usesRegisteredSignature = panama && session.previewDemo !== true && session.canApprovePurchases === true
        && Boolean(await sheets.registeredPurchaseSignatureSource?.(session.userId));
      return ok({
        orders: rows.filter(({ row }) => canUseUnit(session, row[5]))
          .map(({ row }) => orderRecord(row, linked.get(upper(row[0])) || [])).reverse(),
        vendors, orphanFolios, issuers: configuredIssuers(session), canApprove: session.canApprovePurchases === true,
        canRecordInvoice: invoiceAccess, canRecordPayment: paymentAccess,
        ...(usesRegisteredSignature && { usesRegisteredSignature: true }),
      });
    }
    tx = mutate(action, body, session, sheets);
    if (panama && ['order-receive', 'order-dispatch'].includes(action)) return await changeOrder(action, body, session, sheets, tx);
    if (action === 'inventory-move') return await moveInventory(body, session, sheets, tx, inventoryValuations);
    if (action === 'inventory-reservation') return await reserveInventory(body, session, sheets, tx);
    if (['expense-adjustment-propose', 'expense-adjustment-review'].includes(action)) {
      return await expenseAdjustment(action, body, session, sheets, tx);
    }
    const previous = await tx.replay();
    if (previous !== null) return ok(previous);
    if (action === 'ap-invoice' || action === 'ap-payment') return await changeAp(action, body, session, sheets, tx);
    if (action === 'request-submit') return await submitRequest(body, session, sheets, tx);
    if (action === 'request-status') return await changeRequest(body, session, sheets, tx);
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
