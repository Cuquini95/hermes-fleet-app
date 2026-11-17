import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { requester } from '../../scripts/qa-rollout/api-cases.mjs';
import { firstAccount, fixturePassword, loadAccounts, nonApprovingManager, startFixture, tabs } from '../../scripts/qa-rollout/fixture.mjs';

const repoDirectory = fileURLToPath(new URL('../../', import.meta.url));

test('Panama pilot actions deny unauthorized roles without writing and audit the authorized actor', async t => {
  const { origin, sheet, stop } = await startFixture({ repoDirectory, distDirectory: repoDirectory });
  t.after(stop);
  const request = requester(origin);

  async function session(account) {
    const { user, membership } = account;
    const login = await request('/api/auth/login', { body: { email: user.email, password: fixturePassword } });
    assert.equal(login.status, 200, login.data?.error);
    assert.equal(login.data.userId, user.id);
    assert.equal(login.data.role, membership.role);
    const cookie = login.cookie.split(';', 1)[0];
    return {
      id: user.id, role: membership.role, name: membership.user_name,
      workshop: (action, body) => request(`/hermes-api/api/workshop/${action}`, { cookie, body }),
      purchasing: (action, body) => request(`/hermes-api/api/purchasing/${action}`, { cookie, body }),
    };
  }

  function accepted(result) {
    assert([200, 201].includes(result.status), `Expected a saved operation, received ${result.status}: ${result.data?.error ?? ''}`);
    return result.data;
  }

  function snapshot(tabNames) {
    return tabNames.map(name => sheet.read(name));
  }

  async function denyWithoutWriting(request, tabNames) {
    const before = snapshot(tabNames);
    const denied = await request();
    assert.equal(denied.status, 403, denied.data?.error);
    assert.deepEqual(snapshot(tabNames), before);
  }

  await t.test('assign, close and release the same OT with a separately attributed audit trail', async () => {
    const operator = await session(firstAccount('operador'));
    const coordinator = await session(firstAccount('coordinador'));
    const technician = await session(firstAccount('mecanico'));
    const leader = await session(firstAccount('jefe_taller'));
    const supervisor = await session(firstAccount('supervisor'));
    const { otId } = accepted(await operator.workshop('report', {
      mutationId: randomUUID(), unit: 'EX401', type: 'Mecánica', description: 'Validar facultades del piloto',
      canMove: false, customer: 'Frente de prueba', location: 'Patio de prueba', downtime: 'Indeterminado', photos: [],
    }));
    const operation = (field, value) => ({ mutationId: randomUUID(), otId, field, value });
    const workshopTabs = [tabs.orders, tabs.history, tabs.failure];
    const assign = operation('mecanico_asignado', technician.id);
    await denyWithoutWriting(() => supervisor.workshop('transition', assign), workshopTabs);
    accepted(await coordinator.workshop('transition', assign));
    accepted(await leader.workshop('transition', operation('estado', 'En Reparación')));
    accepted(await technician.workshop('transition', {
      ...operation('estado', 'Resuelta'), execution: { functionalTest: 'Comprobación tras reparación' },
    }));
    const close = operation('estado', 'Completado');
    await denyWithoutWriting(() => technician.workshop('transition', close), workshopTabs);
    accepted(await leader.workshop('transition', close));
    const queueBefore = accepted(await supervisor.workshop('returns'));
    assert(queueBefore.returns.some(entry => entry.otId === otId));
    const release = { mutationId: randomUUID(), otId, decision: 'accepted', notes: 'Equipo recibido en patio de prueba' };
    await denyWithoutWriting(() => leader.workshop('returns', release), workshopTabs);
    accepted(await supervisor.workshop('returns', release));
    const queueAfter = accepted(await supervisor.workshop('returns'));
    assert.equal(queueAfter.returns.some(entry => entry.otId === otId), false);

    const { history } = accepted(await supervisor.workshop('orders'));
    const actions = [
      ['mecanico_asignado', technician.name, coordinator],
      ['estado', 'Completado', leader],
      ['retorno_operativo', /Recibida .* Equipo recibido en patio de prueba/, supervisor],
    ];
    for (const [field, value, actor] of actions) {
      const rows = history.filter(entry => entry[1] === otId && entry[2] === field
        && (typeof value === 'string' ? entry[4] === value : value.test(entry[4])));
      assert.equal(rows.length, 1, field);
      assert(Number.isFinite(Date.parse(rows[0][0])), field);
      assert.deepEqual(rows[0].slice(5, 8), [actor.name, actor.role, actor.id], field);
    }
  });

  await t.test('approve and receive the same OC with distinct capabilities and audited actors', async () => {
    const manager = await session(firstAccount('gerencia'));
    const reviewer = await session(nonApprovingManager);
    const warehouse = await session(loadAccounts.find(actor => actor.membership.can_receive_purchases));
    const { folio } = accepted(await manager.purchasing('order-save', {
      operationId: randomUUID(), date: '2026-11-12', vendorName: 'Proveedor QA', vendorRfc: 'QAT000000000',
      unit: 'DZ203', entity: 'TP_PA_QA', tax: 0, lines: [{ description: 'Filtro de prueba', quantity: 2, unitPrice: 10 }],
    }));
    const readOrder = async () => accepted(await manager.purchasing('order?folio=' + encodeURIComponent(folio))).order;
    const { version } = await readOrder();
    const purchaseTabs = [tabs.purchases, tabs.lines, tabs.changes];
    const approve = { operationId: randomUUID(), folio, version, status: 'Aprobada', reason: 'Revisión de prueba' };
    await denyWithoutWriting(() => reviewer.purchasing('order-status', approve), purchaseTabs);
    accepted(await manager.purchasing('order-status', approve));
    const approved = await readOrder();
    assert.equal(approved.approvedById, manager.id);
    assert(Number.isFinite(Date.parse(approved.approvedAt)));
    const receive = {
      operationId: randomUUID(), folio, version: approved.version, lineId: approved.lines[0].id, quantity: 1, reference: 'Entrega de prueba',
    };
    await denyWithoutWriting(() => manager.purchasing('order-receive', receive), purchaseTabs);
    accepted(await warehouse.purchasing('order-receive', receive));
    const received = await readOrder();
    assert.equal(received.status, 'Recibida parcial');
    assert.equal(received.lines[0].receipts.length, 1);
    assert.equal(received.lines[0].receipts[0].actorId, warehouse.id);
    for (const [operation, action, actor] of [
      [approve, 'Estado de OC Aprobada', manager],
      [receive, 'Recepción de partida', warehouse],
    ]) {
      const rows = sheet.read(tabs.changes).filter(row => row[0] === operation.operationId && row[6] === folio);
      assert.equal(rows.length, 1, action);
      assert(Number.isFinite(Date.parse(rows[0][1])), action);
      assert.equal(rows[0][2], actor.name, action);
      assert.equal(rows[0][4], action);
      assert.equal(rows[0][7], actor.role + ' · ' + actor.id, action);
    }
  });
});
