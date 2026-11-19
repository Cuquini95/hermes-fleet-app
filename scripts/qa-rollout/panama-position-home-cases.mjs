import assert from 'node:assert/strict';
import { PANAMA_ROLE_HOME, PANAMA_ROLE_HOMES } from '../../src/data/panama-role-homes.js';

const cases = [
  [1, 'gerencia', '/dashboard', /^Hola/],
  [2, 'gerencia', '/admin/ordenes-compra?bandeja=aprobar', 'OC por aprobar', { can_approve_purchases: true }],
  [3, 'gerencia', '/panama/turnos?estado=aceptados', 'Relevo de turno'],
  [4, 'coordinador', '/panama/turnos', 'Relevo de turno'],
  [5, 'coordinador', '/gastos', 'Gastos'],
  [6, 'supervisor', '/fleet', 'Equipos'],
  [7, 'supervisor', '/flete', 'Registro de Flete'],
  [8, 'coordinador', '/panama/turnos', 'Relevo de turno'],
  [9, 'supervisor', '/panama/turnos?estado=por-revisar', 'Partes por revisar'],
  [10, 'gerencia', '/workorders', 'Órdenes de trabajo'],
  [11, 'jefe_taller', '/workshop?bandeja=repuestos', 'Solicitudes de Taller'],
  [12, 'coordinador', '/pm', 'Programa de Mantenimiento'],
  [13, 'coordinador', '/workorders?estado=Resuelta', 'Órdenes de trabajo'],
  [14, 'mecanico', '/workorders', 'Órdenes de Trabajo'],
  [15, 'coordinador', '/neumaticos', 'Neumáticos por número de fuego'],
  [16, 'gerencia', '/pedidos', 'Pedidos de Refacciones'],
  [17, 'almacen', '/inventory?bandeja=solicitudes', 'Inventario por almacén', { can_receive_purchases: true }],
  [19, 'gerencia', '/sticker-inspection', 'Inspecciones por revisar', { can_review_panama_hse: true }],
  [20, 'supervisor', '/sticker-inspection', 'Inspecciones por revisar', { can_review_panama_hse: true }],
  [21, 'gerencia', '/panama/cuentas-por-pagar', 'Cuentas por pagar'],
  [22, 'gerencia', '/panama/cuentas-por-pagar?bandeja=pagar#facturas', 'Cuentas por pagar', { can_record_purchase_payments: true }],
  [23, 'gerencia', '/panama/cuentas-por-pagar?bandeja=conciliar#facturas', 'Cuentas por pagar', { can_record_purchase_invoices: true }],
  [25, 'coordinador', '/panama/turnos?estado=aceptados', 'Relevo de turno'],
  [26, 'coordinador', '/perfil', 'Mi Perfil'],
  [27, 'operador', '/dvir', 'Inspección'],
  [28, 'operador', '/flete', 'Registro de Flete'],
].map(([number, role, path, destination, capabilities]) => ({
  position: 'TP-PER-' + String(number).padStart(3, '0'), role, path, destination, capabilities,
}));

export async function checkPanamaPositionHomes({ fixture, record, inRole, shot, noHorizontalOverflow }) {
  await record('MÓVIL-INICIOS-R06', async () => {
    assert.deepEqual(cases.map(item => item.position), Object.keys(PANAMA_ROLE_HOMES));
    const actors = fixture.registerPositionAccounts(cases);
    const positions = [];
    const failures = [];
    try {
      for (const [index, test] of cases.entries()) {
        const width = [320, 360, 390, 412][index % 4];
        try {
          await inRole(test.role, width, async (page) => {
            const title = PANAMA_ROLE_HOMES[test.position].title;
            const controls = page.getByRole('navigation', { name: 'Navegación principal' });
            await page.waitForURL(fixture.origin + PANAMA_ROLE_HOME);
            await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
            await page.getByText(/^TMF · Panamá/).waitFor();
            const brand = page.locator('.rescue-mobile-brand b');
            assert(await brand.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'GTP CMMS debe leerse completo.');
            assert.equal(await controls.getByRole('button', { name: 'Inicio', exact: true }).getAttribute('aria-current'), 'page');
            if (PANAMA_ROLE_HOMES[test.position].pending) {
              await page.getByText('Por conciliar', { exact: true }).waitFor();
            }
            if (test.position === 'TP-PER-026') await page.getByRole('region', { name: 'Estado técnico' }).waitFor();
            if (test.position === 'TP-PER-027') {
              const label = controls.getByRole('button', { name: 'Inspecciones', exact: true }).locator('span');
              assert.equal(await label.textContent(), 'Inspecciones');
              assert.equal(await label.evaluate(node => {
                const range = document.createRange();
                range.selectNodeContents(node);
                return range.getClientRects().length;
              }), 1);
            }
            const action = page.locator('[data-position-action]');
            assert.equal(await action.getAttribute('href'), test.path);
            assert((await action.boundingBox()).height >= 44, 'La primera acción debe ser táctil.');
            const label = (await action.locator('span > span').first().innerText()).trim();
            await noHorizontalOverflow(page, width);
            await shot(page, 'inicio-' + test.position.toLowerCase() + '.png');
            await action.click();
            await page.waitForURL(fixture.origin + test.path);
            const target = page.getByRole('heading', { name: test.destination, exact: true });
            await target.first().waitFor();
            const fullPage = /^\/panama(?:\/turnos)?(?:\?|$)/.test(test.path);
            if (fullPage) await page.getByRole('link', { name: 'Inicio', exact: true }).click();
            else await controls.getByRole('button', { name: 'Inicio', exact: true }).click();
            await page.waitForURL(fixture.origin + PANAMA_ROLE_HOME);
            if (test.position === 'TP-PER-016') {
              const denied = await page.request.post(fixture.origin + '/hermes-api/api/purchasing/order-status', {
                data: { status: 'Aprobada', folio: 'OC-QA' },
              });
              assert.equal(denied.status(), 403);
            }
            if (test.position === 'TP-PER-027') {
              await page.goto(fixture.origin + '/admin/ordenes-compra');
              await page.waitForURL(fixture.origin + PANAMA_ROLE_HOME);
              const denied = await page.request.get(fixture.origin + '/hermes-api/api/purchasing/receiving');
              assert.equal(denied.status(), 403);
            }
            positions.push({ code: test.position, role: test.role, title, label, destination: test.path, width });
          }, actors[index], '', true);
        } catch (error) {
          const selector = error.message.split('\n').find(line => line.includes('waiting for'));
          failures.push(test.position + ' · ' + error.message.split('\n')[0] + (selector ? ' · ' + selector.trim() : ''));
        }
      }
      assert.equal(failures.length, 0, failures.join('\n'));
      return { positions, accounts: 'ficticias', prohibitedActionsRejected: true };
    } finally {
      fixture.releaseLoadAccounts(actors);
    }
  });
}
