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

function setup(options) {
  const sheets = store(options);
  const call = (action, body, session = manager, query) => dispatchPurchasing({
    path: 'api/purchasing/' + action,
    method: body ? 'POST' : 'GET',
    body, query, session, sheets,
  });
  async function readOrder(folio, session = manager) {
    const response = await call('order', null, session, { folio });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.order;
  }
  return { sheets, call, readOrder };
}

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
  assert.equal((await call('order-invoice', input({ reference: 'F-01', amount: order.total }), accounting)).status, 200);
  order = await readOrder(folio, buyer);
  assert.equal(order.invoice.reference, 'F-01');
  assert.equal(order.invoice.actorId, accounting.userId);
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
