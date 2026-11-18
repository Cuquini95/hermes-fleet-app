import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function dimensions(page, width) {
  const observed = await page.evaluate(() => ({
    innerWidth, clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowX: getComputedStyle(document.documentElement).overflowX,
    bottomItems: document.querySelector('[aria-label="Navegación principal"]')?.querySelectorAll('button,a').length,
  }));
  assert.equal(observed.innerWidth, width, 'El viewport real no coincide con la prueba');
  assert(observed.scrollWidth <= width + 1, `${new URL(page.url()).pathname}: ${JSON.stringify(observed)}`);
  assert(!['hidden', 'clip'].includes(observed.overflowX), 'La página oculta el desbordamiento');
  assert(observed.bottomItems <= 5, 'Más de cinco destinos en la navegación');
  return observed;
}

export async function checkPanamaViewportMatrix({ fixture, record, inRole, shot, out }) {
  const cohort = fixture.registerLoadAccounts(28);
  const managers = cohort.filter(actor => actor.membership.role === 'gerencia' && actor.membership.can_approve_purchases);
  const warehouse = cohort.find(actor => actor.membership.can_receive_purchases);
  try { for (const [index, width] of [320, 360, 390, 412].entries()) {
    await record('MÓVIL-PANTALLAS-' + width, () => inRole('gerencia', width, async page => {
      const screens = [];
      for (const [label, path] of [
        ['inicio', '/dashboard'], ['equipos', '/fleet'], ['ordenes', '/workorders'],
        ['orden', '/workorders/OT-0004'], ['pm', '/pm'], ['almacen', '/inventory'], ['compras', '/pedidos'],
      ]) {
        await page.goto(fixture.origin + path, { waitUntil: 'domcontentloaded' });
        await page.locator('#main-content').getByRole('heading').first().waitFor({ state: 'visible' });
        if (label === 'equipos') await page.getByRole('button', { name: 'Ver detalle de DZ203', exact: true }).waitFor({ state: 'visible' });
        if (label === 'almacen') await page.getByRole('heading', { name: /^QA-001 ·/ }).first().waitFor({ state: 'visible' });
        if (label === 'pm') await page.getByText('DZ205', { exact: true }).first().waitFor({ state: 'visible' });
        screens.push({ screen: label, ...await dimensions(page, width) });
        await shot(page, `panama-${label}-${width}.png`);
        if (label === 'orden' && width === 320) {
          for (let repeat = 1; repeat <= 3; repeat++) {
            const [download] = await Promise.all([page.waitForEvent('download'),
              page.getByRole('button', { name: 'Descargar OT e historial', exact: true }).click()]);
            const target = resolve(out, `OT-0004-conectada-${repeat}.pdf`);
            await download.saveAs(target);
            const bytes = await readFile(target);
            assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
            assert(bytes.length > 1000);
          }
        }
        if (label === 'equipos') {
          await page.getByRole('button', { name: 'Ver detalle de DZ203', exact: true }).click();
          const detail = page.getByRole('dialog');
          await detail.waitFor({ state: 'visible' });
          screens.push({ screen: 'detalle-equipo', ...await dimensions(page, width) });
          await shot(page, `panama-equipo-${width}.png`);
          await page.keyboard.press('Escape');
        }
      }
      await page.getByRole('button', { name: /^Estado del servicio:/ }).click();
      const panel = page.getByRole('region', { name: 'Estado del servicio', exact: true });
      const bounds = await panel.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 64, 'El estado sale de pantalla');
      await shot(page, `panama-estado-${width}.png`);
      await page.keyboard.press('Escape');
      assert.equal(await panel.count(), 0, 'Escape no cierra el estado');
      await page.getByRole('button', { name: 'Opciones de la cuenta', exact: true }).click();
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).waitFor({ state: 'visible' });
      await dimensions(page, width);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.goto(fixture.origin + '/pm', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const enlarged = await dimensions(page, width);
      await shot(page, `panama-texto-ampliado-${width}.png`);
      return { width, screens, statusPanel: bounds, textEnlargement: { percent: 200, ...enlarged }, environment: 'Chromium aislado; fuentes e identidad sintéticas' };
    }, managers[index]));
    await record('MÓVIL-ALMACÉN-INICIO-' + width, () => inRole('jefe_taller', width, async page => {
      assert.equal(new URL(page.url()).pathname, '/panama/recepciones');
      const observed = await dimensions(page, width);
      await shot(page, `panama-recepciones-${width}.png`);
      return { width, ...observed, home: '/panama/recepciones', capability: 'canReceivePurchases' };
    }, warehouse, '', true));
  } } finally { fixture.releaseLoadAccounts(cohort); }
}

export async function checkConnectedPmPdfs({ fixture, record, inRole, out }) {
  const cohort = fixture.registerLoadAccounts(6);
  try { await record('MÓVIL-PDF-PM-250-1000-TRES-VECES', () => inRole('gerencia', 390, async page => {
    const downloads = [];
    try {
      for (const level of [250, 1000]) {
        fixture.setPrintablePmLevel(level);
        for (let repeat = 1; repeat <= 3; repeat++) {
          await page.goto(fixture.origin + '/pm', { waitUntil: 'domcontentloaded' });
          const button = page.getByRole('button', { name: 'Checklist PDF', exact: true });
          await button.waitFor({ state: 'visible' });
          const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
          assert.equal(download.suggestedFilename(), `EX401-PM-${level}h.pdf`);
          const filename = `PM-conectado-${level}-${repeat}.pdf`;
          await download.saveAs(resolve(out, filename));
          const bytes = await readFile(resolve(out, filename));
          assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
          downloads.push({ level, repeat, file: filename, bytes: bytes.length });
        }
      }
      return { downloads, expectedSerial: 'QA-EX401', approval: 'Borrador; aprobación pendiente', environment: 'Gateway y app reales con maestros sintéticos aislados' };
    } finally { fixture.setPrintablePmLevel(undefined); }
  }, cohort.find(actor => actor.membership.role === 'gerencia' && actor.membership.can_approve_purchases)));
  } finally { fixture.releaseLoadAccounts(cohort); }
}
