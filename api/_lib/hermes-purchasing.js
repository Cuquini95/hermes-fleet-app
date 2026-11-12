import { createHash } from 'node:crypto';

export const PURCHASE_TABS = Object.freeze({
  orders: 'Órdenes de Compra',
  lines: 'OC_Lineas',
  requests: 'Cotizaciones_Pendientes',
  vendors: 'Proveedores',
  expenses: '02 Gastos',
  audit: '10 Control Cambios',
});

const REQUEST_ROLES = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const EXPENSE_ROLES = new Set(['jefe_taller', 'coordinador', 'gerencia']);
const REQUEST_STATUS = new Set(['Pendiente', 'Pedido', 'Completado']);
const OP_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DEFAULT_ISSUER = {
  id: 'ULTRATK_MX', name: 'ULTRATK SA DE CV', currency: 'MXN', taxLabel: 'IVA', taxBps: 1600,
  address: 'Juarez 312, Revolucion · Tecalitlan, Jalisco', phone: '314-115-1515', template: 'ultratk',
};

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
  const zone = { timeZone: 'America/Mexico_City' };
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

function configuredIssuers() {
  const source = process.env.HERMES_PURCHASE_ISSUERS_JSON;
  if (!source) return [DEFAULT_ISSUER];
  try {
    const data = JSON.parse(source);
    if (!Array.isArray(data) || new Set(data.map((i) => i.id)).size !== data.length) return [];
    return data.filter((i) =>
      typeof i.id === 'string' && /^[A-Z0-9_-]{2,40}$/.test(i.id) &&
      typeof i.name === 'string' && i.name.trim().length > 0 && i.name.length < 160 &&
      ['MXN', 'USD', 'PAB'].includes(i.currency) && Number.isInteger(i.taxBps) &&
      i.taxBps >= 0 && i.taxBps <= 10000 && typeof i.taxLabel === 'string' &&
      ['ultratk', 'transplus'].includes(i.template)
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

function orderRecord(row, items) {
  const lines = items.map((item) => ocLine(item.row)).sort((a, b) => Number(a.number) - Number(b.number));
  const anyReceived = lines.some((line) => Number(line.received) > 0);
  const allReceived = lines.length > 0 && lines.every((line) => Number(line.received) >= Number(line.quantity));
  return {
    folio: trim(row[0]), date: trim(row[1]), vendorName: trim(row[2]), vendorRfc: trim(row[3]), vendorAddress: trim(row[4]),
    unit: trim(row[5]), subtotal: trim(row[6]), tax: trim(row[7]), shipping: trim(row[8]), other: trim(row[9]), total: trim(row[10]),
    status: trim(row[11]) || 'Borrador', comments: trim(row[12]), approvedBy: trim(row[13]), deliveryDate: trim(row[14]),
    version: trim(row[15]) || 'legacy-' + hash([row, items.map((item) => item.row)]).slice(0, 24),
    issuer: issuerSnapshot(row), approvedById: trim(row[17]), approvedAt: trim(row[18]), requestedBy: trim(row[20]),
    receiptStatus: allReceived ? 'Recibida' : anyReceived ? 'Recibida parcial' : 'Pendiente',
    lines,
  };
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
  const fingerprint = hash([session.userId, action, body]);
  return {
    operationId, key, fingerprint,
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

async function submitRequest(body, session, tx) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    error(400, 'Agrega entre 1 y 100 partidas al pedido.');
  }
  const now = timestamp();
  const folio = 'PED-' + hash(tx.key).slice(0, 18).toUpperCase();
  const rows = body.items.map((item, index) => {
    const part = field(item.part_number, 120, 'número de parte', true);
    const description = field(item.description, 500, 'descripción', true);
    const qty = decimal(item.quantity, 3, 'pedido', true);
    const unitPrice = decimal(item.unit_price ?? 0, 2, 'precio unitario');
    const unit = requireUnit(session, field(item.equipment, 48, 'unidad', true));
    const source = item.isManual === true ? 'Manual' : field(item.source, 120, 'origen') || 'Catálogo';
    const priority = ['Normal', 'Urgente', 'Crítico'].includes(item.urgencia) ? item.urgencia : 'Normal';
    return [
      now.date, part, description, unit, quantity(qty), source, 'Pendiente', '', '', folio, now.time, session.userName,
      priority, field(item.notes, 1000, 'notas'), money(lineCost(qty, unitPrice)), folio + '-L' + (index + 1),
      '', tx.operationId, session.userId, '', now.iso, money(unitPrice),
    ];
  });
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
  const write = requestUpdate(entry, tx.operationId, session.userId, '', status, '');
  return tx.commit([
    write, auditRow(session, tx.operationId, 'Estado de partida de pedido', id, record.estado + ' → ' + status),
  ], { id, status, version: tx.operationId }, [requestGuard(record)]);
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
  const [orderRows, lineRows, vendorRows, requestRows] = await Promise.all([
    sheets.read(PURCHASE_TABS.orders), sheets.read(PURCHASE_TABS.lines),
    sheets.read(PURCHASE_TABS.vendors), sheets.read(PURCHASE_TABS.requests),
  ]);
  const folio = upper(field(body.folio, 90, 'folio')) || 'OC-' + hash(tx.key).slice(0, 18).toUpperCase();
  const current = body.folio ? orderLookup(folio, orderRows, lineRows, session) : null;
  if (current) {
    requireDraft(current.record);
    checkVersion(body, current.record);
  } else if ([...entries(orderRows), ...entries(lineRows)].some(({ row }) => upper(row[0]) === folio)) {
    error(409, 'El folio ya existe en cabeceras o partidas. Se requiere conciliación.');
  }
  const unit = requireUnit(session, body.unit);
  const issuer = configuredIssuers().find((item) => item.id === body.entity);
  if (!issuer) error(400, 'Selecciona una entidad emisora configurada.');
  const vendors = entries(vendorRows).map(({ row }) => vendorRecord(row)).filter((vendor) =>
    vendor.name && upper(vendor.name) === upper(body.vendorName) && upper(vendor.rfc) === upper(body.vendorRfc));
  if (vendors.length !== 1) error(400, 'Selecciona un proveedor único del catálogo.');
  const vendor = vendors[0];
  const date = calendarDate(body.date, 'la orden', true);
  const deliveryDate = calendarDate(body.deliveryDate, 'entrega', false);
  const requests = parseRequests(requestRows);
  const items = buildOrderLines(body, unit, folio, current, requests, session);
  const subtotal = items.reduce((sum, line) => sum + lineCost(line.qty, line.price), 0n);
  const tax = (subtotal * BigInt(issuer.taxBps) + 5000n) / 10000n;
  const shipping = decimal(body.shipping ?? '0', 2, 'envío');
  const other = decimal(body.other ?? '0', 2, 'otros cargos');
  const total = subtotal + tax + shipping + other;
  const now = timestamp();
  const values = [
    folio, date, vendor.name, vendor.rfc, vendor.address, unit, money(subtotal), money(tax), money(shipping), money(other), money(total),
    'Borrador', field(body.comments, 2000, 'comentarios'), '', deliveryDate, tx.operationId, JSON.stringify(issuer),
    '', '', current?.header.row[19] || session.userId, current?.header.row[20] || session.userName, now.iso,
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
      writes.push(requestUpdate(entry, tx.operationId, session.userId, folio, 'Pedido', entry.record.estado));
      guards.push(requestGuard(entry.record));
    }
    if (entry.record.ocFolio === folio && !linked.has(entry.record.id)) {
      writes.push(requestUpdate(entry, tx.operationId, session.userId, '', entry.row[19] || 'Pendiente', ''));
      guards.push(requestGuard(entry.record));
    }
  }
  writes.push(auditRow(session, tx.operationId, current ? 'OC editada' : 'OC creada', folio, items.length + ' partidas'));
  return tx.commit(writes, { folio, total: money(total), version: tx.operationId }, guards);
}

async function changeOrder(action, body, session, sheets, tx) {
  const folio = field(body.folio, 90, 'folio', true);
  const [orderRows, lineRows, requestRows] = await Promise.all([
    sheets.read(PURCHASE_TABS.orders), sheets.read(PURCHASE_TABS.lines), sheets.read(PURCHASE_TABS.requests),
  ]);
  const { record, header, items } = orderLookup(folio, orderRows, lineRows, session);
  checkVersion(body, record);
  const guards = [orderGuard(record)];
  const values = [...header.row];
  values[15] = tx.operationId;
  values[21] = timestamp().iso;
  const writes = [];
  const requests = parseRequests(requestRows);
  let detail = record.status;

  if (action === 'order-delete') {
    if (!['Borrador', 'Rechazada'].includes(record.status) || record.receiptStatus !== 'Pendiente') {
      error(409, 'La OC tiene un compromiso o recepción y requiere conservar su registro.');
    }
    values[11] = 'Eliminada';
  } else if (action === 'order-status') {
    const status = field(body.status, 32, 'estado', true);
    const allowed = {
      Borrador: ['Aprobada', 'Rechazada'],
      Aprobada: ['Pagada', ...(record.receiptStatus === 'Pendiente' ? ['Rechazada'] : [])],
      'Recibida parcial': ['Pagada'],
      Recibida: ['Pagada'],
    };
    if (!allowed[record.status]?.includes(status)) error(409, 'Cambio de estado no válido para esta orden.');
    if (status === 'Aprobada') {
      if (!record.issuer || !record.lines.length || !record.vendorName) error(409, 'Completa la entidad, el proveedor y las partidas.');
      values[13] = session.userName;
      values[17] = session.userId;
      values[18] = timestamp().iso;
    }
    if (status === 'Pagada' && !record.approvedById) error(409, 'La orden requiere un aprobador registrado.');
    values[11] = status;
  } else {
    if (!['Aprobada', 'Recibida parcial', 'Pagada'].includes(record.status) || !record.approvedById) {
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
    const receipt = {
      id: tx.operationId, at: timestamp().iso, by: session.userName, actorId: session.userId,
      quantity: quantity(increment), reference: field(body.reference, 160, 'referencia'),
    };
    const receipts = JSON.stringify([...line.receipts, receipt]);
    if (receipts.length > 45000) error(409, 'El historial de la partida requiere archivarse antes de recibir más.');
    writes.push(wholeRow(PURCHASE_TABS.lines, item.index, [...item.row.slice(0, 10), quantity(newReceived), receipts]));
    const full = newReceived === requested && record.lines.every((other) =>
      other.id === lineId || decimalCell(other.received, 3, 'recibido') >= decimalCell(other.quantity, 3, 'ordenado', true));
    values[11] = record.status === 'Pagada' ? 'Pagada' : full ? 'Recibida' : 'Recibida parcial';
    if (newReceived === requested && line.requestLineId) {
      const request = requests.find((entry) => entry.record.id === line.requestLineId && entry.record.ocFolio === folio);
      if (!request) error(409, 'Falta conciliar el vínculo entre la partida recibida y el pedido.');
      writes.push(requestUpdate(request, tx.operationId, session.userId, folio, 'Completado', request.row[19] || ''));
      guards.push(requestGuard(request.record));
    }
    detail = lineId + ' · ' + quantity(increment) + ' recibida(s), saldo ' + quantity(requested - newReceived);
  }

  if (values[11] === 'Eliminada' || values[11] === 'Rechazada') {
    for (const entry of requests.filter((request) => request.record.ocFolio === folio)) {
      writes.push(requestUpdate(entry, tx.operationId, session.userId, '', entry.row[19] || 'Pendiente', ''));
      guards.push(requestGuard(entry.record));
    }
  }
  writes.push(wholeRow(PURCHASE_TABS.orders, header.index, Array.from(values, (value) => value ?? '')));
  writes.push(auditRow(session, tx.operationId, action === 'order-receive' ? 'Recepción de partida' : 'Estado de OC ' + values[11], folio, detail));
  return tx.commit(writes, { folio, status: values[11], version: tx.operationId }, guards);
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

async function saveExpense(body, session, tx) {
  const expense = body.expense ?? {};
  const type = field(expense.tipo, 30, 'tipo de gasto', true);
  const method = field(expense.metodo_pago, 30, 'método de pago', true);
  if (!['Refaccion', 'Combustible', 'Servicio', 'Otro'].includes(type) || !['Efectivo', 'Transferencia', 'Tarjeta'].includes(method)) {
    error(400, 'Revisa el tipo de gasto y el método de pago.');
  }
  const vendor = field(expense.proveedor, 180, 'proveedor', true);
  const subtotal = decimal(expense.subtotal, 2, 'subtotal');
  const tax = decimal(expense.iva, 2, 'IVA');
  const total = decimal(expense.total, 2, 'total', true);
  if (subtotal + tax !== total) error(400, 'El subtotal y el IVA deben sumar el total.');
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
  const image = field(expense.imagen_url, 1200, 'recibo');
  if (image) {
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
  const folio = 'GST-' + hash(tx.key).slice(0, 18).toUpperCase();
  const rfc = field(expense.rfc_proveedor, 60, 'RFC del proveedor');
  const invoice = field(expense.folio_factura, 120, 'factura');
  const ot = field(expense.ot_id, 90, 'orden de trabajo');
  const rows = distributeTax(allocations, tax, total).map((allocation, index) => [
    folio + '-' + (index + 1), now.date, now.time, type, vendor, rfc, invoice,
    money(allocation.amount - allocation.tax), money(allocation.tax), money(allocation.amount), allocation.unit,
    ot, session.userName, method, items, image, 'Aprobado', folio, session.userId, money(total), tx.operationId,
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

async function deleteExpense(body, session, sheets, tx) {
  const id = field(body.id, 100, 'gasto', true);
  const rows = entries(await sheets.read(PURCHASE_TABS.expenses));
  const matches = rows.filter(({ row }) => trim(row[0]) === id);
  if (matches.length > 1) error(409, 'El folio de gasto requiere conciliación.');
  const entry = matches[0];
  if (!entry || entry.row[16] === 'Eliminado') error(404, 'Gasto no encontrado.');
  const group = trim(entry.row[17]);
  const affected = group ? rows.filter(({ row }) => trim(row[17]) === group && row[16] !== 'Eliminado') : [entry];
  for (const { row } of affected) requireUnit(session, row[10]);
  return tx.commit([
    ...affected.map(({ index }) => ({ tab: PURCHASE_TABS.expenses, row: index, col: 16, values: ['Eliminado'] })),
    auditRow(session, tx.operationId, 'Gasto eliminado', group || id, affected.length + ' unidad(es)'),
  ], { id, removed: affected.map(({ row }) => row[0]) }, affected.map(({ row }) => 'gst:' + row[0] + ':' + hash(row)));
}

const WRITES = new Set(['request-submit', 'request-status', 'order-save', 'order-status', 'order-receive', 'order-delete', 'expense-save', 'expense-delete']);
const READS = new Set(['orders', 'order', 'requests', 'expenses']);

export async function dispatchPurchasing({ path, method, body = {}, query = {}, session, sheets }) {
  const action = path.replace(/^api\/purchasing\//, '');
  let tx;
  try {
    if (!session?.userId || !session?.userName) error(401, 'Inicia sesión para continuar.');
    if (!READS.has(action) && !WRITES.has(action)) error(404, 'Ruta de compras desconocida.');
    if (READS.has(action) ? method !== 'GET' : method !== 'POST') error(405, 'Método no permitido.');
    const roleAllowed = action === 'requests' ? REQUEST_ROLES.has(session.role)
      : action === 'request-submit' ? session.role === 'jefe_taller'
      : action === 'expenses' || action.startsWith('expense-') ? EXPENSE_ROLES.has(session.role) : session.role === 'gerencia';
    if (!roleAllowed || (action === 'order-status' && session.canApprovePurchases !== true)) {
      error(403, 'Tu cuenta no tiene permiso para realizar esta acción.');
    }
    if (action === 'requests') {
      const data = parseRequests(await sheets.read(PURCHASE_TABS.requests));
      return ok({ items: data.filter(({ record }) => canUseUnit(session, record.equipo)).map(({ record }) => record).reverse() });
    }
    if (action === 'expenses') {
      const rows = entries(await sheets.read(PURCHASE_TABS.expenses));
      return ok({ rows: rows.filter(({ row }) => trim(row[0]) && canUseUnit(session, row[10])).map(({ row }) => row) });
    }
    if (action === 'order' || action === 'orders') {
      const [orders, lines] = await Promise.all([sheets.read(PURCHASE_TABS.orders), sheets.read(PURCHASE_TABS.lines)]);
      if (action === 'order') {
        const { record } = orderLookup(field(query.folio, 90, 'folio', true), orders, lines, session);
        return ok({ order: record });
      }
      const rows = entries(orders).filter(({ row }) => trim(row[0]) && trim(row[11]) !== 'Eliminada');
      const headerFolios = new Set(entries(orders).map(({ row }) => upper(row[0])).filter(Boolean));
      const orphanFolios = session.allUnits === true
        ? [...new Set(entries(lines).map(({ row }) => upper(row[0])).filter((folio) => folio && !headerFolios.has(folio)))]
        : [];
      const linked = new Map();
      for (const item of entries(lines)) {
        const folio = upper(item.row[0]);
        if (folio) linked.set(folio, [...(linked.get(folio) || []), item]);
      }
      const vendors = entries(await sheets.read(PURCHASE_TABS.vendors)).map(({ row }) => vendorRecord(row)).filter((vendor) => vendor.name);
      return ok({
        orders: rows.filter(({ row }) => canUseUnit(session, row[5]))
          .map(({ row }) => orderRecord(row, linked.get(upper(row[0])) || [])).reverse(),
        vendors, orphanFolios, issuers: configuredIssuers(), canApprove: session.canApprovePurchases === true,
      });
    }
    tx = mutate(action, body, session, sheets);
    const previous = await tx.replay();
    if (previous !== null) return ok(previous);
    if (action === 'request-submit') return await submitRequest(body, session, tx);
    if (action === 'request-status') return await changeRequest(body, session, sheets, tx);
    if (action === 'order-save') return await saveOrder(body, session, sheets, tx);
    if (action === 'expense-save') return await saveExpense(body, session, tx);
    if (action === 'expense-delete') return await deleteExpense(body, session, sheets, tx);
    return await changeOrder(action, body, session, sheets, tx);
  } catch (cause) {
    const status = Number(cause?.status);
    if (tx && (status === 409 || status === 404)) {
      const replayed = await tx.replay().catch(() => null);
      if (replayed !== null) return ok(replayed);
    }
    if (cause instanceof RequestError || status === 409) return { status, body: { error: cause.message } };
    return { status: 503, body: { error: 'No pudimos confirmar el guardado o la lectura. Actualiza o reintenta la misma operación.' } };
  }
}
