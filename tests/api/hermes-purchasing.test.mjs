import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { dispatchPurchasing, PURCHASE_TABS as TAB } from '../../api/_lib/hermes-purchasing.js';

const manager = {
  userId: 'actor-qa-gerencia', userName: 'Gerencia de prueba', role: 'gerencia', allUnits: true,
  projects: ['QA'], assignedUnits: [], canApprovePurchases: true,
};

function store() {
  let rows = {
    [TAB.orders]: [['OC_ID']],
    [TAB.lines]: [['OC_ID'], ['OC-001', '1', 'Partida histórica sin cabecera', '1', '10', '10']],
    [TAB.requests]: [['Fecha']],
    [TAB.vendors]: [['NOMBRE'], ['Proveedor de prueba', 'RFC-QA', 'Dirección QA']],
    [TAB.expenses]: [['Gasto_ID']],
    [TAB.audit]: [['Registro']],
  };
  const used = new Set();
  const replies = new Map();
  let failure;
  return {
    inspect: (tab) => structuredClone(rows[tab]),
    async read(tab) { return structuredClone(rows[tab]); },
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

function setup() {
  const sheets = store();
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
