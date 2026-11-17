import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';

const ledger = 'HERMES_PA_AJUSTES_GASTOS';
const expenses = '02 Gastos';
const id = 'GST-C48-QA-1';
const capturedBy = { project: 'tmf-panama', role: 'coordinador', userId: 'c48-author', userName: 'Captura QA', assignedUnits: ['QA-DZ203'] };
const reviewer = { ...capturedBy, role: 'gerencia', userId: 'c48-reviewer', userName: 'Contabilidad QA' };
const reviewerAgain = { ...reviewer, userId: 'c48-second-reviewer', userName: 'Revisión independiente QA' };

function fixture(t, { closedThrough = '2026-10', pausedOperations } = {}) {
  const environment = { HERMES_PANAMA_EXPENSE_CLOSED_THROUGH: closedThrough,
    HERMES_PANAMA_EXPENSE_REVIEWER_IDS: [capturedBy.userId, reviewer.userId, reviewerAgain.userId].join(',') };
  for (const [key, value] of Object.entries(environment)) {
    const prior = process.env[key];
    process.env[key] = value;
    t.after(() => { if (prior === undefined) delete process.env[key]; else process.env[key] = prior; });
  }
  const row = Array(29).fill('');
  Object.assign(row, { 0: id, 1: '15/10/2026', 3: 'Combustible', 4: 'Proveedor QA', 7: '100.00', 8: '7.00', 9: '107.00', 10: 'QA-DZ203',
    16: 'Aprobado', 17: 'GST-C48-QA', 18: capturedBy.userId, 19: '107.00', 21: 'TP_PA', 22: 'USD', 24: '15/10/2026' });
  const tables = { [expenses]: [['ID'], row], [ledger]: [['GASTO_ID', 'AJUSTE_ID', 'EVENTO', 'DETALLE_JSON']] };
  const receipts = new Map();
  const guardsSeen = new Set();
  let loseReply = false;
  let session;
  const gate = createHermesGateway({
    enablePanamaOperations: true,
    writeEnabled: true,
    pausedOperations,
    sessionReader: async () => session,
    sheets: {
      async read(tab) { return structuredClone(tables[tab] || []); },
      async readMany(tabs) { return tabs.map(tab => structuredClone(tables[tab] || [])); },
      async replay({ key, fingerprint }) {
        const receipt = receipts.get(key);
        if (receipt && receipt.fingerprint !== fingerprint) throw Object.assign(new Error('Operación repetida.'), { status: 409 });
        return receipt ? structuredClone(receipt.result) : null;
      },
      async commit({ key, fingerprint, guards, writes, result }) {
        if (receipts.has(key)) return { result: await this.replay({ key, fingerprint }), replayed: true };
        if (guards.some(guard => guardsSeen.has(guard))) throw Object.assign(new Error('Versión anterior.'), { status: 409 });
        for (const write of writes) {
          assert.equal(write.tab, ledger, 'un ajuste nunca modifica la fila original');
          assert.ok(write.append);
          tables[ledger].push(...structuredClone(write.append));
        }
        for (const guard of guards) guardsSeen.add(guard);
        receipts.set(key, { fingerprint, result });
        if (loseReply) { loseReply = false; throw new Error('respuesta perdida después de confirmar'); }
        return { result, replayed: false };
      },
    },
  });
  const request = async (path, actor, body, query = {}) => {
    session = actor;
    const response = { setHeader() {}, status(status) { this.statusCode = status; return this; }, json(value) { this.body = value; return this; } };
    await gate({ method: body ? 'POST' : 'GET', query: { path, ...query }, body, headers: {} }, response);
    return { status: response.statusCode, body: response.body };
  };
  const purchase = (action, actor, body, query) => request('api/purchasing/expense-' + action, actor, body, query);
  const history = actor => purchase('adjustments', actor, undefined, { id });
  const propose = (version, fields = {}) => ({ id, version, amount: '97.00', reason: 'Corrección interna sustentada QA', operationId: randomUUID(), ...fields });
  return { row, tables, request, purchase, history, propose, loseNextReply() { loseReply = true; } };
}

test('período cerrado mantiene el gasto original y registra aprobación, reintento y montos sucesivos', async t => {
  const ctx = fixture(t);
  const original = structuredClone(ctx.row);
  const read = await ctx.history(capturedBy);
  assert.equal(read.status, 200);
  assert.equal(read.body.originalAmount, '107.00');
  assert.equal(read.body.canPropose, true);
  assert.equal(read.body.canReview, false);
  const attemptedChanges = [
    await ctx.request('api/sheets/update', capturedBy, { tab: expenses, row: 1, col: 9, values: ['97.00'] }),
    await ctx.request('api/sheets/append', capturedBy, { tab: expenses, values: original }),
    await ctx.purchase('delete', capturedBy, { id, operationId: randomUUID() }),
    await ctx.purchase('review', reviewer, { id, status: 'Rechazado', reason: 'Editar original', operationId: randomUUID() }),
  ];
  assert.deepEqual(attemptedChanges.map(result => result.status), [403, 403, 409, 409]);

  const submitted = await ctx.purchase('adjustment-propose', capturedBy, ctx.propose(read.body.version));
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  const pending = await ctx.history(reviewer);
  assert.equal(pending.body.effectiveAmount, '107.00');
  assert.equal(pending.body.items[0].status, 'Pendiente');
  assert.equal(pending.body.items[0].previousAmount, '107.00');
  assert.equal(pending.body.items[0].newAmount, '97.00');
  assert.equal(pending.body.items[0].authorId, capturedBy.userId);

  const decision = { id, version: pending.body.version, adjustmentId: submitted.body.adjustmentId,
    status: 'Aprobado', operationId: randomUUID() };
  ctx.loseNextReply();
  const lost = await ctx.purchase('adjustment-review', reviewer, decision);
  assert.equal(lost.status, 503);
  const replay = await ctx.purchase('adjustment-review', reviewer, decision);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.status, 'Aprobado');
  assert.equal(ctx.tables[ledger].length, 3);
  assert.deepEqual(ctx.tables[expenses][1], original);

  const applied = (await ctx.history(reviewer)).body;
  assert.equal(applied.effectiveAmount, '97.00');
  assert.equal(applied.items[0].reviewerId, reviewer.userId);
  assert.equal(applied.items[0].reason, 'Corrección interna sustentada QA');
  assert.ok(!Number.isNaN(Date.parse(applied.items[0].createdAt)));
  assert.ok(Date.parse(applied.items[0].reviewedAt) >= Date.parse(applied.items[0].createdAt));

  const next = await ctx.purchase('adjustment-propose', capturedBy, ctx.propose(applied.version, { amount: '90.00' }));
  assert.equal(next.status, 200);
  const withPending = (await ctx.history(reviewer)).body;
  assert.equal(withPending.items[1].previousAmount, '97.00');
  assert.equal(withPending.effectiveAmount, '97.00');
});

test('separa captura de revisión y rechaza unidades, cantidades y versiones fuera de alcance', async t => {
  const ctx = fixture(t);
  const first = (await ctx.history(capturedBy)).body;
  assert.equal((await ctx.history({ ...reviewer, assignedUnits: [] })).status, 403);
  assert.equal((await ctx.purchase('adjustment-propose', reviewer, ctx.propose(first.version))).status, 403);
  assert.equal((await ctx.purchase('adjustment-propose', capturedBy, ctx.propose('vieja'))).status, 409);
  assert.equal((await ctx.purchase('adjustment-propose', capturedBy, ctx.propose(first.version, { amount: '7.015' }))).status, 400);
  assert.equal((await ctx.purchase('adjustment-propose', capturedBy, ctx.propose(first.version, { amount: '107.00' }))).status, 400);
  const actor = { ...capturedBy, role: 'gerencia' };
  const a = await ctx.purchase('adjustment-propose', actor, ctx.propose(first.version));
  assert.equal(a.status, 200);
  const pending = (await ctx.history(actor)).body;
  assert.equal((await ctx.purchase('adjustment-propose', actor, ctx.propose(pending.version, { amount: '80' }))).status, 409);
  const decision = { id, version: pending.version, adjustmentId: a.body.adjustmentId, status: 'Rechazado', reason: 'Soporte insuficiente', operationId: randomUUID() };
  assert.equal((await ctx.purchase('adjustment-review', actor, decision)).status, 403);
  assert.equal((await ctx.purchase('adjustment-review', reviewerAgain, decision)).status, 200);
  const result = (await ctx.history(capturedBy)).body;
  assert.equal(result.effectiveAmount, '107.00');
  assert.equal(result.items[0].reviewReason, 'Soporte insuficiente');
  assert.equal(result.items[0].status, 'Rechazado');
  assert.equal((await ctx.request('api/sheets/read', reviewer, undefined, { tab: ledger })).status, 403);
});

test('un período sin cierre confirmado no habilita ajustes', async t => {
  const ctx = fixture(t, { closedThrough: '' });
  assert.equal((await ctx.history(capturedBy)).status, 409);
  assert.equal((await ctx.purchase('adjustment-propose', capturedBy, ctx.propose('versión ajena'))).status, 409);
});

test('las pausas vigentes de captura y revisión alcanzan las nuevas escrituras', async t => {
  const ctx = fixture(t, { pausedOperations: new Set(['api/purchasing/expense-save', 'api/purchasing/expense-review']) });
  const read = await ctx.history(capturedBy);
  assert.equal(read.status, 200);
  const proposal = await ctx.purchase('adjustment-propose', capturedBy, ctx.propose(read.body.version));
  const review = await ctx.purchase('adjustment-review', reviewer, { id, version: read.body.version, operationId: randomUUID() });
  assert.deepEqual([proposal.status, review.status], [503, 503]);
  assert.equal(ctx.tables[ledger].length, 1);
});
