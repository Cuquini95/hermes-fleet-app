import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { dispatchPurchasing, PURCHASE_TABS as TAB } from '../../api/_lib/hermes-purchasing.js';

const operator = { userId: 'fixture-author', userName: 'Captura QA', project: 'tmf-panama', role: 'jefe_taller', allUnits: true, previewDemo: true };
const reviewer = { ...operator, userId: 'fixture-reviewer', userName: 'Contabilidad QA', role: 'gerencia' };
const unassignedManager = { ...reviewer, userId: 'fixture-without-permission' };

function setup(t) {
  const original = { ...process.env };
  process.env.HERMES_PANAMA_EXPENSE_CLOSED_THROUGH = '2026-10';
  process.env.HERMES_PANAMA_EXPENSE_REVIEWER_IDS = 'fixture-reviewer,fixture-author';
  t.after(() => {
    for (const k of ['HERMES_PANAMA_EXPENSE_CLOSED_THROUGH', 'HERMES_PANAMA_EXPENSE_REVIEWER_IDS']) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });
  const ledger = { [TAB.expenses]: [['ID']], [TAB.audit]: [['Fecha']] };
  const mutations = new Map();
  const guards = new Set();
  const sheets = {
    async read(tab) { return structuredClone(ledger[tab]); },
    async replay({ key }) { return mutations.get(key) ?? null; },
    async commit({ key, result, writes, guards: versions }) {
      assert.ok(versions.every((version) => !guards.has(version)));
      for (const { tab, row, col = 0, values, append } of writes) {
        if (append) ledger[tab].push(...structuredClone(append));
        else values.forEach((v, i) => { ledger[tab][row][col + i] = v; });
      }
      versions.forEach((version) => guards.add(version));
      mutations.set(key, result);
      return { replayed: false, result };
    },
  };
  function call(action, body, session = operator) {
    return dispatchPurchasing({ path: 'api/purchasing/' + action, method: body ? 'POST' : 'GET', body, session, sheets });
  }
  return { ledger, call };
}
function expenseInput(patch = {}) {
  return {
    operationId: randomUUID(),
    expense: {
      tipo: 'Servicio', proveedor: 'Proveedor QA', subtotal: '200.00', iva: '14.00', total: '214.00',
      metodo_pago: 'Transferencia', entity: 'TP_PA_DEMO', currency: 'USD', document_date: '2026-11-01',
      line_items: [], ...patch,
    },
    allocations: [{ unit: 'QA-DZ203', amount: '100.00' }, { unit: 'QA-EX401', amount: '114.00' }],
  };
}
test('Panamá registra los centavos, el impuesto del documento, entidad, moneda y fecha como pendiente', async (t) => {
  const { ledger, call } = setup(t);
  assert.equal((await call('expense-save', expenseInput({ currency: 'MXN' }))).status, 400);
  assert.equal((await call('expense-save', expenseInput({ entity: 'ENTIDAD-MX' }))).status, 400);
  assert.equal((await call('expense-save', expenseInput({ document_date: '' }))).status, 400);
  const saved = await call('expense-save', expenseInput());
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const rows = ledger[TAB.expenses].slice(1);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row[16] === 'Pendiente' && row[21] === 'TP_PA_DEMO' && row[22] === 'USD' && row[23] === 'ITBMS' && row[24] === '01/11/2026'));
  assert.equal(rows.reduce((total, row) => total + Math.round(Number(row[8]) * 100), 0), 1400);
});
test('Panamá requiere revisor designado e independiente, con trazabilidad y bloqueo de período', async (t) => {
  const { ledger, call } = setup(t);
  assert.equal((await call('expense-save', expenseInput({ document_date: '2026-10-31' }))).status, 409);
  const saved = await call('expense-save', expenseInput());
  assert.equal(saved.status, 200);
  const options = await call('expense-options', null, reviewer);
  assert.equal(options.body.canReview, true);
  assert.equal(options.body.closedThrough, '2026-10');
  const review = { operationId: randomUUID(), id: saved.body.ids[0], status: 'Aprobado', reason: 'Soporte conciliado' };
  assert.equal((await call('expense-review', review, operator)).status, 403);
  assert.equal((await call('expense-review', review, unassignedManager)).status, 403);
  const approved = await call('expense-review', review, reviewer);
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal((await call('expense-review', review, reviewer)).status, 200);
  assert.ok(ledger[TAB.expenses].slice(1).every((row) => row[16] === 'Aprobado' && row[25] === reviewer.userId));
  assert.equal(ledger[TAB.audit].length, 3);
  assert.equal((await call('expense-delete', { operationId: randomUUID(), id: saved.body.ids[0] }, reviewer)).status, 409);
  const open = await call('expense-save', expenseInput());
  process.env.HERMES_PANAMA_EXPENSE_CLOSED_THROUGH = '2026-11';
  assert.equal((await call('expense-delete', { operationId: randomUUID(), id: open.body.ids[0] }, operator)).status, 409);
});
