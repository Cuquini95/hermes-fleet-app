import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { dispatchPurchasing, PURCHASE_TABS as TAB } from '../../api/_lib/hermes-purchasing.js';

const manager = {
  userId: 'actor-qa-gerencia', userName: 'Gerencia de prueba', role: 'gerencia', allUnits: true,
  projects: ['QA'], assignedUnits: [], canApprovePurchases: true,
};

function store({ vendors = [['NOMBRE'], ['Proveedor de prueba', 'RFC-QA', 'Dirección QA']] } = {}) {
  let rows = {
    [TAB.orders]: [['OC_ID']],
    [TAB.lines]: [['OC_ID'], ['OC-001', '1', 'Partida histórica sin cabecera', '1', '10', '10']],
    [TAB.requests]: [['Fecha']],
    [TAB.vendors]: vendors,
    [TAB.expenses]: [['Gasto_ID']],
    [TAB.audit]: [['Registro']],
    '12 Inventario Rep.': [['SKU','Descripción','OEM','Serie','Unidad','Stock','Mínimo','Precio','Ubicación','','Equipo'], ['SKU-QA','Filtro QA','','','pza','4','2','5','','','QA-DZ203']],
    'Movimientos Repuestos PA': [['ID']],
    '01 Inventario': [['#','COD1','Descripción','Marca','Modelo'], ['1','QA-DZ203','Equipo QA','Komatsu','D65EX-16'], ['2','QA-EX401','Equipo QA','Doosan','DX360']],
    ORDENES_TRABAJO: [['ROW_ID','OT_ID','FECHA','UNIDAD'], ['1','OT-QA-01','','QA-DZ203','','','','','','En reparación']],
  };
  const used = new Set();
  const replies = new Map();
  let failure;
  let catalogStockFormula;
  return {
    inspect: (tab) => structuredClone(rows[tab]),
    async read(tab, { valueRenderOption } = {}) {
      const result = structuredClone(rows[tab]);
      if (tab === TAB.catalog && valueRenderOption === 'FORMULA' && catalogStockFormula) result[1][5] = catalogStockFormula;
      return result;
    },
    setCatalogStockFormula(formula) { catalogStockFormula = formula; },
    seed(tab, data) { rows[tab] = structuredClone(data); },
    failNext(mode) { failure = mode; },
    async replay({ key, fingerprint }) {
      const prior = replies.get(key);
      if (prior && prior.fingerprint !== fingerprint) throw Object.assign(new Error('Operación reutilizada.'), { status: 409 });
      return prior?.result ?? null;
    },
    async commit({ key, fingerprint, guards, writes, result }) {
      const prior = replies.get(key);
      if (prior) {
        assert.equal(prior.fingerprint, fingerprint);
        return { replayed: true, result: prior.result };
      }
      if (guards.some((guard) => used.has(guard))) throw Object.assign(new Error('Cambió la versión.'), { status: 409 });
      if (failure === 'before') {
        failure = undefined;
        throw new Error('prueba de fallo antes de la escritura');
      }
      const updated = structuredClone(rows);
      for (const write of writes) {
        const tab = updated[write.tab];
        assert.ok(tab);
        if (write.append) tab.push(...write.append);
        else {
          const old = tab[write.row] ?? [];
          for (const [index, value] of write.values.entries()) old[(write.col ?? 0) + index] = value;
          tab[write.row] = old;
        }
      }
      rows = updated;
      replies.set(key, { fingerprint, result });
      for (const guard of guards) used.add(guard);
      if (failure === 'after') {
        failure = undefined;
        throw new Error('prueba de respuesta perdida tras la escritura');
      }
      return { replayed: false, result };
    },
  };
}

function setup(options, purchasingOptions = {}) {
  const sheets = store(options);
  const call = (action, body, session = manager, query) => dispatchPurchasing({
    path: 'api/purchasing/' + action,
    method: body ? 'POST' : 'GET',
    body, query, session, sheets, ...purchasingOptions,
  });
  async function readOrder(folio, session = manager) {
    const response = await call('order', null, session, { folio });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.order;
  }
  return { sheets, call, readOrder };
}

const costManager = { ...manager, project: 'tmf-panama' };
const costOrder = 'OT-QA-01';
const costUnit = 'QA-DZ203';
const acceptedAt = '2026-11-14T16:00:00Z';

function seedCostOrder(sheets) {
  const orders = sheets.inspect('ORDENES_TRABAJO');
  orders[1][9] = 'Completado';
  orders[1][13] = '9999.00';
  orders[1][20] = JSON.stringify({ userId: 'mechanic-qa', functionalTest: 'Prueba conforme', laborHours: 2.5, submittedAt: '2026-11-14T15:00:00Z' });
  orders[1][21] = JSON.stringify({ userId: 'chief-qa', acceptedAt });
  sheets.seed('ORDENES_TRABAJO', orders);
}

function costMovement(id, kind, quantity, delta, original = '', unit = costUnit) {
  const row = [id, '2026-11-14T14:00:00Z', kind, 'SKU-QA', quantity, unit, '', '', costOrder, id, '', '', '', 'pza', original];
  if (delta != null) row.push(JSON.stringify({ unitCost: '9.99', currency: 'USD', reference: 'COSTO-QA', delta }));
  return row;
}

function costService(id, group, invoice, { status = 'Aprobado', unit = costUnit, order = costOrder, ruc = 'RUC-QA' } = {}) {
  const row = Array(29).fill('');
  Object.assign(row, { 0: id, 3: 'Servicio', 4: 'Proveedor QA', 5: ruc, 6: invoice, 7: '50.00', 8: '3.50', 9: '53.50',
    10: unit, 11: order, 16: status, 17: group, 18: 'author-qa', 19: '53.50', 21: 'TP_PA', 22: 'PAB',
    24: '14/11/2026', 25: 'reviewer-qa', 26: '2026-11-14T17:00:00Z', 27: 'Factura conciliada' });
  return row;
}

test('costo real de OT concilia horas aceptadas, salida, devolución y factura agrupados por moneda', async () => {
  const laborValuations = [{ ot: costOrder, unit: costUnit, executorId: 'mechanic-qa', acceptedAt,
    hours: '2.50', hourlyRate: '14.27', currency: 'USD', reference: 'MO-QA-1' }];
  const { sheets, call } = setup(undefined, { laborValuations });
  seedCostOrder(sheets);
  const issue = costMovement('ISSUE-QA', 'Salida', '2.500', '24.98');
  sheets.seed(TAB.inventoryMovements, [['ID'], issue, costMovement('RETURN-QA', 'Devolución', '1.125', '-11.24', issue[0])]);
  sheets.seed(TAB.expenses, [['ID'], costService('SVC-1', 'GRP-1', 'FACT-QA-1'),
    costService('SVC-2', 'GRP-2', 'FACT-QA-2', { order: 'OT-OTRA' })]);
  const { status, body } = await call('workorder-cost', null, costManager, { ot: costOrder });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.ot, costOrder);
  assert.equal(body.unit, costUnit);
  assert.equal(body.project, 'tmf-panama');
  assert.deepEqual(body.totals, [
    { currency: 'PAB', labor: '0.00', parts: '0.00', returns: '0.00', services: '53.50', amount: '53.50' },
    { currency: 'USD', labor: '35.68', parts: '24.98', returns: '-11.24', services: '0.00', amount: '49.42' },
  ]);
  assert.deepEqual(body.lines.map(({ kind, reference }) => [kind, reference]), [
    ['labor', 'MO-QA-1'], ['parts', 'ISSUE-QA'], ['returns', 'RETURN-QA'], ['services', 'FACT-QA-1'],
  ]);
  assert.deepEqual(body.pending, []);
});

test('costo real de OT conserva lo verificado y omite tarifas ajenas, devoluciones inválidas y facturas duplicadas', async () => {
  const laborValuations = [{ ot: costOrder, unit: costUnit, executorId: 'mechanic-qa', acceptedAt,
    hours: '3.00', hourlyRate: '14.27', currency: 'USD', reference: 'TARIFA-AJENA' }];
  const { sheets, call } = setup(undefined, { laborValuations });
  seedCostOrder(sheets);
  sheets.seed(TAB.inventoryMovements, [['ID'], costMovement('ISSUE-QA', 'Salida', '1', '9.99'),
    costMovement('RETURN-QA', 'Devolución', '1', '-9.99', 'SIN-SALIDA'), costMovement('SIN-COSTO', 'Salida', '1', null)]);
  sheets.seed(TAB.expenses, [['ID'], costService('SVC-1', 'GRP-1', 'DOBLE-QA'),
    costService('SVC-2', 'GRP-2', 'DOBLE-QA', { order: 'OT-OTRA', ruc: '' }),
    costService('SVC-3', 'GRP-3', 'PEND-QA', { status: 'Pendiente' }),
    costService('SVC-4', 'GRP-4', 'AJENA-QA', { unit: 'QA-EX401' })]);
  const result = await call('workorder-cost', null, costManager, { ot: costOrder });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.lines.map(line => line.reference), ['ISSUE-QA']);
  assert.deepEqual(new Set(result.body.pending.map(item => item.kind)), new Set(['labor', 'returns', 'parts', 'services']));
  assert.doesNotMatch(JSON.stringify(result.body), /AJENA-QA|OT-OTRA|TARIFA-AJENA/);
  for (const actor of [{ ...costManager, role: 'mecanico' }, { ...costManager, project: 'QA' }]) {
    const forbidden = await call('workorder-cost', null, actor, { ot: costOrder });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.lines, undefined);
  }
  const scoped = { ...costManager, allUnits: false, assignedUnits: ['QA-EX401'] };
  const [foreign, missing] = await Promise.all([costOrder, 'OT-INEXISTENTE'].map(ot => call('workorder-cost', null, scoped, { ot })));
  assert.deepEqual(foreign, missing);
  assert.equal(foreign.status, 404);
});

test('costo real de OT advierte una devolución de la salida etiquetada con otro folio', async () => {
  const { sheets, call } = setup();
  seedCostOrder(sheets);
  const issue = costMovement('ISSUE-QA', 'Salida', '1', '9.99');
  const returnRow = costMovement('DEV-AJENA', 'Devolución', '1', '-9.99', issue[0]);
  returnRow[8] = 'OT-AJENA';
  sheets.seed(TAB.inventoryMovements, [['ID'], issue, returnRow]);
  const { status, body } = await call('workorder-cost', null, costManager, { ot: costOrder });
  assert.equal(status, 200);
  assert.ok(body.pending.some(item => item.kind === 'returns'));
  assert.doesNotMatch(JSON.stringify(body), /DEV-AJENA|OT-AJENA/);
});

const requestInput = () => ({
  operationId: randomUUID(),
  items: [
    { part_number: 'SKU-QA', description: 'Filtro catálogo', quantity: '3.125', unit_price: '6.05', equipment: 'CA20', source: 'Catálogo' },
    { part_number: 'MANUAL-QA', description: 'Parte manual', quantity: '1.250', unit_price: '1.99', equipment: 'CA20', isManual: true },
  ],
});

const newOrder = (input = {}) => ({
  operationId: randomUUID(), date: '2026-11-12', deliveryDate: '2026-11-17',
  vendorName: 'Proveedor de prueba', vendorRfc: 'RFC-QA', unit: 'CA20', entity: 'ULTRATK_MX',
  shipping: '0.75', other: '0.10', comments: 'OC de prueba',
  lines: [
    { description: 'Uno', quantity: '2.500', unitPrice: '6.05' },
    { description: 'Dos', quantity: '0.125', unitPrice: '10.01' },
    { description: 'Tres', quantity: '1.200', unitPrice: '1.99' },
  ],
  ...input,
});

const warehouseLead = { ...manager, userId: 'almacen-qa', role: 'jefe_taller', project: 'tmf-panama', previewDemo: true,
  canApprovePurchases: false, canReceivePurchases: true };

function seedWarehouseCatalog(sheets) {
  const [header, first] = sheets.inspect(TAB.catalog);
  const second = [...first];
  header[14] = 'Almacén';
  first[14] = 'Patio A';
  second[14] = 'Patio B';
  second[5] = '10';
  sheets.seed(TAB.catalog, [header, first, second]);
}

test('reservas simultáneas no exceden el stock por almacén y la salida consume solo su reserva', async () => {
  const { sheets, call } = setup();
  seedWarehouseCatalog(sheets);
  const input = { ot: 'OT-QA-01', warehouse: 'Patio A', partNumber: 'SKU-QA' };
  const reserve = reference => ({ ...input, operationId: randomUUID(), kind: 'Reserva', quantity: '3', reference });
  const [first, second] = await Promise.all(['Reserva A', 'Reserva B'].map(reference => call('inventory-reservation', reserve(reference), warehouseLead)));
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const reservationId = (first.status === 200 ? first : second).body.id;
  const view = async () => (await call('inventory-stock', null, warehouseLead)).body.items
    .map(row => [row.warehouse, row.physical, row.reserved, row.available]);
  assert.deepEqual(await view(), [['Patio A','4','3','1'],['Patio B','10','0','10']]);
  const move = { ...input, operationId: randomUUID(), kind: 'Salida', quantity: '2', reference: 'Vale QA' };
  assert.equal((await call('inventory-move', move, warehouseLead)).status, 409);
  assert.equal((await call('inventory-move', { ...move, warehouse: 'Patio B', reservationId }, warehouseLead)).status, 409);
  const consume = { ...move, reservationId };
  const consumed = await call('inventory-move', consume, warehouseLead);
  assert.equal(consumed.status, 200);
  assert.deepEqual((await call('inventory-move', consume, warehouseLead)).body, consumed.body);
  assert.deepEqual(await view(), [['Patio A','2','1','1'],['Patio B','10','0','10']]);
  const release = { ...input, operationId: randomUUID(), kind: 'Liberación', quantity: '1', reference: 'Liberación QA', reservationId };
  assert.equal((await call('inventory-reservation', release, warehouseLead)).status, 200);
  assert.deepEqual(await view(), [['Patio A','2','0','2'],['Patio B','10','0','10']]);
  const restricted = { ...warehouseLead, allUnits: false, assignedUnits: ['QA-EX401'] };
  assert.equal((await call('inventory-reservation', reserve('Fuera de alcance'), restricted)).status, 403);
  assert.deepEqual((await call('inventory-stock', null, restricted)).body.items, []);
});

test('solo un despacho confirmado entra en tránsito y su recepción parcial cuadra por partida y almacén', async () => {
  const { sheets, call, readOrder } = setup();
  seedWarehouseCatalog(sheets);
  const buyer = { ...manager, project: 'tmf-panama', previewDemo: true };
  const created = await call('order-save', newOrder({ entity: 'TP_PA_DEMO', unit: 'QA-DZ203',
    lines: [{ partNumber: 'SKU-QA', description: 'Filtro QA', quantity: '5', unitPrice: '10' }] }), buyer);
  assert.equal(created.status, 200);
  const { folio, version } = created.body;
  assert.equal((await call('order-status', { operationId: randomUUID(), folio, version, status: 'Aprobada', reason: 'QA' }, buyer)).status, 200);
  const balances = async () => (await call('inventory-stock', null, warehouseLead)).body.items
    .map(row => [row.warehouse, row.physical, row.inTransit]);
  assert.deepEqual(await balances(), [['Patio A','4','0'],['Patio B','10','0']]);
  let order = await readOrder(folio, buyer);
  const lineId = order.lines[0].id;
  const dispatch = { operationId: randomUUID(), folio, version: order.version, lineId, quantity: '4', warehouse: 'Patio B', reference: 'Guía QA' };
  const shipped = await call('order-dispatch', dispatch, warehouseLead);
  assert.equal(shipped.status, 200);
  assert.deepEqual((await call('order-dispatch', dispatch, warehouseLead)).body, shipped.body);
  assert.deepEqual(await balances(), [['Patio A','4','0'],['Patio B','10','4']]);
  order = await readOrder(folio, buyer);
  const receipt = { operationId: randomUUID(), folio, version: order.version, lineId, quantity: '2', reference: 'Remisión QA' };
  assert.equal((await call('order-receive', receipt, warehouseLead)).status, 409);
  assert.equal((await call('order-receive', { ...receipt, dispatchId: shipped.body.dispatchId, warehouse: 'Patio A' }, warehouseLead)).status, 409);
  assert.equal((await call('order-receive', { ...receipt, dispatchId: shipped.body.dispatchId }, warehouseLead)).status, 200);
  assert.deepEqual(await balances(), [['Patio A','4','0'],['Patio B','12','2']]);
  const catalog = sheets.inspect(TAB.catalog);
  catalog[2][10] = 'QA-DZ203, QA-EX401';
  sheets.seed(TAB.catalog, catalog);
  const restricted = { ...warehouseLead, allUnits: false, assignedUnits: ['QA-EX401'] };
  const scoped = await call('inventory-stock', null, restricted);
  assert.deepEqual(scoped.body.items.map(row => [row.warehouse, row.inTransit]), [['Patio B', '0']]);
  order = await readOrder(folio, buyer);
  const cancel = { operationId: randomUUID(), folio, version: order.version, lineId, cancelDispatchId: shipped.body.dispatchId,
    reference: 'Proveedor canceló el remanente' };
  assert.equal((await call('order-dispatch', cancel, warehouseLead)).status, 200);
  assert.deepEqual(await balances(), [['Patio A','4','0'],['Patio B','12','0']]);
  const track = sheets.inspect(TAB.inventoryMovements);
  assert.deepEqual(track.slice(1).map(row => [row[2], row[4], row[16], row[18]]), [
    ['Despacho', '4', 'Patio B', shipped.body.dispatchId],
    ['Recepción', '2', 'Patio B', shipped.body.dispatchId],
    ['Cancelación de despacho', '2', 'Patio B', shipped.body.dispatchId],
  ]);
  sheets.seed(TAB.inventoryMovements, track.filter(row => row[2] !== 'Despacho'));
  assert.deepEqual(await balances(), [['Patio A','4','0'],['Patio B','12',null]]);
});

test('una ubicación de estante histórica nunca se usa para inventar un almacén', async () => {
  const { sheets, call } = setup();
  const catalog = sheets.inspect(TAB.catalog);
  catalog[1][8] = 'Estante A-2';
  sheets.seed(TAB.catalog, catalog);
  const { body } = await call('inventory-stock', null, warehouseLead);
  assert.deepEqual(body.items.map(row => [row.warehouse, row.physical, row.reserved, row.inTransit]), [['', '4', null, null]]);
});

test('mantiene la huérfana y guarda tres importes con el mismo folio después de un fallo', async () => {
  const { call, readOrder, sheets } = setup();
  const input = newOrder();
  assert.deepEqual((await call('orders')).body.orphanFolios, ['OC-001']);
  assert.equal((await call('order-save', newOrder({ folio: 'OC-001' }))).status, 404);
  sheets.failNext('before');
  assert.equal((await call('order-save', input)).status, 503);
  assert.equal(sheets.inspect(TAB.orders).length, 1);
  assert.equal(sheets.inspect(TAB.lines).length, 2);
  sheets.failNext('after');
  assert.equal((await call('order-save', input)).status, 503);
  const retry = await call('order-save', input);
  assert.equal(retry.status, 200);
  const { folio } = retry.body;
  const order = await readOrder(folio);
  assert.notEqual(folio, 'OC-001');
  assert.equal(order.total, '22.62');
  assert.deepEqual(order.lines.map(({ total }) => total), ['15.13', '1.25', '2.39']);
  assert.equal(order.deliveryDate, '17/11/2026');
  assert.equal(order.unit, 'CA20');
  assert.equal(sheets.inspect(TAB.orders).length, 2);
  assert.equal(sheets.inspect(TAB.lines).length, 5);
});

test('Panamá guarda borradores con proveedor manual, descuento e ITBMS documentado', async (t) => {
  const previous = process.env.HERMES_PURCHASE_ISSUERS_JSON;
  delete process.env.HERMES_PURCHASE_ISSUERS_JSON;
  t.after(() => {
    if (previous === undefined) delete process.env.HERMES_PURCHASE_ISSUERS_JSON;
    else process.env.HERMES_PURCHASE_ISSUERS_JSON = previous;
  });
  const buyer = { ...manager, project: 'tmf-panama', canApprovePurchases: false };
  const { call, readOrder, sheets } = setup({ vendors: [['NOMBRE']] });
  const overview = (await call('orders', null, buyer)).body;
  assert.deepEqual(overview.vendors, []);
  assert.deepEqual(overview.issuers.map(({ id, name, currency, taxBps }) => [id, name, currency, taxBps]), [
    ['TP_PA', 'TRANSPLUS, S.A.', 'USD', undefined],
  ]);
  assert.equal(overview.canApprove, false);
  assert.equal(overview.canRecordInvoice, false);
  assert.equal(overview.canRecordPayment, false);

  const base = {
    entity: 'TP_PA', unit: 'DZ203', vendorSource: 'manual', vendorName: 'Proveedor documental QA',
    vendorRfc: 'RUC-QA-123', vendorAddress: 'Dirección Panamá QA', shipping: '0', other: '0', discount: '32.80',
    lines: [{ description: 'Refacción QA', quantity: '1', unitPrice: '163.90' }],
  };
  assert.equal((await call('order-save', newOrder(base), buyer)).status, 400);
  assert.equal((await call('order-save', newOrder({ ...base, tax: '9.18', vendorName: '' }), buyer)).status, 400);
  assert.equal((await call('order-save', newOrder({ ...base, tax: '9.18', discount: '163.91' }), buyer)).status, 400);
  assert.equal((await call('order-save', newOrder({ ...base, tax: '9.18', vendorSource: 'catalog' }), buyer)).status, 400);
  const discounted = newOrder({ ...base, tax: '9.18' });
  const saved = await call('order-save', discounted, buyer);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual((await call('order-save', discounted, buyer)).body, saved.body);
  const order = await readOrder(saved.body.folio, buyer);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total, order.status], ['163.90', '32.80', '9.18', '140.28', 'Borrador']);
  assert.deepEqual([order.vendorSource, order.vendorName, order.vendorRfc, order.vendorAddress], [
    'manual', base.vendorName, base.vendorRfc, base.vendorAddress,
  ]);
  assert.deepEqual([order.issuer.taxId, order.issuer.phone], ['RUC 2236707-1-778948 DV 15', '387-3710']);
  assert.equal((await call('order-status', {
    operationId: randomUUID(), folio: order.folio, version: order.version, status: 'Aprobada',
  }, buyer)).status, 403);
  const manualApproval = await call('order-status', {
    operationId: randomUUID(), folio: order.folio, version: order.version, status: 'Aprobada', reason: 'Q25 QA',
  }, { ...buyer, canApprovePurchases: true });
  assert.equal(manualApproval.status, 409);
  assert.match(manualApproval.body.error, /proveedor del catálogo/);
  assert.equal((await call('order-save', newOrder({ ...base, tax: '0' }), { ...buyer, allUnits: false, assignedUnits: ['EX401'] })).status, 403);

  const exempt = await call('order-save', newOrder({
    ...base, tax: '0', folio: order.folio, version: order.version,
    lines: [{ id: order.lines[0].id, ...base.lines[0] }],
  }), buyer);
  assert.equal(exempt.status, 200, JSON.stringify(exempt.body));
  const updated = await readOrder(order.folio, buyer);
  assert.deepEqual([updated.tax, updated.total, updated.status], ['0.00', '131.10', 'Borrador']);
  const document = await call('order-save', newOrder({
    ...base, discount: '0', tax: '371.00', lines: [{ description: 'Servicio QA', quantity: '1', unitPrice: '5300.00' }],
  }), buyer);
  assert.equal(document.status, 200, JSON.stringify(document.body));
  assert.equal(document.body.total, '5671.00');
  assert.deepEqual(sheets.inspect(TAB.vendors), [['NOMBRE']]);
  assert.equal(sheets.inspect(TAB.orders).length, 3);
});

test('dos altas concurrentes tienen folios distintos y una edición actualiza solo sus partidas', async () => {
  const { call, readOrder, sheets } = setup();
  const first = newOrder();
  const second = newOrder();
  const [a, b] = await Promise.all([call('order-save', first), call('order-save', second)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.body.folio, b.body.folio);
  const old = await readOrder(a.body.folio);
  const { lines: [one, , three], folio, version } = old;
  const edit = newOrder({
    folio, version,
    lines: [
      { ...one, quantity: '4.000' }, { ...three }, { description: 'Nuevo', quantity: '0.500', unitPrice: '7.02' },
    ],
  });
  assert.equal((await call('order-save', edit)).status, 200);
  const saved = await readOrder(folio);
  assert.equal(saved.lines[0].id, one.id);
  assert.equal(saved.lines[0].quantity, '4');
  assert.deepEqual(saved.lines.map(({ description }) => description), ['Uno', 'Tres', 'Nuevo']);
  assert.equal((await readOrder(b.body.folio)).lines.length, 3);
  const deleteInput = { operationId: randomUUID(), folio, version: saved.version };
  assert.equal((await call('order-delete', deleteInput)).status, 200);
  assert.equal((await call('order-delete', deleteInput)).status, 200);
  assert.equal((await call('order', null, manager, { folio })).status, 404);
  assert.equal(sheets.inspect(TAB.orders).find((row) => row[0] === folio)[11], 'Eliminada');
});

test('preserva el vínculo exacto y dos recepciones de la misma partida', async () => {
  const { call, readOrder, sheets } = setup();
  const requester = { ...manager, userId: 'actor-qa-jefe', userName: 'Jefe QA', role: 'jefe_taller', allUnits: false, assignedUnits: ['CA20'] };
  const request = requestInput();
  const [a, b] = await Promise.all([call('request-submit', request, requester), call('request-submit', request, requester)]);
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  const requests = (await call('requests')).body.items;
  assert.equal(requests.length, 2);
  const manual = requests.find((entry) => entry.partNum === 'MANUAL-QA');
  const catalog = requests.find((entry) => entry.partNum === 'SKU-QA');
  assert.equal(manual.fuente, 'Manual');
  assert.equal((await call('request-status', {
    operationId: randomUUID(), id: manual.id, version: manual.version, status: 'Pedido',
  })).status, 200);
  assert.equal((await call('requests')).body.items.find((entry) => entry.id === catalog.id).estado, 'Pendiente');

  const input = newOrder({ lines: [{
    requestLineId: catalog.id, description: 'Se toma la fuente del pedido', quantity: '3.125', unitPrice: '6.05',
  }] });
  const concurrent = { ...input, operationId: randomUUID() };
  const candidates = await Promise.all([call('order-save', input), call('order-save', concurrent)]);
  assert.deepEqual(candidates.map(({ status }) => status).sort(), [200, 409]);
  const folio = candidates.find(({ status }) => status === 200).body.folio;
  let order = await readOrder(folio);
  assert.equal(order.lines[0].partNumber, 'SKU-QA');
  assert.equal(order.lines[0].requestLineId, catalog.id);
  assert.equal(order.lines[0].requestId, a.body.folio);

  const approval = { operationId: randomUUID(), folio, version: order.version, status: 'Aprobada', approvedBy: 'Usuario no autorizado' };
  assert.equal((await call('order-status', approval, { ...manager, canApprovePurchases: false })).status, 403);
  assert.equal((await call('order-status', approval)).status, 200);
  order = await readOrder(folio);
  assert.equal(order.approvedBy, manager.userName);
  assert.equal(order.approvedById, manager.userId);
  assert.ok(order.approvedAt);
  const firstReceipt = { operationId: randomUUID(), folio, version: order.version, lineId: order.lines[0].id, quantity: '1.250', reference: 'Primera entrada' };
  assert.equal((await call('order-receive', firstReceipt)).status, 200);
  order = await readOrder(folio);
  assert.equal(order.receiptStatus, 'Recibida parcial');
  assert.equal(order.lines[0].received, '1.25');
  assert.equal((await call('order-receive', {
    ...firstReceipt, operationId: randomUUID(), version: order.version, quantity: '2',
  })).status, 409);
  const secondReceipt = { ...firstReceipt, operationId: randomUUID(), version: order.version, quantity: '1.875', reference: 'Segunda entrada' };
  assert.equal((await call('order-receive', secondReceipt)).status, 200);
  assert.equal((await call('order-receive', firstReceipt)).status, 200);
  order = await readOrder(folio);
  assert.equal(order.status, 'Recibida');
  assert.equal(order.lines[0].received, '3.125');
  assert.equal(order.lines[0].receipts.length, 2);
  const purchased = (await call('requests')).body.items.find(({ id }) => id === catalog.id);
  assert.equal(purchased.ocFolio, folio);
  assert.equal(purchased.estado, 'Completado');
  assert.equal(sheets.inspect(TAB.audit).filter((row) => row[4] === 'Recepción de partida').length, 2);
});

test('impone roles y unidades en la lectura y escritura de Compras', async () => {
  const { call } = setup();
  const operator = { ...manager, role: 'operador' };
  assert.equal((await call('orders', null, operator)).status, 403);
  assert.equal((await call('request-submit', requestInput(), operator)).status, 403);
  const limited = { ...manager, allUnits: false, assignedUnits: ['DZ201'] };
  assert.equal((await call('order-save', newOrder(), limited)).status, 403);
  assert.equal((await call('request-submit', requestInput(), limited)).status, 403);
  const { body } = await call('order-save', newOrder());
  assert.equal((await call('order', null, limited, { folio: body.folio })).status, 403);
  assert.deepEqual((await call('orders', null, limited)).body.orders, []);
});

test('Panamá divide una partida entre proveedores sin perder la OT ni superar el saldo', async () => {
  const { call, readOrder } = setup({ vendors: [
    ['NOMBRE'], ['Proveedor de prueba', 'RFC-QA', 'Dirección QA'], ['Segundo proveedor', 'RFC-QA-2', 'Dirección QA 2'],
  ] });
  const buyer = { ...manager, project: 'tmf-panama', previewDemo: true };
  const requester = { ...buyer, role: 'jefe_taller', userId: 'qa-jefe' };
  const warehouse = { ...requester, userId: 'qa-almacen', canApprovePurchases: false, canReceivePurchases: true };
  const requested = { operationId: randomUUID(), items: [
    { part_number: 'SKU-QA', description: 'Filtro QA', quantity: '7', unit_price: '6.05', equipment: 'QA-DZ203', ot: 'OT-QA-01' },
  ] };
  assert.equal((await call('request-submit', { ...requested, items: [{ ...requested.items[0], ot: 'OT-NO-EXISTE' }] }, requester)).status, 404);
  assert.equal((await call('request-submit', requested, requester)).status, 200);
  const readRequest = async () => (await call('requests', null, buyer)).body.items[0];
  const entry = await readRequest();
  assert.equal(entry.ot, 'OT-QA-01');
  assert.equal(entry.unallocatedQuantity, '7');
  const entity = (await call('orders', null, buyer)).body.issuers[0].id;
  const create = (amount, vendorName = 'Proveedor de prueba', vendorRfc = 'RFC-QA') => call('order-save', newOrder({
    vendorName, vendorRfc, entity, unit: 'QA-DZ203', tax: '0.00',
    lines: [{ requestLineId: entry.id, quantity: amount, unitPrice: '5.00' }],
  }), buyer);
  const first = await create('3');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal((await readRequest()).unallocatedQuantity, '4');
  const disposable = await create('1', 'Segundo proveedor', 'RFC-QA-2');
  assert.equal(disposable.status, 200);
  const abandoned = await readOrder(disposable.body.folio, buyer);
  assert.equal((await readRequest()).unallocatedQuantity, '3');
  assert.equal((await call('order-delete', { operationId: randomUUID(), folio: abandoned.folio, version: abandoned.version }, buyer)).status, 200);
  assert.equal((await readRequest()).unallocatedQuantity, '4');
  const candidates = await Promise.all([create('4', 'Segundo proveedor', 'RFC-QA-2'), create('4', 'Segundo proveedor', 'RFC-QA-2')]);
  assert.deepEqual(candidates.map(x => x.status).sort(), [200,409]);
  const second = candidates.find(x => x.status === 200);
  const full = await readRequest();
  assert.equal(full.unallocatedQuantity, '0');
  assert.equal(full.receivedQuantity, '0');
  assert.equal(full.allocations.length, 2);
  for (const creation of [first,second]) {
    const folio = creation.body.folio;
    let order = await readOrder(folio, buyer);
    assert.equal(order.lines[0].ot, 'OT-QA-01');
    assert.equal(order.lines[0].partNumber, 'SKU-QA');
    assert.equal(order.lines[0].requestLineId, entry.id);
    assert.equal((await call('order-status', { operationId: randomUUID(), folio, version: order.version, status: 'Aprobada', reason: 'QA soporte' }, buyer)).status, 200);
    order = await readOrder(folio, buyer);
    assert.equal((await call('order-receive', { operationId: randomUUID(), folio, version: order.version,
      lineId: order.lines[0].id, quantity: order.lines[0].quantity, reference: 'Remisión ' + folio }, warehouse)).status, 200);
    assert.equal((await readRequest()).estado, creation === first ? 'Pedido' : 'Completado');
    assert.equal((await readOrder(folio,buyer)).lines[0].ot, 'OT-QA-01');
  }
  assert.equal((await readRequest()).receivedQuantity, '7');
});

test('Almacén de Panamá consulta y recibe por partida dentro de su asignación', async (t) => {
  const priorIssuers = process.env.HERMES_PURCHASE_ISSUERS_JSON;
  process.env.HERMES_PURCHASE_ISSUERS_JSON = JSON.stringify([{
    id: 'TP_PA', name: 'Trans Plus Panamá QA', currency: 'USD', taxLabel: 'ITBMS', taxBps: 700, template: 'transplus',
  }]);
  t.after(() => {
    if (priorIssuers === undefined) delete process.env.HERMES_PURCHASE_ISSUERS_JSON;
    else process.env.HERMES_PURCHASE_ISSUERS_JSON = priorIssuers;
  });

  const { call, readOrder, sheets } = setup();
  const buyer = { ...manager, project: 'tmf-panama', projects: ['tmf-panama'] };
  const finance = { ...buyer, userId: 'actor-qa-finanzas', allUnits: false, assignedUnits: ['DZ203'], canApprovePurchases: false };
  const warehouse = {
    ...finance, userId: 'actor-qa-almacen', userName: 'Almacén QA', role: 'jefe_taller', canReceivePurchases: true,
  };
  const withoutGrant = { ...warehouse, canReceivePurchases: false };
  const mexico = { ...warehouse, project: 'mexico', projects: ['mexico'] };

  async function createOrder(unit, approve = true) {
    const created = await call('order-save', newOrder({ entity: 'TP_PA', unit, tax: '1.32', vendorAddress: 'No sustituye el catálogo', lines: [
      { description: 'Filtro hidráulico', quantity: '3.125', unitPrice: '6.05', partNumber: 'FILTRO-QA' },
    ] }), buyer);
    assert.equal(created.status, 200);
    const order = await readOrder(created.body.folio, buyer);
    assert.equal(order.vendorAddress, 'Dirección QA');
    if (!approve) return order;
    assert.equal((await call('order-status', {
      operationId: randomUUID(), folio: order.folio, version: order.version, status: 'Aprobada', reason: 'Soporte Q25 sintético',
    }, buyer)).status, 200);
    return readOrder(order.folio, buyer);
  }

  const [approved, foreign, draft] = [await createOrder('DZ203'), await createOrder('EX401'), await createOrder('DZ203', false)];
  const denied = await call('receiving', null, withoutGrant);
  assert.equal(denied.status, 403);
  assert.equal((await call('receiving', null, mexico)).status, 403);
  const queue = await call('receiving', null, warehouse);
  assert.equal(queue.status, 200);
  assert.deepEqual(queue.body.orders.map(({ folio }) => folio), [approved.folio]);
  const [visible] = queue.body.orders;
  assert.equal(visible.lines[0].quantity, '3.125');
  assert.equal(visible.lines[0].received, '0');
  assert.equal('unitPrice' in visible.lines[0], false);
  assert.equal('total' in visible.lines[0], false);
  assert.equal('total' in visible, false);
  assert.equal((await call('orders', null, warehouse)).status, 403);
  assert.equal((await call('order', null, warehouse, { folio: approved.folio })).status, 403);
  assert.equal((await call('order-status', {
    operationId: randomUUID(), folio: draft.folio, version: draft.version, status: 'Aprobada',
  }, warehouse)).status, 403);
  assert.equal((await call('order-save', newOrder({ folio: draft.folio, version: draft.version, entity: 'TP_PA', unit: 'DZ203' }), warehouse)).status, 403);

  const input = (order, quantity, reference) => ({
    operationId: randomUUID(), folio: order.folio, version: order.version, lineId: order.lines[0].id, quantity, reference,
  });
  const first = { ...input(approved, '1.25', 'Remisión QA 01'), unitPrice: '0.01' };
  assert.equal((await call('order-receive', first, withoutGrant)).status, 403);
  assert.equal((await call('order-receive', first, mexico)).status, 403);
  assert.equal((await call('order-receive', input(foreign, '1', ''), warehouse)).status, 403);
  assert.equal((await call('order-receive', input(draft, '1', ''), warehouse)).status, 409);
  assert.equal((await call('order-receive', first, warehouse)).status, 200);
  assert.equal((await call('order-receive', first, { ...warehouse, assignedUnits: ['EX401'] })).status, 403);
  const partial = await readOrder(approved.folio, finance);
  assert.equal(partial.receiptStatus, 'Recibida parcial');
  assert.equal(partial.lines[0].received, '1.25');
  assert.equal(partial.lines[0].unitPrice, '6.05');
  assert.deepEqual(partial.lines[0].receipts.map(({ actorId, quantity, reference }) => [actorId, quantity, reference]), [
    [warehouse.userId, '1.25', 'Remisión QA 01'],
  ]);
  assert.equal((await call('order-receive', input(partial, '1.876', ''), warehouse)).status, 409);
  const final = input(partial, '1.875', 'Remisión QA 02');
  assert.equal((await call('order-receive', final, warehouse)).status, 200);
  assert.equal((await call('order-receive', final, warehouse)).status, 200);
  const done = await readOrder(approved.folio, finance);
  assert.equal(done.receiptStatus, 'Recibida');
  assert.equal(done.lines[0].received, '3.125');
  assert.equal(done.lines[0].receipts.length, 2);
  assert.equal((await call('receiving', null, warehouse)).body.orders[0].receiptStatus, 'Recibida');
  assert.equal((await readOrder(foreign.folio, buyer)).receiptStatus, 'Pendiente');
  assert.equal(sheets.inspect(TAB.audit).filter((row) => row[4] === 'Recepción de partida').length, 2);
});

test('guarda todo el reparto del recibo de forma atómica y cuadra los centavos', async (t) => {
  const oldPrefix = process.env.HERMES_EXPENSE_RECEIPT_URL_PREFIX;
  delete process.env.HERMES_EXPENSE_RECEIPT_URL_PREFIX;
  t.after(() => {
    if (oldPrefix === undefined) delete process.env.HERMES_EXPENSE_RECEIPT_URL_PREFIX;
    else process.env.HERMES_EXPENSE_RECEIPT_URL_PREFIX = oldPrefix;
  });
  const { call, sheets } = setup();
  const input = {
    operationId: randomUUID(),
    expense: {
      tipo: 'Refaccion', proveedor: 'Proveedor de prueba', subtotal: '200.00', iva: '32.00', total: '232.00',
      metodo_pago: 'Transferencia', imagen_url: 'https://storage.example.test/receipts/prueba.png',
      solicitante: 'Nombre no autorizado',
      line_items: [{ part_number: 'SKU-QA', description: 'Filtro', qty: '2', unit_price: '100' }],
    },
    allocations: [{ unit: 'CA20', amount: '140.00' }, { unit: 'TR16', amount: '92.00' }],
  };
  assert.equal((await call('expense-save', input)).status, 409);
  process.env.HERMES_EXPENSE_RECEIPT_URL_PREFIX = 'https://storage.example.test/receipts/';
  const foreign = { ...input, expense: { ...input.expense, imagen_url: 'https://untrusted.example.test/receipt.png' } };
  assert.equal((await call('expense-save', foreign)).status, 400);
  sheets.failNext('before');
  assert.equal((await call('expense-save', input)).status, 503);
  assert.equal(sheets.inspect(TAB.expenses).length, 1);
  const saved = await call('expense-save', input);
  assert.equal(saved.status, 200);
  assert.equal((await call('expense-save', input)).status, 200);
  const rows = sheets.inspect(TAB.expenses).slice(1);
  assert.deepEqual(rows.map((row) => [row[7], row[8], row[9], row[10]]), [
    ['120.69', '19.31', '140.00', 'CA20'],
    ['79.31', '12.69', '92.00', 'TR16'],
  ]);
  assert.ok(rows.every((row) => row[12] === manager.userName && row[15] === input.expense.imagen_url && row[17] === saved.body.folio));
  const oneUnit = { ...manager, allUnits: false, assignedUnits: ['CA20'] };
  assert.deepEqual((await call('expenses', null, oneUnit)).body.rows.map((row) => row[10]), ['CA20']);
  const deletion = { operationId: randomUUID(), id: saved.body.ids[0] };
  assert.equal((await call('expense-delete', deletion, oneUnit)).status, 403);
  assert.deepEqual((await call('expense-delete', deletion)).body.removed, saved.body.ids);
  assert.ok(sheets.inspect(TAB.expenses).slice(1).every((row) => row[16] === 'Eliminado'));
});

test('Panamá separa aprobación Q25, recepción con remisión, factura y pago conciliado', async () => {
  const { call, readOrder, sheets } = setup();
  const buyer = { ...manager, project: 'tmf-panama', projects: ['tmf-panama'], previewDemo: true };
  const receiver = { ...buyer, userId: 'almacen-qa', role: 'jefe_taller', canApprovePurchases: false, canReceivePurchases: true };
  const accounting = { ...buyer, userId: 'contabilidad-qa', canApprovePurchases: false, canRecordPurchaseInvoices: true };
  const treasury = { ...buyer, userId: 'tesoreria-qa', canApprovePurchases: false, canRecordPurchasePayments: true };
  const created = await call('order-save', newOrder({ entity: 'TP_PA_DEMO', unit: 'QA-DZ203', lines: [
    { description: 'Parte de prueba', quantity: '2', unitPrice: '10' },
  ] }), buyer);
  assert.equal(created.status, 200);
  const { folio } = created.body;
  let order = await readOrder(folio, buyer);
  const input = (fields) => ({ operationId: randomUUID(), folio, version: order.version, ...fields });
  assert.equal((await call('order-status', input({ status: 'Aprobada' }), buyer)).status, 400);
  assert.equal((await call('order-status', input({ status: 'Aprobada', reason: 'Justificación Q25 de prueba' }), buyer)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.approvalReason, 'Justificación Q25 de prueba');
  const receipt = (reference) => input({ lineId: order.lines[0].id, quantity: '1', reference });
  assert.equal((await call('order-receive', receipt('R-01'), buyer)).status, 403);
  assert.equal((await call('order-receive', receipt('R-01'), { ...buyer, canReceivePurchases: true })).status, 403);
  assert.equal((await call('order-receive', receipt(''), receiver)).status, 400);
  assert.equal((await call('order-status', input({ status: 'Pagada' }), buyer)).status, 403);
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), treasury)).status, 409);
  const first = receipt('R-01');
  assert.equal((await call('order-receive', first, receiver)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.receiptStatus, 'Recibida parcial');
  assert.equal((await call('order-invoice', input({ reference: 'F-01', amount: order.total }), accounting)).status, 409);
  assert.equal((await call('order-receive', receipt('R-02'), receiver)).status, 200);
  assert.equal((await call('order-receive', first, receiver)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.receiptStatus, 'Recibida');
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), treasury)).status, 409);
  assert.equal((await call('order-invoice', input({ reference: 'F-01', amount: '1' }), accounting)).status, 409);
  const invoiceLines = [{ lineId: order.lines[0].id, quantity: '2', unitPrice: '10.00' }];
  const fields = { reference: 'F-01', amount: order.total, currency: 'USD', tax: order.tax, lines: invoiceLines };
  const inconsistent = await call('order-invoice', input({ ...fields, currency: 'PAB', tax: '0.04',
    lines: [{ ...invoiceLines[0], quantity: '1', unitPrice: '20.00' }],
  }), accounting);
  assert.equal(inconsistent.status, 409);
  assert.match(inconsistent.body.error, /moneda.*ITBMS.*cantidad.*precio/i);
  assert.equal((await readOrder(folio, buyer)).invoice, null);
  assert.equal((await call('order-invoice', input({ ...fields, lines: [...invoiceLines, ...invoiceLines] }), accounting)).status, 409);
  const receivedLines = sheets.inspect(TAB.lines);
  const unsupported = structuredClone(receivedLines);
  const unsupportedLine = unsupported.find(row => row[6] === invoiceLines[0].lineId);
  const unsupportedHistory = JSON.parse(unsupportedLine[11]);
  unsupportedHistory[0].actorId = buyer.userId;
  unsupportedLine[11] = JSON.stringify(unsupportedHistory);
  sheets.seed(TAB.lines, unsupported);
  assert.equal((await call('order-invoice', input(fields), accounting)).status, 409);
  sheets.seed(TAB.lines, receivedLines);
  assert.equal((await call('order-invoice', input(fields), accounting)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.invoice.reference, 'F-01');
  assert.equal(order.invoice.actorId, accounting.userId);
  assert.equal(order.invoice.match.tax, order.tax);
  assert.deepEqual(order.invoice.match.lines.map(({ receiptEvidence, ...line }) => line), [{
    lineId: order.lines[0].id, quantity: '2', unitPrice: '10.00', receiptIds: order.lines[0].receipts.map(receipt => receipt.id),
  }]);
  const historical = sheets.inspect(TAB.orders);
  const invoiceRow = historical.find(row => row[0] === folio);
  const { match, matchReviewedById, matchReviewedAt, ...previousInvoice } = JSON.parse(invoiceRow[23]);
  assert.ok(match && matchReviewedById && matchReviewedAt);
  previousInvoice.actorId = 'cuenta-historica-qa';
  invoiceRow[23] = JSON.stringify(previousInvoice);
  sheets.seed(TAB.orders, historical);
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), treasury)).status, 409);
  assert.equal((await call('order-invoice', input({ ...fields, reference: 'F-OTRA' }), accounting)).status, 409);
  assert.equal((await call('order-invoice', input(fields), accounting)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.invoice.actorId, previousInvoice.actorId);
  assert.equal(order.invoice.matchReviewedById, accounting.userId);
  const changedLines = structuredClone(receivedLines);
  const changedLine = changedLines.find(row => row[6] === invoiceLines[0].lineId);
  const changedHistory = JSON.parse(changedLine[11]);
  changedHistory[0].reference = 'Remisión corregida QA';
  changedLine[11] = JSON.stringify(changedHistory);
  sheets.seed(TAB.lines, changedLines);
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), treasury)).status, 409);
  changedHistory[0].reference = 'R-01';
  changedHistory[0].id = 'remision-sustituida-qa';
  changedLine[11] = JSON.stringify(changedHistory);
  sheets.seed(TAB.lines, changedLines);
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), treasury)).status, 409);
  order = await readOrder(folio, buyer);
  assert.equal(order.payment, null);
  assert.equal(order.invoiceReconciled, false);
  assert.equal((await call('order-invoice', input(fields), accounting)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.invoiceReconciled, true);
  assert.equal(order.invoice.actorId, previousInvoice.actorId);
  assert.equal(order.invoice.match.lines[0].receiptIds[0], 'remision-sustituida-qa');
  const previousMatchAudit = sheets.inspect(TAB.audit).find(row => row[4] === 'Conciliación anterior de factura');
  assert.notEqual(JSON.parse(previousMatchAudit[5]).match.lines[0].receiptIds[0], 'remision-sustituida-qa');
  assert.equal(order.status, 'Recibida');
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), { ...accounting, canRecordPurchasePayments: true })).status, 403);
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), buyer)).status, 403);
  assert.equal((await call('order-payment', input({ reference: 'P-01', amount: order.total }), treasury)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.status, 'Pagada');
  assert.equal(order.payment.actorId, treasury.userId);
  assert.equal(order.payment.invoiceReference, 'F-01');
  assert.deepEqual(order.lines[0].receipts.map((receipt) => receipt.reference), ['R-01', 'R-02']);
  assert.equal(sheets.inspect(TAB.audit).filter((row) => row[4] === 'Pago de OC conciliado').length, 1);
});

test('Panamá exige el PIN indicado en catálogo aunque ambas unidades tengan el mismo modelo', async () => {
  const { call, sheets } = setup();
  sheets.seed('01 Inventario', [
    ['#','COD1','Descripción','Marca','Modelo','Año','Serie'],
    ['1','QA-DZ203','Equipo A','Komatsu','D65EX-16','2020','QA-A123'],
    ['2','QA-DZ204','Equipo B','Komatsu','D65EX-16','2020','QA-B234'],
    ['3','QA-DZ205','Equipo C','Komatsu','D65EX-16','2020',''],
    ['4','QA-DZ206','Equipo D','Komatsu','D155','2020','QA-A123'],
  ]);
  const catalog = sheets.inspect(TAB.catalog);
  catalog[1][10] = 'D65EX-16; PIN:QA-A123';
  sheets.seed(TAB.catalog, catalog);
  const buyer = { ...manager, role: 'jefe_taller', project: 'tmf-panama', projects: ['tmf-panama'], previewDemo: true };
  const orderPart = equipment => ({ operationId: randomUUID(), items: [
    { part_number: 'SKU-QA', description: 'Filtro restringido por serie', quantity: '1', equipment },
  ] });
  const accepted = await call('request-submit', orderPart('QA-DZ203'), buyer);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  for (const equipment of ['QA-DZ204', 'QA-DZ205']) {
    const rejected = await call('request-submit', orderPart(equipment), buyer);
    assert.equal(rejected.status, 409);
    assert.match(rejected.body.error, /PIN|serie/i);
  }
  assert.equal((await call('request-submit', orderPart('QA-DZ206'), buyer)).status, 409);
  assert.equal(sheets.inspect(TAB.requests).length, 2);
});

test('Panamá valida la compatibilidad y registra movimientos de stock conciliables con la OT', async () => {
  const { call, readOrder, sheets } = setup();
  const buyer = { ...manager, project: 'tmf-panama', projects: ['tmf-panama'], previewDemo: true };
  const warehouse = { ...buyer, userId: 'almacen-qa', role: 'jefe_taller', canApprovePurchases: false, canReceivePurchases: true };
  const stock = () => sheets.inspect('12 Inventario Rep.')[1][5];
  const orderPart = (equipment) => ({
    operationId: randomUUID(), items: [
      { part_number: 'SKU-QA', description: 'Filtro catálogo', quantity: '2', equipment },
    ],
  });
  assert.equal((await call('request-submit', orderPart('QA-EX401'), warehouse)).status, 409);
  const request = await call('request-submit', orderPart('QA-DZ203'), warehouse);
  assert.equal(request.status, 200);
  const line = (await call('requests', null, warehouse)).body.items[0];
  const created = await call('order-save', newOrder({ entity: 'TP_PA_DEMO', unit: 'QA-DZ203', lines: [
    { requestLineId: line.id, quantity: '2', unitPrice: '5.00' },
  ] }), buyer);
  assert.equal(created.status, 200);
  const { folio } = created.body;
  let order = await readOrder(folio, buyer);
  assert.equal((await call('order-status', {
    operationId: randomUUID(), folio, version: order.version, status: 'Aprobada', reason: 'Soporte Q25 QA',
  }, buyer)).status, 200);
  order = await readOrder(folio, buyer);
  sheets.setCatalogStockFormula('=SUM(F10:F20)');
  const blockedReceipt = await call('order-receive', {
    operationId: randomUUID(), folio, version: order.version, lineId: order.lines[0].id, quantity: '1', reference: 'R-FORMULA',
  }, warehouse);
  assert.equal(blockedReceipt.status, 409);
  assert.match(blockedReceipt.body.error, /fórmula/i);
  assert.equal((await readOrder(folio, buyer)).lines[0].received, '0');
  assert.equal(stock(), '4');
  sheets.setCatalogStockFormula('');
  for (const ref of ['R-11','R-12']) {
    const receipt = { operationId: randomUUID(), folio, version: order.version, lineId: order.lines[0].id, quantity: '1', reference: ref };
    assert.equal((await call('order-receive', receipt, warehouse)).status, 200);
    assert.equal((await call('order-receive', receipt, warehouse)).status, 200);
    order = await readOrder(folio, buyer);
  }
  assert.equal(stock(), '6');
  const move = (kind, quantity, reference) => ({ operationId: randomUUID(), kind, partNumber: 'SKU-QA', ot: 'OT-QA-01', quantity, reference });
  sheets.setCatalogStockFormula('=SUM(F10:F20)');
  assert.equal((await call('inventory-move', move('Salida','2','S-FORMULA'), warehouse)).status, 409);
  assert.equal(stock(), '6');
  sheets.setCatalogStockFormula('');
  assert.equal((await call('inventory-move', move('Salida','7','S-01'), warehouse)).status, 409);
  assert.equal((await call('inventory-move', move('Salida','2','S-01'), buyer)).status, 403);
  const issue = move('Salida','2','S-01');
  assert.equal((await call('inventory-move', issue, warehouse)).status, 200);
  assert.equal((await call('inventory-move', issue, warehouse)).status, 200);
  assert.equal(stock(), '4');
  assert.equal((await call('inventory-move', move('Devolución','3','D-01'), warehouse)).status, 409);
  assert.equal((await call('inventory-move', move('Devolución','1','D-01'), warehouse)).status, 200);
  assert.equal(stock(), '5');
  const history = (await call('inventory-movements', null, warehouse, { ot: 'OT-QA-01' })).body.items;
  assert.deepEqual(history.map(item => [item.kind,item.quantity]), [['Devolución','1'],['Salida','2']]);
  assert.equal(sheets.inspect('Movimientos Repuestos PA').length, 5);
});

test('cada devolución debita la salida elegida y revierte su valuación original hasta el último centavo', async () => {
  const inventoryValuations = [{ partNumber: 'SKU-QA', unitCost: '9.99', currency: 'USD', reference: 'COSTO-APROBADO-QA' }];
  const { call, sheets } = setup(undefined, { inventoryValuations });
  const warehouse = { ...manager, project: 'tmf-panama', role: 'jefe_taller', canApprovePurchases: false, canReceivePurchases: true };
  const move = (kind, quantity, reference, originalIssueId) => call('inventory-move', {
    operationId: randomUUID(), kind, quantity, reference, partNumber: 'SKU-QA', ot: 'OT-QA-01', originalIssueId,
  }, warehouse);
  const first = await move('Salida', '1.001', 'SAL-A');
  assert.equal(first.status, 200);
  assert.equal(first.body.valuation?.delta, '10.00');
  inventoryValuations[0].unitCost = '14.00';
  const second = await move('Salida', '1.001', 'SAL-B');
  assert.equal(second.body.valuation?.delta, '14.01');
  assert.equal((await move('Devolución', '0.5', 'SIN-ORIGEN')).status, 409);
  assert.equal((await move('Devolución', '1.2', 'EXCESO', first.body.id)).status, 409);
  assert.equal((await move('Devolución', '0.5', 'NO-EXISTE', 'abc')).status, 409);
  const partial = await move('Devolución', '0.5', 'DEV-A1', first.body.id);
  assert.equal(partial.body.valuation?.delta, '-5.00');
  const remaining = () => call('inventory-movements', null, warehouse, { ot: 'OT-QA-01' }).then(r => r.body.items);
  assert.equal((await remaining()).find(item => item.id === first.body.id)?.returnable, '0.501');
  const attempts = await Promise.all([move('Devolución', '0.501', 'DEV-A2', first.body.id), move('Devolución', '0.501', 'DEV-A3', first.body.id)]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [200,409]);
  const rows = await remaining();
  const returned = rows.filter(item => item.originalIssueId === first.body.id);
  assert.deepEqual(returned.map(item => [item.valuation.delta,item.valuation.unitCost,item.valuation.reference]), [
    ['-5.00','9.99','COSTO-APROBADO-QA'], ['-5.00','9.99','COSTO-APROBADO-QA'],
  ]);
  assert.equal(rows.find(item => item.id === second.body.id)?.returnable, '1.001');
  assert.equal(sheets.inspect(TAB.catalog)[1][5], '2.999');
});
