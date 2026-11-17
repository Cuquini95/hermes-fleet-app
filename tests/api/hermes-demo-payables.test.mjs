import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { normalizeRosterProfile } from '../../api/_lib/hermes-identity.js';
import { createPanamaDemoSheets } from '../../api/_lib/hermes-panama-demo.js';
import { dispatchPurchasing } from '../../api/_lib/hermes-purchasing.js';

const project = 'tmf-panama';
const roster = (number, fields = {}) => ({
  user_id: '00000000-0000-4000-8000-' + String(number).padStart(12, '0'),
  email: 'hermes-pa-demo-p' + String(number).padStart(2, '0') + '@example.com',
  user_name: 'Perfil de prueba ' + number,
  active: true,
  projects: [project],
  role: 'gerencia',
  unit_scope: 'assigned',
  assigned_units: ['QA-DZ203'],
  ...fields,
});

test('preview finance mocks reconcile partial deliveries without granting access to production or other demo roles', async () => {
  const previousEnvironment = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'production';
    assert.equal(normalizeRosterProfile(roster(20), project), null);
    assert.equal(normalizeRosterProfile(roster(21), project), null);

    process.env.VERCEL_ENV = 'preview';
    const treasury = normalizeRosterProfile(roster(20), project);
    const accounting = normalizeRosterProfile(roster(21), project);
    const buyer = normalizeRosterProfile(roster(2, { can_approve_purchases: true }), project);
    const warehouse = normalizeRosterProfile(roster(16, { can_receive_purchases: true, role: 'jefe_taller' }), project);
    assert.deepEqual([accounting.canRecordPurchaseInvoices, accounting.canRecordPurchasePayments], [true, false]);
    assert.deepEqual([treasury.canRecordPurchaseInvoices, treasury.canRecordPurchasePayments], [false, true]);

    let demoRow;
    const sheets = createPanamaDemoSheets(async ({ method = 'GET', body }) => {
      if (method === 'GET') return Response.json(demoRow ? [structuredClone(demoRow)] : []);
      demoRow = structuredClone(body);
      return Response.json([demoRow]);
    });
    const call = (session, action, body) => dispatchPurchasing({
      path: 'api/purchasing/' + action,
      method: body ? 'POST' : 'GET',
      body: body ? { ...body, operationId: body.operationId ?? randomUUID() } : undefined,
      session, sheets,
    });
    assert.equal((await call(buyer, 'ap')).status, 403);
    assert.equal((await call(treasury, 'ap-invoice', {})).status, 403);
    assert.equal((await call(accounting, 'ap-payment', {})).status, 403);
    const initial = (await call(accounting, 'ap')).body.orders[0];
    assert.equal(initial.folio, 'OC-DEMO-001');

    const received = await call(warehouse, 'order-receive', {
      folio: initial.folio, version: initial.version,
      lineId: initial.lines[0].id, quantity: '1', reference: 'REM-AP-DEMO',
    });
    assert.equal(received.status, 200, JSON.stringify(received.body));
    const order = (await call(accounting, 'ap')).body.orders[0];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const billed = await call(accounting, 'ap-invoice', {
      folio: order.folio, version: order.version, reference: 'FAC-AP-DEMO', issueDate: today, dueDate: today,
      currency: 'USD', amount: '80.25', tax: '5.25',
      lines: [{ lineId: order.lines[0].id, quantity: '1', unitPrice: '75' }],
    });
    assert.equal(billed.status, 200, JSON.stringify(billed.body));
    const invoice = (await call(treasury, 'ap')).body.invoices[0];
    const payment = { invoiceId: invoice.id, version: invoice.version, amount: '25.00', date: today,
      reference: 'TRF-AP-DEMO', operationId: randomUUID() };
    const paid = await call(treasury, 'ap-payment', payment);
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal((await call(treasury, 'ap-payment', payment)).status, 200);
    const saved = (await call(treasury, 'ap')).body.invoices[0];
    assert.deepEqual([saved.paid, saved.balance, saved.payments.length], ['25.00', '55.25', 1]);
    assert.equal(demoRow.tables, undefined);
    assert.ok(demoRow.data.tables.HERMES_PA_FACTURAS_OC);
    assert.ok(demoRow.data.tables.HERMES_PA_PAGOS_FACTURA);
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  }
});
