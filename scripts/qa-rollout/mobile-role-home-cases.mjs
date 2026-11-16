import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { loadAccounts, tabs } from './fixture.mjs';

const keyboardHeight = 320;

async function tappable(locator, width, message) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate(control => {
    const box = control.getBoundingClientRect();
    const viewport = window.visualViewport;
    const point = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      viewport: viewport?.height ?? innerHeight,
      controlHeight: box.height,
      fits: box.width > 0 && box.height >= 44 && box.left >= -1 && box.right <= innerWidth + 1
        && box.top >= (viewport?.offsetTop ?? 0) && box.bottom <= (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) + 1,
      hit: control === point || control.contains(point),
      layoutWidth: document.documentElement.scrollWidth,
    };
  });
  assert(result.fits && result.hit, message + ' ' + JSON.stringify(result));
  assert(result.layoutWidth <= width + 1, 'El contenido se desborda horizontalmente');
  return result.viewport;
}

async function editWithReducedViewport(page, width, input, value) {
  await input.focus();
  const toolbar = page.getByRole('navigation', { name: 'Navegación principal' });
  assert(await toolbar.isVisible(), 'El foco por sí solo no debe ocultar la navegación en la pantalla completa');
  await page.setViewportSize({ width, height: keyboardHeight });
  await input.fill(value);
  assert(await input.evaluate(control => document.activeElement === control), 'Se perdió el foco al activarse el teclado');
  await toolbar.waitFor({ state: 'hidden' });
  return tappable(input, width, 'El teclado simulado tapa el campo enfocado');
}

async function written(sheet, predicate) {
  const deadline = Date.now() + 7000;
  for (;;) {
    const order = sheet.read(tabs.orders).find(predicate);
    if (order) return order;
    if (Date.now() >= deadline) assert.fail('La OT no llegó al registro sintético');
    await pause(40);
  }
}

const qaAccounts = (role, index) => loadAccounts.filter(account => account.membership.role === role).at(-1 - index);
const panamaDate = () => new Intl.DateTimeFormat('es-PA', {
  timeZone: 'America/Panama', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date());

export async function checkMobileRoleHomes({ fixture, record, inRole, shot }) {
  const { sheet } = fixture;
  const original = [tabs.orders, tabs.failure, tabs.history].map(tab => [tab, sheet.read(tab)]);
  try {
    for (const [index, width] of [360, 390].entries()) {
      await record('MÓVIL-INICIO-OPERADOR-TECLADO-' + width, () => inRole('operador', width, async page => {
        const initial = page.viewportSize();
        const home = page.getByRole('button', { name: /^Reportar falla$/i });
        await tappable(home, width, 'Reportar falla debe estar al alcance desde el inicio');
        await home.tap();
        await page.waitForURL('**/falla');
        await page.getByRole('heading', { name: /Reportar falla/i }).waitFor();
        await page.getByLabel('Unidad', { exact: true }).selectOption('DZ203');
        await page.getByLabel('Tipo de Falla').selectOption({ label: 'Mecánica' });
        await page.getByRole('button', { name: 'Sí', exact: true }).tap();
        const description = 'QA inicio móvil operador ' + width;
        const editor = page.getByLabel('Descripción', { exact: true });
        const viewportHeight = await editWithReducedViewport(page, width, editor, description);
        await shot(page, 'inicio-operador-teclado-' + width + '.png');
        const send = page.getByRole('button', { name: /^Enviar reporte$/i });
        await tappable(send, width, 'Enviar reporte queda tapado debajo del área visible');
        await send.tap();
        const dialog = page.getByRole('dialog', { name: 'Confirmar reporte de falla' });
        const confirm = dialog.getByRole('button', { name: 'Confirmar', exact: true });
        await tappable(confirm, width, 'La confirmación del reporte queda tapada');
        await confirm.tap();
        const order = await written(sheet, row => row[5] === description);
        await page.getByText(/OT creada/i).first().waitFor();
        assert.equal(order[3], 'DZ203');
        await page.setViewportSize(initial);
        return { width, viewportWithKeyboard: viewportHeight, homeToTaskTaps: 1, folio: order[1],
          keyboard: 'área visible reducida en Chromium con foco real en el campo', actionTappable: true };
      }, qaAccounts('operador', index)));

      await record('MÓVIL-INICIO-MECÁNICO-TECLADO-' + width, async () => {
        const account = qaAccounts('mecanico', index);
        const orderId = 'OT-QA-C15-' + width;
        const description = 'QA inicio móvil técnico ' + width;
        const orders = sheet.read(tabs.orders);
        const order = ['inicial-qa-' + width, orderId, panamaDate(), 'DZ205', 'Avería', description,
          '', 'MEDIA', account.membership.user_name, 'En Reparación', '', '', '', '', '', '', '', account.user.id];
        sheet.seed(tabs.orders, [...orders, order]);
        try {
          return await inRole('mecanico', width, async page => {
            const initial = page.viewportSize();
            await page.getByRole('heading', { name: 'Hoy en Taller' }).waitFor();
            const sections = page.getByRole('navigation', { name: 'Secciones de Taller' });
            assert(await sections.evaluate(section => section.scrollWidth <= section.clientWidth + 1),
              'Los accesos de Taller requieren desplazamiento lateral');
            const open = page.getByRole('link', { name: new RegExp(orderId) });
            await tappable(open, width, 'La OT asignada debe estar al alcance desde el inicio');
            await open.tap();
            await page.waitForURL(url => url.pathname.endsWith('/workorders/' + orderId));
            const status = page.getByLabel('Estado', { exact: true });
            await status.selectOption({ label: 'Resuelta' });
            const checks = page.getByLabel('Resultado de la prueba funcional');
            await page.getByLabel('Horas reales de trabajo').fill('1.5');
            const proof = 'Verificación funcional sintética ' + width;
            const viewportHeight = await editWithReducedViewport(page, width, checks, proof);
            await shot(page, 'inicio-mecanico-teclado-' + width + '.png');
            const save = status.locator('..').getByRole('button', { name: 'Guardar', exact: true });
            await tappable(save, width, 'Guardar la ejecución queda tapado');
            await save.tap();
            await written(sheet, row => row[1] === orderId && row[9] === 'Resuelta');
            await page.getByText(proof, { exact: true }).waitFor();
            await page.setViewportSize(initial);
            return { width, viewportWithKeyboard: viewportHeight, homeToTaskTaps: 1, folio: orderId, state: 'Resuelta',
              keyboard: 'área visible reducida en Chromium con foco real en el campo', actionTappable: true };
          }, account);
        } finally { sheet.seed(tabs.orders, orders); }
      });
    }
  } finally {
    for (const [tab, rows] of original) sheet.seed(tab, rows);
  }
}
