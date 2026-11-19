import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getStickerTemplate } from '../../src/data/sticker-inspection-templates.js';
import { photoPng, tabs } from './fixture.mjs';

export async function checkPartNeedPilot({ fixture, record, inRole, shot, changeOrderStatus, noHorizontalOverflow }) {
  const { sheet } = fixture;
  await record('MÓVIL-PILOTO-INSPECCIÓN-OT-REPUESTO', async () => {
    const actors = fixture.registerLoadAccounts(28);
    const operator = actors.find(a => a.membership.role === 'operador');
    const mechanic = actors.find(a => a.membership.role === 'mecanico');
    const chief = actors.find(a => a.membership.role === 'jefe_taller' && !a.membership.can_receive_purchases);
    const warehouse = actors.find(a => a.membership.can_receive_purchases);
    const operations = actors.find(a => a.membership.role === 'supervisor');
    const [hse] = fixture.registerPositionAccounts([{ position: 'TP-PER-020', role: 'supervisor',
      capabilities: { can_review_panama_hse: true } }]);
    const baseline = sheet.checkpoint();
    const evidence = new Set(fixture.evidence.keys());
    const photoKeys = new Set(fixture.photos.keys());
    const width = 390;
    const gate = (page, action, body) => page.evaluate(async ({ action, body }) => {
      const response = await fetch('/hermes-api/api/purchasing/' + action, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }, { action, body });
    const button = (page, name) => page.getByRole('button', { name, exact: true });
    const notice = (page, text) => page.getByText(text, { exact: true }).waitFor({ state: 'visible' });

    try {
      // Keep the isolated pilot independent of the other synthetic workshop cases.
      for (const tab of [tabs.orders, tabs.failure, tabs.dvir, tabs.sticker, tabs.findings]) {
        sheet.seed(tab, sheet.read(tab).slice(0, 1));
      }
      const catalog = sheet.read(tabs.parts);
      const header = catalog.find(row => row[0] === 'SKU');
      header[14] = 'Almacén';
      const stock = catalog.find(row => row[0] === 'QA-001');
      stock[14] = 'Patio de prueba';
      const empty = [...stock];
      empty[0] = 'QA-FALTANTE';
      empty[2] = 'OEM-QA-FALTANTE';
      empty[5] = '0';
      catalog.push(empty);
      sheet.seed(tabs.parts, catalog);

      const inspection = await inRole('operador', width, async page => {
        await page.locator('#main-content select').first().selectOption('DZ203');
        await page.getByPlaceholder('Ej: 3240').fill('1476');
        const ok = page.getByRole('button', { name: 'OK', exact: true });
        const fail = page.getByRole('button', { name: 'Falla', exact: true });
        for (let index = 0; index < 12; index++) await (index === 2 ? fail : ok).nth(index).click();
        await page.getByPlaceholder('Describe el problema...').fill('Hallazgo de prueba móvil');
        await page.getByLabel('Observaciones', { exact: true }).fill('Recorrido de prueba · DZ203');
        await page.locator('input[type=file]:not([capture])').last()
          .setInputFiles({ name: 'piloto-foto.png', mimeType: 'image/png', buffer: photoPng });
        await button(page, 'Enviar Inspección').click();
        await button(page, 'Confirmar').click();
        await notice(page, 'Inspección guardada y vinculada a Taller');
        await noHorizontalOverflow(page, width);
        await shot(page, 'piloto-inspeccion-390.png');
        const row = sheet.read(tabs.dvir).find(item => item[23]?.includes('Recorrido de prueba'));
        assert(row?.[25] && row[24]);
        assert.equal(sheet.read(tabs.orders).filter(item => item[1] === row[25]).length, 1);
        assert(sheet.read(tabs.history).some(item => item[1] === row[25] && item[2] === 'inspeccion_origen' && item[4] === row[1]));
        const photo = await page.request.get(fixture.origin + row[24]);
        assert.deepEqual(await photo.body(), photoPng);
        return { id: row[1], ot: row[25] };
      }, operator, '/dvir');

      const otRoute = '/workorders/' + encodeURIComponent(inspection.ot);
      await inRole('jefe_taller', width, async page => {
        const origin = page.locator('details').filter({ has: page.getByText('Inspección de origen', { exact: true }) });
        await origin.locator('summary').click();
        await notice(origin, inspection.id);
        await page.getByLabel('Mecánico asignado').selectOption(mechanic.user.id);
        const [saved] = await Promise.all([
          page.waitForResponse(response => response.url().endsWith('/api/workshop/transition') && response.request().method() === 'POST'),
          button(page, 'Asignar').click(),
        ]);
        assert.equal(saved.status(), 200);
      }, chief, otRoute);

      await inRole('mecanico', width, async page => {
        const region = page.getByRole('region', { name: 'Solicitudes de repuestos' });
        for (const [sku, label] of [['QA-001', 'Filtro con stock'], ['QA-FALTANTE', 'Filtro sin stock']]) {
          await button(region, 'Solicitar a Taller').click();
          await region.getByLabel('Número de parte o SKU').fill(sku);
          await region.getByLabel('Repuesto', { exact: true }).fill(label);
          await region.getByLabel('Cantidad', { exact: true }).fill('2');
          await region.getByLabel('Motivo', { exact: true }).fill('Prueba de la reparación asignada');
          await button(region, 'Enviar a Taller').click();
          await notice(region, 'Solicitud enviada a Taller.');
          await notice(region, label + ' · 2');
        }
        await noHorizontalOverflow(page, width);
        await shot(page, 'piloto-mecanico-390.png');
      }, mechanic, otRoute);

      await inRole('jefe_taller', width, async page => {
        const region = page.getByRole('region', { name: 'Solicitudes de repuestos' });
        for (const [label, text] of [['Filtro con stock', 'Solicitud autorizada para Almacén.'],
          ['Filtro sin stock', 'Solicitud autorizada. Faltante enviado a Compras.']]) {
          const card = region.locator('article').filter({ hasText: label });
          await button(card, 'Autorizar solicitud').click();
          await notice(region, text);
          await notice(card, 'Autorizada');
        }
        await noHorizontalOverflow(page, width);
        await shot(page, 'piloto-taller-390.png');
      }, chief, otRoute);
      const purchases = sheet.read(tabs.requests).filter(row => row[22] === inspection.ot);
      assert.equal(purchases.length, 1);
      assert.deepEqual([purchases[0][1], purchases[0][4]], ['QA-FALTANTE', '2']);

      await inRole('jefe_taller', width, async page => {
        const card = page.getByRole('region', { name: 'Solicitudes de repuestos' }).locator('article').filter({ hasText: 'Filtro con stock' });
        const [stockRead] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/purchasing/ot-part')),
          button(card, 'Atender solicitud').click(),
        ]);
        assert.equal(stockRead.status(), 200, await stockRead.text());
        const stockInfo = await stockRead.json();
        assert(stockInfo.items?.some(item => item.warehouse === 'Patio de prueba' && Number(item.available) >= 2), JSON.stringify(stockInfo));
        await card.locator('select[name="warehouse"]').selectOption('Patio de prueba');
        await card.getByLabel('Referencia de reserva').fill('Boleta de prueba');
        await button(card, 'Confirmar reserva').click();
        await notice(page, 'Reserva guardada contra la OT.');
        await notice(card, 'Reservado 2');
        await button(card, 'Atender solicitud').click();
        await card.getByLabel('Referencia de entrega').fill('Entrega de prueba');
        await button(card, 'Confirmar entrega').click();
        await notice(page, 'Entrega guardada contra la OT.');
        await notice(card, 'Entregado 2');
        const issue = sheet.read('Movimientos Repuestos PA').find(row => row[8] === inspection.ot && row[2] === 'Salida');
        assert(issue?.[19]);
        const returned = await gate(page, 'inventory-move', { kind: 'Devolución', ot: inspection.ot, partNumber: 'QA-001',
          quantity: '1', originalIssueId: issue[0], reference: 'Devuelto en prueba', operationId: randomUUID() });
        assert.equal(returned.status, 200, JSON.stringify(returned.body));
        await noHorizontalOverflow(page, width);
        await shot(page, 'piloto-almacen-390.png');
      }, warehouse, '/inventory?bandeja=solicitudes');

      await inRole('mecanico', width, async page => {
        await notice(page.getByRole('region', { name: 'Solicitudes de repuestos' }), 'Entregado 1');
        await changeOrderStatus(page, 'En Reparación', inspection.ot);
        await changeOrderStatus(page, 'Resuelta', inspection.ot, false, 'Diagnóstico documentado en el piloto');
      }, mechanic, otRoute);
      await inRole('jefe_taller', width, async page => {
        await changeOrderStatus(page, 'Completado', inspection.ot);
        await notice(page, 'Revisión técnica completada · Retorno pendiente');
      }, chief, otRoute);
      async function attemptReturn(expected, blocker = /Retorno bloqueado/) {
        return inRole('supervisor', width, async page => {
          await page.getByLabel('Observación de Operaciones').fill('Equipo recibido en la prueba');
          const [receipt] = await Promise.all([
            page.waitForResponse(response => response.url().endsWith('/api/workshop/returns') && response.request().method() === 'POST'),
            button(page, 'Confirmar retorno ahora').click(),
          ]);
          assert.equal(receipt.status(), expected, await receipt.text());
          if (expected === 200) {
            await page.getByText(/Equipo recibido por/).waitFor({ state: 'visible' });
            await shot(page, 'piloto-retorno-390.png');
          } else {
            assert.match((await receipt.json()).error, blocker);
          }
        }, operations, otRoute);
      }
      await attemptReturn(409);
      await inRole('operador', width, async page => {
        await page.locator('#main-content select').first().selectOption('DZ203');
        await button(page, 'Post-Operación').click();
        await page.getByPlaceholder('Ej: 3240').fill('1476');
        const ok = page.getByRole('button', { name: 'OK', exact: true });
        for (let index = 0; index < 12; index++) await ok.nth(index).click();
        await page.getByLabel('Observaciones', { exact: true }).fill('Reinspección de prueba después de la reparación');
        await button(page, 'Enviar Inspección').click();
        await button(page, 'Confirmar').click();
        await notice(page.getByRole('region', { name: 'Comprobante de inspección' }), 'Inspección guardada');
        assert.equal(sheet.read(tabs.orders).length, 2);
      }, operator, '/dvir');

      const template = getStickerTemplate('camion_articulado');
      const hardStop = template.items.find(item => item.hardStop);
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date());
      const sticker = async (finalColor, time) => inRole('operador', width, async page => {
        const mutationId = randomUUID();
        let photos = [];
        if (finalColor === 'red') {
          const upload = await page.request.post(fixture.origin + '/hermes-api/api/evidence', { data: {
            kind: 'sticker', operationId: mutationId, expectedUserId: operator.user.id, units: ['DZ203'],
            slot: 0, mimeType: 'image/png', data: photoPng.toString('base64'),
          } });
          assert.equal(upload.ok(), true, await upload.text());
          photos = [(await upload.json()).url];
        }
        const checks = template.items.map(item => item.id === hardStop.id && finalColor === 'red'
          ? { itemId: item.id, status: 'no_cumple', canOperate: false, comment: 'Bloqueo ficticio HSE', photos }
          : { itemId: item.id, status: 'cumple', canOperate: true });
        const reply = await page.request.post(fixture.origin + '/hermes-api/api/workshop/sticker', { data: {
          mutationId, unit: 'DZ203', templateId: template.id, company: 'Hermes QA', date, time, checks,
          finalColor, approve: false, photos,
        } });
        assert.equal(reply.status(), 201, await reply.text());
        return reply.json();
      }, operator, '/sticker-inspection');
      const blocked = await sticker('red', '09:00');
      await attemptReturn(409, /Retorno bloqueado.*sticker/i);
      assert(!sheet.read(tabs.history).some(entry => entry[1] === inspection.ot && entry[2] === 'retorno_operativo'));
      const cleared = await sticker('green', '10:00');
      await inRole('supervisor', width, async page => {
        const reply = await page.request.post(fixture.origin + '/hermes-api/api/workshop/stickerreview', {
          data: { mutationId: randomUUID(), folio: cleared.folio },
        });
        assert.equal(reply.status(), 200, await reply.text());
        assert.equal((await reply.json()).canDispatch, true);
      }, hse, '/sticker-inspection');
      await attemptReturn(200);

      const row = sheet.read(tabs.orders).find(item => item[1] === inspection.ot);
      const moves = sheet.read('Movimientos Repuestos PA').filter(item => item[8] === inspection.ot);
      assert.deepEqual(moves.map(item => item[2]), ['Reserva', 'Salida', 'Devolución']);
      assert.equal(new Set(moves.map(item => item[19])).size, 1);
      assert.equal(JSON.parse(row[22]).decision, 'accepted');
      return { inspection: inspection.id, ot: inspection.ot, stockMovements: moves.length, shortage: '2',
        returnBlockedBeforeReinspection: true, hseBlockedReturn: blocked.folio,
        hseClearance: cleared.folio, returnedToOperations: true, width, isolated: true };
    } finally {
      sheet.restoreCheckpoint(baseline);
      fixture.releaseLoadAccounts([...actors, hse]);
      for (const key of fixture.evidence.keys()) if (!evidence.has(key)) fixture.evidence.delete(key);
      for (const key of fixture.photos.keys()) if (!photoKeys.has(key)) fixture.photos.delete(key);
    }
  });
}
