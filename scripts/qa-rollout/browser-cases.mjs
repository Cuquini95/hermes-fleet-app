import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { firstAccount, fixturePassword, loadAccounts, photoPng, roles, tabs } from './fixture.mjs';

const roleMenus = {
  operador: ['Reportar', '/falla'], mecanico: ['Órdenes', '/workorders'],
  jefe_taller: ['Órdenes', '/workorders'], coordinador: ['Órdenes', '/workorders'],
  supervisor: ['Equipos', '/fleet'], gerencia: ['Pedidos', '/pedidos'],
};

const clickByName = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' }).first().click();
const visible = locator => locator.first().waitFor({ state: 'visible' });
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await sleep(40);
  }
  throw new Error(message);
}

async function dismissPrivacy(page) {
  const dismiss = page.getByRole('button', { name: 'Cerrar aviso temporalmente' });
  if (await dismiss.isVisible()) await dismiss.click();
}

async function noHorizontalOverflow(page, width) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(scrollWidth <= width + 1, `Desplazamiento horizontal de ${scrollWidth - width}px en ${new URL(page.url()).pathname}`);
}

export async function checkBrowser(fixture, record, out, { withGateway, withPurchasing }) {
  const executablePath = process.env.HERMES_QA_CHROMIUM_EXECUTABLE
    ?? ['/usr/bin/chromium', '/tmp/chromium'].find(existsSync);
  const browser = await chromium.launch({
    executablePath, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-quic', '--disable-component-update', '--proxy-server=http://127.0.0.1:1', '--proxy-bypass-list=127.0.0.1'],
  });
  const { origin, sheet } = fixture;
  const external = new Set();
  const browserAccounts = new Map(Object.keys(roles).map(role => [role, loadAccounts.filter(account => account.membership.role === role).slice(1)]));
  const shot = (page, filename) => page.screenshot({ path: resolve(out, filename) });

  async function inRole(role, width, check, account = browserAccounts.get(role).shift()) {
    assert(account, `Falta una identidad de navegador para ${role}`);
    const context = await browser.newContext({
      viewport: { width, height: width === 360 ? 640 : 844 }, isMobile: true, hasTouch: true,
      serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'America/Mexico_City', locale: 'es-MX',
      ignoreHTTPSErrors: true,
    });
    try {
      await context.route('**/*', route => {
        const target = new URL(route.request().url());
        if (target.origin === origin) return route.continue();
        external.add(target.origin);
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Correo de trabajo').fill(account.user.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
      const login = page.waitForResponse(response => response.url() === `${origin}/api/auth/login` && response.request().method() === 'POST');
      await clickByName(page, 'Ingresar');
      assert.equal((await login).status(), 200, `El inicio de sesión de ${role} devolvió un error`);
      await page.waitForURL(origin + roles[role], { waitUntil: 'domcontentloaded' });
      await visible(page.getByRole('navigation', { name: 'Navegación principal' }));
      const consent = page.getByRole('button', { name: 'Aceptar y continuar', exact: true });
      await consent.click();
      return await check(page, context);
    } finally { await context.close(); }
  }

  async function readOrder(page, folio, description) {
    await page.goto(`${origin}/workorders`, { waitUntil: 'domcontentloaded' });
    await dismissPrivacy(page);
    await page.getByText(description, { exact: true }).first().click();
    await page.waitForURL(`${origin}/workorders/${encodeURIComponent(folio)}`);
    await visible(page.getByRole('heading', { name: folio, exact: true }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('heading', { name: folio, exact: true }));
  }

  async function changeOrderStatus(page, target, folio, isPM = false) {
    const option = page.locator('select').filter({ has: page.getByRole('option', { name: target, exact: true }) }).first();
    await option.selectOption({ label: target });
    if (target === 'Resuelta') {
      await page.getByLabel('Resultado de la prueba funcional').fill('Prueba funcional registrada en QA móvil');
      await page.getByLabel('Horas reales de trabajo').fill('2.25');
      if (isPM) {
        await page.getByLabel('Comprobación sintética de mantenimiento').check();
        await page.getByLabel('Horómetro de ejecución').fill('1975');
      }
    }
    await option.locator('..').getByRole('button', { name: 'Guardar', exact: true }).click();
    await waitUntil(() => sheet.read(tabs.orders).find(row => row[1] === folio && row[9] === target), `No persistió ${target}`);
  }

  async function todaySchedule(page, order) {
    await page.getByRole('button', { name: 'Programar OT', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Asignar trabajo' });
    await visible(dialog);
    await dialog.getByLabel('Orden de Trabajo').selectOption(order);
    await dialog.getByLabel('Horas estimadas').fill('1.5');
    const selectedDate = await dialog.getByLabel('Fecha programada').inputValue();
    const submit = dialog.getByRole('button', { name: 'Programar', exact: true });
    await submit.scrollIntoViewIfNeeded();
    await submit.tap();
    await dialog.waitFor({ state: 'hidden' });
    const date = await waitUntil(() => sheet.read(tabs.schedule).find(row => row[1] === selectedDate && row[2] === order), 'No persistió la programación');
    return date[1];
  }

  async function fillFailure(page, description, withPhoto, unit = 'DZ203') {
    await page.goto(`${origin}/falla`, { waitUntil: 'domcontentloaded' });
    await dismissPrivacy(page);
    const selects = page.locator('#main-content select');
    await selects.nth(0).selectOption(unit);
    await selects.nth(1).selectOption({ label: 'Mecánica' });
    await page.getByPlaceholder('Describe los síntomas observados...').fill(description);
    await clickByName(page, 'No');
    if (withPhoto) {
      await page.getByPlaceholder('Nombre del cliente afectado').fill('Cliente ficticio QA');
      await page.locator('input[type=file]').first().setInputFiles({ name: 'foto-sintetica.png', mimeType: 'image/png', buffer: photoPng });
    }
    await clickByName(page, /^Enviar reporte$/i);
    await visible(page.getByRole('heading', { name: 'Confirmar reporte de falla' }));
  }

  try {
    if (withGateway) await record('MÓVIL-GERENCIA-CONSULTA-SIN-LIBRO', () => inRole('gerencia', 390, async page => {
      const unavailable = [tabs.orders, tabs.failure, tabs.dvir, tabs.pmHistory, tabs.requests, tabs.parts, 'Combustible', 'Reporte_Fletes_Transporte'];
      const capturedAt = '2026-11-13T19:23:49Z';
      const master = {
        failures: [{ id: 'TMF-QA-1', unit: 'DZ203', description: 'Avería del maestro QA', order: 'OT-TMF-QA' }],
        orders: [{ id: 'OT-TMF-QA', unit: 'DZ203', description: 'Trabajo del maestro QA', status: 'ABIERTA' }],
        purchases: [{ id: 'COT-TMF-QA', unit: 'DZ203', description: 'Cotización del maestro QA', status: 'Entregada', amount: '85', currency: 'USD' }],
        maintenance: [{ unit: 'EX401', status: 'VENCIDO', next: 'PM 500', due: '2000', hours: '2210', remaining: '-210', reading: 'ATRASADA' }],
      };
      await page.route(/\/hermes-api\/api\/panama\/(summary|maintenance)(\?|$)/, async route => {
        const url = new URL(route.request().url());
        const keys = url.pathname.endsWith('/maintenance') ? ['maintenance'] : (url.searchParams.get('sections') ?? '').split(',');
        const sections = Object.fromEntries(keys.filter(key => Object.hasOwn(master, key)).map(key => [key, master[key]]));
        await route.fulfill({ json: { project: 'tmf-panama', sections, snapshots: Object.fromEntries(Object.keys(sections).map(key => [key, capturedAt])) } });
      });
      const readiness = /\/hermes-api\/api\/workshop\/readiness(\?|$)/;
      await page.route(readiness, route => route.fulfill({ json: { failures: [], stickers: [], inspections: [], returns: [], unavailable: ['failures', 'stickers', 'inspections', 'returns'] } }));
      sheet.setUnavailable(unavailable, true);
      try {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await clickByName(page, 'Briefing');
        await visible(page.getByText('210 h sobre límite', { exact: false }));
        await visible(page.getByText('Fuente de combustible no disponible.', { exact: true }));
        await visible(page.getByText('DESPACHO SIN VERIFICAR', { exact: true }));
        assert.equal(await page.getByText(/0 L diésel total|Sin anomalías detectadas/).count(), 0);
        await noHorizontalOverflow(page, 390);

        await page.goto(`${origin}/pedidos`);
        await visible(page.getByText('Cotización del maestro QA', { exact: true }));
        await visible(page.getByText(/Corte del/));
        assert.equal(await page.getByText('No hay pedidos registrados aún.').count(), 0);
        await noHorizontalOverflow(page, 390);

        await page.goto(`${origin}/workorders`);
        await visible(page.getByText('OT-TMF-QA', { exact: true }));
        await visible(page.getByText('Trabajo del maestro QA', { exact: true }));
        await noHorizontalOverflow(page, 390);

        await page.goto(`${origin}/data`);
        await visible(page.getByText('Avería del maestro QA', { exact: true }));
        await clickByName(page, /Fletes/);
        await visible(page.getByText('La fuente de datos no está disponible.', { exact: false }));
        assert.equal(await page.getByText('0 registros', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Exportar como CSV' }).isEnabled(), false);
        await noHorizontalOverflow(page, 390);
        return { pmVisible: true, orderVisible: true, purchaseVisible: true, failureVisible: true, unknownDataPreserved: true };
      } finally { sheet.setUnavailable(unavailable, false); }
    }, firstAccount('gerencia')));

    for (const width of [360, 390]) {
      for (const [role, [label, path]] of Object.entries(roleMenus)) {
        await record(`MÓVIL-${width}-${role}`, () => inRole(role, width, async page => {
          const nav = page.getByRole('navigation', { name: 'Navegación principal' });
          await nav.getByRole('button', { name: label, exact: true }).click();
          await page.waitForURL(origin + path);
          await noHorizontalOverflow(page, width);
          const admin = '/admin/ordenes-compra';
          await page.goto(origin + admin, { waitUntil: 'domcontentloaded' });
          await page.waitForURL(origin + (role === 'gerencia' ? admin : roles[role]));
          await visible(page.getByRole('navigation', { name: 'Navegación principal' }));
          return { role, width, firstRoute: path, directPurchaseRoute: role === 'gerencia' ? 'permitida' : 'restringida' };
        }));
      }
    }
    if (!withGateway) return [...external];

    await record('MÓVIL-TURNOS-ENTREGA-ACEPTACIÓN', async () => {
      const shiftTab = 'HERMES_PA_TURNOS';
      const folio = await inRole('operador', 360, async page => {
        await page.goto(`${origin}/panama`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: 'Relevo de turno', exact: true }).click();
        await visible(page.getByRole('heading', { name: 'Relevo de turno', exact: true }));
        await page.getByRole('combobox', { name: 'Unidad', exact: true }).selectOption('EX401');
        await page.getByLabel('Turno', { exact: true }).fill('Día QA');
        await page.getByLabel('Estado del equipo').fill('Operativo');
        await page.getByLabel('Horómetro inicial (h)').fill('5520');
        await page.getByLabel('Horómetro final (h)').fill('5518');
        await visible(page.getByText(/horómetro final es inferior/i));
        assert(await page.getByRole('button', { name: 'Entregar a Supervisión' }).isDisabled());
        await page.getByLabel('Horómetro final (h)').fill('5528');
        await page.getByLabel('Viajes', { exact: true }).fill('2');
        await page.getByLabel('Toneladas', { exact: true }).fill('30.5');
        await page.getByLabel('Cliente', { exact: true }).fill('Cliente sintético TMF');
        await page.getByLabel('Referencia del soporte').fill('PARTE-QA-TURNO');
        await page.getByLabel('Paradas o episodio de avería').fill('Sin paradas');
        await clickByName(page, 'Entregar a Supervisión');
        await visible(page.getByRole('status').filter({ hasText: 'Pendiente de revisión' }));
        const row = sheet.read(shiftTab).find(row => row[10] === 'PARTE-QA-TURNO');
        assert.equal(row[8], 8);
        assert.equal(row[5], 'Pendiente de revisión');
        await noHorizontalOverflow(page, 360);
        await shot(page, 'relevo-parte-360.png');
        return row[0];
      });
      await inRole('supervisor', 390, async page => {
        await page.goto(`${origin}/panama/turnos`, { waitUntil: 'domcontentloaded' });
        const part = page.getByRole('article').filter({ hasText: folio });
        await visible(part.getByText(/8 h del turno/));
        await part.getByRole('button', { name: 'Aceptar parte', exact: true }).click();
        await visible(part.getByText(/Aceptado por Supervisión/));
        await visible(part.getByText('Pendiente de conciliación en REGISTRO'));
        assert.equal(sheet.read(shiftTab).filter(row => row[0] === folio).at(-1)[20], 'accept');
        await noHorizontalOverflow(page, 390);
        await shot(page, 'relevo-aceptado-390.png');
      });
      return { folio, hours: 8, scopes: ['operador', 'supervisor'], officialReconciliation: 'pendiente' };
    });

    await record('MÓVIL-CAMPO-CONFIRMACIÓN', () => inRole('operador', 390, async page => {
      const fuelTab = 'Combustible';
      const tripTab = 'Reporte_Fletes_Transporte';
      await page.goto(`${origin}/diesel`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await page.locator('select').first().selectOption('EX401');
      await page.getByPlaceholder('0', { exact: true }).fill('125');
      await page.getByPlaceholder('Ej: 8450', { exact: true }).fill('5528');
      await page.getByPlaceholder('Observaciones adicionales...').fill('COMBUSTIBLE-QA-ESPERA');
      await clickByName(page, 'Registrar Combustible');
      sheet.failNext({ matches: writes => writes.some(write => write.tab === fuelTab), delay: 1000 });
      await clickByName(page, 'Confirmar');
      await sleep(200);
      assert.equal(await page.getByText('Combustible registrado en Hermes.').count(), 0);
      assert.equal(sheet.read(fuelTab).some(row => row[12] === 'COMBUSTIBLE-QA-ESPERA'), false);
      await visible(page.getByText('Combustible registrado en Hermes.'));
      assert.equal(sheet.read(fuelTab).filter(row => row[12] === 'COMBUSTIBLE-QA-ESPERA').length, 1);

      await page.goto(`${origin}/flete`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await page.locator('select').first().selectOption('DZ205');
      await page.getByPlaceholder('Ej: Frente 3', { exact: true }).fill('Frente QA');
      await page.getByPlaceholder('Ej: Patio de acopio', { exact: true }).fill('Patio QA');
      await page.getByPlaceholder('0', { exact: true }).nth(0).fill('8');
      await page.getByPlaceholder('0', { exact: true }).nth(1).fill('7');
      await page.getByPlaceholder('Ej: 24044 · 0031', { exact: true }).fill('FLETE-QA-ESPERA');
      await clickByName(page, 'Registrar Flete');
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tripTab), delay: 1000, when: 'before' });
      await clickByName(page, 'Confirmar');
      await sleep(200);
      assert.equal(await page.getByText('Flete registrado en Hermes.').count(), 0);
      await visible(page.getByText(/1 pendientes de sincronización/));
      assert.equal(sheet.read(tripTab).some(row => row[14] === 'FLETE-QA-ESPERA'), false);
      await noHorizontalOverflow(page, 390);
      return { fuelConfirmed: true, haulQueued: true, prematureConfirmation: false };
    }));

    let filed;
    await record('MÓVIL-TALLER-360-LENTO', () => inRole('operador', 360, async page => {
      const description = 'Falla sintética en conexión lenta';
      await fillFailure(page, description, false, 'EX401');
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.orders), delay: 1000 });
      await clickByName(page, 'Confirmar');
      await sleep(200);
      assert.equal(sheet.read(tabs.orders).find(row => row[5] === description), undefined);
      assert.equal(await page.getByText(/OT.*creada|reporte guardado/i).count(), 0, 'La app confirmó antes de guardar');
      const order = await waitUntil(() => sheet.read(tabs.orders).find(row => row[5] === description), 'No llegó la OT sintética');
      await visible(page.getByText(/OT creada/i));
      filed = { folio: order[1], description };
      assert.equal(sheet.read(tabs.failure).filter(row => row[13] === order[1]).length, 1);
      await noHorizontalOverflow(page, 360);
      await shot(page, 'falla-360.png');
      return { ...filed, linked: true, prematureConfirmation: false };
    }));

    await record('MÓVIL-TALLER-390-FOTO', () => inRole('operador', 390, async page => {
      const description = 'Falla sintética con una fotografía';
      await fillFailure(page, description, true);
      await clickByName(page, 'Confirmar');
      const row = await waitUntil(() => sheet.read(tabs.orders).find(item => item[5] === description), 'No se guardó la OT con foto');
      await visible(page.getByText(/OT creada/i));
      assert(/^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/.test(row[10] ?? ''), 'La OT no conservó la foto del fixture');
      assert.equal(sheet.read(tabs.failure).find(item => item[13] === row[1])?.[14], row[10]);
      await noHorizontalOverflow(page, 390);
      return { folio: row[1], photoLinked: true };
    }));

    await record('MÓVIL-TALLER-390-SIN-CONEXIÓN', () => inRole('operador', 390, async (page, context) => {
      const description = 'Falla sintética durante desconexión';
      await fillFailure(page, description, false);
      await context.setOffline(true);
      try {
        await clickByName(page, 'Confirmar');
        await sleep(300);
        assert.equal(sheet.read(tabs.orders).find(row => row[5] === description), undefined);
      } finally { await context.setOffline(false); }
      let order = sheet.read(tabs.orders).find(row => row[5] === description);
      if (!order) {
        const retry = page.getByRole('button', { name: /Reintentar/i }).first();
        if (await retry.isVisible()) await retry.click();
      }
      order = await waitUntil(() => sheet.read(tabs.orders).find(row => row[5] === description), 'La app no guardó el reporte al restablecer la conexión');
      assert.equal(sheet.read(tabs.orders).filter(row => row[5] === description).length, 1);
      assert.equal(sheet.read(tabs.failure).filter(row => row[13] === order[1]).length, 1);
      return { folio: order[1], linked: true };
    }));

    for (const role of ['coordinador', 'jefe_taller']) {
      await record(`MÓVIL-RECARGA-${role}`, () => inRole(role, 390, async page => {
        assert(filed, 'Falta la OT sintética para confirmar el recorrido entre roles');
        await visible(page.getByRole('heading', { name: role === 'coordinador' ? 'OTs Pendientes' : 'OTs por recibir', exact: true }));
        await visible(page.getByText(filed.folio, { exact: true }));
        await readOrder(page, filed.folio, filed.description);
        await noHorizontalOverflow(page, 390);
        await shot(page, `ot-${role}-390.png`);
        return { ...filed, role, reloaded: true };
      }));
    }

    let pmMobileFolio;
    await record('MÓVIL-PROGRAMA-PM-CALENDARIO', () => inRole('jefe_taller', 360, async page => {
      await page.goto(`${origin}/pm`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await visible(page.getByRole('heading', { name: 'Programa de Mantenimiento', exact: true }));
      await page.getByText('Nueva Orden PM', { exact: true }).tap();
      await page.waitForURL(`${origin}/pm-order`);
      await page.locator('fieldset select').first().selectOption('EX401');
      await page.getByRole('button', { name: /^PM[- ]?\d+$/ }).first().tap();
      await page.getByLabel('Mecánico (opcional)').selectOption(firstAccount('mecanico').user.id);
      const knownRows = sheet.read(tabs.pm).length;
      await clickByName(page, 'Activar Orden de PM');
      await clickByName(page, 'Confirmar');
      const saved = await waitUntil(() => sheet.read(tabs.pm).slice(knownRows).find(row => row[2] === 'EX401'), 'No se guardó la Orden de PM');
      const folio = saved[0];
      pmMobileFolio = folio;
      await page.getByRole('button', { name: 'Abrir Calendario', exact: true }).tap();
      await page.waitForURL(`${origin}/calendar`);
      await visible(page.getByRole('button', { name: new RegExp(folio) }));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await visible(page.getByRole('button', { name: new RegExp(folio) }));
      await noHorizontalOverflow(page, 360);
      return { folio, unit: 'EX401', reloaded: true };
    }));

    await record('MÓVIL-PM-ENTREGA-ACEPTACIÓN', async () => {
      assert(pmMobileFolio, 'Falta la OT de PM programada en el caso móvil');
      const path = `${origin}/workorders/${encodeURIComponent(pmMobileFolio)}`;
      await inRole('mecanico', 360, async page => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await visible(page.getByText('Comprobación sintética de mantenimiento', { exact: true }));
        await changeOrderStatus(page, 'En Reparación', pmMobileFolio);
        await changeOrderStatus(page, 'Resuelta', pmMobileFolio, true);
        await noHorizontalOverflow(page, 360);
      }, firstAccount('mecanico'));
      await inRole('jefe_taller', 390, async page => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await visible(page.getByText('Comprobación sintética de mantenimiento · Realizada', { exact: true }));
        await changeOrderStatus(page, 'Completado', pmMobileFolio);
        await visible(page.getByText(/Aceptación técnica de /));
        await shot(page, 'pm-aceptado-390.png');
      });
      const history = sheet.read(tabs.pmHistory).find(row => row[1] === pmMobileFolio);
      assert.deepEqual([history?.[6], history?.[10]], ['1975', 'Completada']);
      return { folio: pmMobileFolio, meter: history[6], synchronized: true };
    });

    await record('MÓVIL-TALLER-CIERRE-ENTRE-ROLES', async () => {
      assert(filed, 'Falta la OT sintética de conexión lenta');
      const { folio, description } = filed;
      const tech = firstAccount('mecanico');
      const path = `${origin}/workorders/${encodeURIComponent(folio)}`;
      await inRole('jefe_taller', 360, async page => {
        await readOrder(page, folio, description);
        await page.getByLabel('Mecánico asignado').selectOption(tech.user.id);
        await clickByName(page, 'Asignar');
        await waitUntil(() => sheet.read(tabs.orders).find(row => row[1] === folio && row[17] === tech.user.id), 'No persistió la asignación');
        await visible(page.getByRole('button', { name: 'Reasignar', exact: true }));
        await visible(page.locator('p').filter({ hasText: tech.membership.user_name }));
        const cost = page.locator('input[type=number][placeholder="0"]').first();
        await cost.fill('85.25');
        await cost.locator('..').getByRole('button', { name: 'Guardar', exact: true }).click();
        await waitUntil(() => sheet.read(tabs.orders).find(row => row[1] === folio && row[13] === '85.25'), 'No persistió el costo');
        await visible(page.getByText('$85.25', { exact: true }));
        await changeOrderStatus(page, 'En Reparación', folio);
      });
      await inRole('mecanico', 390, async page => {
        await readOrder(page, folio, description);
        assert.equal(await page.getByLabel('Mecánico asignado').count(), 0);
        await clickByName(page, '50%');
        await waitUntil(() => sheet.read(tabs.orders).find(row => row[1] === folio && row[16] === '50'), 'No persistió el avance');
        await visible(page.locator('p').filter({ hasText: /^50%$/ }));
        const upload = page.locator('input[type=file]').first();
        await upload.setInputFiles({ name: 'evidencia-mecanico.png', mimeType: 'image/png', buffer: photoPng });
        await clickByName(page, 'Guardar evidencia');
        await waitUntil(() => sheet.read(tabs.orders).find(row => row[1] === folio && /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/.test(row[10] ?? '')), 'No persistió la evidencia');
        await visible(page.getByRole('img', { name: 'Foto 1', exact: true }));
        await changeOrderStatus(page, 'Resuelta', folio);
        assert.equal(await page.getByRole('option', { name: 'Completado', exact: true }).count(), 0);
      }, tech);
      await inRole('jefe_taller', 390, async page => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('heading', { name: folio, exact: true }));
        await visible(page.getByText('50%', { exact: true }));
        await changeOrderStatus(page, 'Completado', folio);
      });
      return inRole('supervisor', 390, async page => {
        await page.goto(`${origin}/fleet`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: `EX401 · ${folio}`, exact: true }).click();
        await visible(page.getByRole('heading', { name: folio, exact: true }));
        await visible(page.getByText('Completado', { exact: true }));
        await page.getByLabel('Observación de Operaciones').fill('Recepción sintética por Operaciones');
        await clickByName(page, 'Confirmar retorno ahora');
        await visible(page.getByText(/Equipo recibido por /));
        const row = sheet.read(tabs.orders).find(order => order[1] === folio);
        assert(row[14] && /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/.test(row[10] ?? ''));
        assert.equal(JSON.parse(row[20]).laborHours, 2.25);
        await visible(page.getByText('2.25 h de trabajo registradas', { exact: true }));
        assert.equal(sheet.read(tabs.failure).find(item => item[13] === folio)?.[9], 'Completado');
        await shot(page, 'ot-cerrada-supervisor-390.png');
        return { folio, closedAt: row[14], returnedAt: JSON.parse(row[22]).returnedAt, progress: 50, cost: 85.25, laborHours: 2.25, evidenceLinked: true };
      });
    });

    for (const width of [360, 390]) {
      await record(`MÓVIL-${width}-CALENDARIO`, () => inRole('jefe_taller', width, async page => {
        const row = sheet.read(tabs.orders).find(item => item[5] === 'Falla sintética con una fotografía');
        assert(row, 'Falta la OT sintética con foto para programar');
        const folio = row[1];
        await page.goto(`${origin}/calendar`, { waitUntil: 'domcontentloaded' });
        await dismissPrivacy(page);
        const date = await todaySchedule(page, folio);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('button', { name: new RegExp(folio) }));
        await noHorizontalOverflow(page, width);
        assert.equal(sheet.read(tabs.schedule).filter(item => item[2] === folio).length, 1);
        await shot(page, `calendario-${width}.png`);
        return { folio, date, width, visibleAfterReload: true };
      }));
    }

    await record('MÓVIL-FLOTA-BLOQUEOS', () => inRole('supervisor', 390, async page => {
      await page.goto(`${origin}/fleet`, { waitUntil: 'domcontentloaded' });
      await visible(page.getByText(/\d\/4 aptos para despacho/));
      const tile = unit => page.getByRole('button', { name: `Ver detalle de ${unit}`, exact: true });
      await visible(tile('DZ203').getByText('Bloq.', { exact: true }));
      await visible(tile('DZ205').getByText('Bloq.', { exact: true }));
      await tile('DZ203').tap();
      await visible(page.getByText('No despachar', { exact: true }));
      await noHorizontalOverflow(page, 390);
      await shot(page, 'flota-bloqueada-390.png');
      return { blockedUnits: ['DZ203', 'DZ205'], reasons: ['sticker rojo', 'DVIR reprobado'] };
    }));

    await record('MÓVIL-DVIR-REPROBADO-OT', async () => {
      const note = 'DVIR QA de móvil con frenos reprobados';
      const result = await inRole('operador', 360, async page => {
        await page.goto(`${origin}/dvir`, { waitUntil: 'domcontentloaded' });
        await page.locator('#main-content select').first().selectOption('DZ205');
        await page.getByPlaceholder('Ej: 3240').fill('391');
        const ok = page.getByRole('button', { name: 'OK', exact: true });
        const fail = page.getByRole('button', { name: 'Falla', exact: true });
        assert.equal(await ok.count(), 12);
        for (let index = 0; index < 12; index++) await (index === 2 ? fail : ok).nth(index).click();
        await page.getByPlaceholder('Describe el problema...').fill('Hallazgo de freno sintético');
        await page.getByPlaceholder('Observaciones adicionales...').fill(note);
        await page.locator('input[type=file]:not([capture])').first().setInputFiles({ name: 'dvir-sintetico.png', mimeType: 'image/png', buffer: photoPng });
        await clickByName(page, 'Enviar Inspección');
        await clickByName(page, 'Confirmar');
        await visible(page.getByText(/Inspección registrada\. OT creada/));
        const row = sheet.read(tabs.dvir).find(item => item[23]?.includes(note));
        assert(row && row[22] === 'reprobado' && row[25] && /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/.test(row[24] ?? ''));
        assert.equal(sheet.read(tabs.failure).filter(item => item[13] === row[25]).length, 1);
        await noHorizontalOverflow(page, 360);
        await shot(page, 'dvir-ot-360.png');
        await page.goto(`${origin}/perfil`, { waitUntil: 'domcontentloaded' });
        await clickByName(page, /Historial de mis acciones/);
        const evidence = page.getByRole('link', { name: 'Ver evidencia 1' }).filter({ visible: true });
        await visible(evidence);
        assert((await evidence.evaluateAll(links => links.map(link => link.getAttribute('href')))).includes(row[24]));
        const photo = await page.request.get(origin + row[24]);
        assert.equal(photo.status(), 200);
        assert.deepEqual(await photo.body(), photoPng);
        return { inspection: row[1], folio: row[25], ownerEvidence: true };
      });
      return inRole('coordinador', 390, async page => {
        await visible(page.getByText(result.folio, { exact: true }));
        await page.getByText(result.folio, { exact: true }).first().click();
        await visible(page.getByRole('heading', { name: result.folio, exact: true }));
        return { ...result, visibleForCoordinator: true };
      });
    });

    await record('MÓVIL-STICKER-REVISIÓN', async () => {
      const folio = await inRole('operador', 360, async page => {
        await page.goto(`${origin}/sticker-inspection`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Unidad / NFC / QR').selectOption('EX401');
        const equipmentType = page.getByLabel('Tipo de equipo');
        assert.equal(await equipmentType.inputValue(), 'tractor_oruga');
        assert.equal(await equipmentType.isEnabled(), false);
        await page.getByLabel('Empresa', { exact: true }).fill('Hermes QA');
        const answers = page.getByRole('button', { name: 'Cumple', exact: true });
        const count = await answers.count();
        assert(count > 0);
        for (let index = 0; index < count; index++) await answers.nth(index).click();
        await clickByName(page, 'Guardar para revisión');
        const pending = await waitUntil(() => sheet.read(tabs.sticker).find(row => row[5] === 'EX401'), 'No se guardó el Sticker móvil');
        assert.deepEqual([pending[10], pending[13]], ['pendiente_supervisor', 'no']);
        assert.equal(await page.getByRole('button', { name: 'Imprimir / guardar sticker', exact: true }).count(), 0);
        await noHorizontalOverflow(page, 360);
        return pending[1];
      });
      return inRole('supervisor', 390, async page => {
        await page.goto(`${origin}/sticker-inspection`, { waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('heading', { name: 'Inspecciones por revisar', exact: true }));
        await page.locator('summary').filter({ hasText: folio }).tap();
        await clickByName(page, 'Aprobar revisión');
        await visible(page.getByRole('button', { name: 'Imprimir / guardar sticker', exact: true }));
        const approved = sheet.read(tabs.sticker).find(row => row[1] === folio);
        assert.deepEqual([approved[10], approved[13]], ['aprobado_supervisor', 'yes']);
        assert(approved[18] && approved[19] && approved[18] !== approved[19]);
        await shot(page, 'sticker-aprobado-390.png');
        return { folio, unit: 'EX401', approved: true, canDispatch: true };
      }, firstAccount('supervisor'));
    });

    if (!withPurchasing) return [...external];
    const browserBuyer = loadAccounts.find(account => account.membership.can_approve_purchases === true);
    const browserWarehouse = loadAccounts.find(account => account.membership.can_receive_purchases === true);

    await record('MÓVIL-GERENCIA-DASHBOARD-FUENTE', () => inRole('gerencia', 390, async page => {
      const average = page.getByText('125.00 L/carga', { exact: true });
      await visible(average);
      const activeCriticalOrders = sheet.read(tabs.orders).filter(row => row[7] === 'CRITICA' && row[9] !== 'Completado').length;
      const ordersCard = page.getByText('OTs Críticas', { exact: true }).locator('xpath=..');
      await visible(ordersCard.getByText(String(activeCriticalOrders), { exact: true }));
      const sources = [tabs.orders, tabs.failure, 'Combustible'];
      try {
        sheet.setUnavailable(sources, true);
        await clickByName(page, 'Actualizar datos');
        await visible(page.getByRole('alert').getByText('Algunos indicadores no se pudieron cargar.', { exact: true }).or(page.getByText('Algunos indicadores no se pudieron cargar.', { exact: true })));
        await visible(ordersCard.getByText('—', { exact: true }));
        await visible(page.getByText('Aptos para despacho', { exact: true }).locator('xpath=..').getByText('Sin verificar', { exact: true }));
      } finally { sheet.setUnavailable(sources, false); }
      await clickByName(page, 'Actualizar datos');
      await visible(average);
      await noHorizontalOverflow(page, 390);
      return { averageLitersPerLoad: 125, activeCriticalOrders, failureVisible: true, refreshed: true };
    }));

    await record('MÓVIL-PARTES-CATÁLOGO', () => inRole('mecanico', 390, async page => {
      const nav = page.getByRole('navigation', { name: 'Navegación principal' });
      await nav.getByRole('button', { name: 'Partes', exact: true }).click();
      await page.waitForURL(origin + '/parts');
      await page.getByLabel('Buscar repuesto').fill('OEM-QA-001');
      await visible(page.getByText('QA-001', { exact: true }));
      await visible(page.getByText(/Filtro hidráulico de prueba/i));
      await noHorizontalOverflow(page, 390);
      return { sku: 'QA-001', oem: 'OEM-QA-001' };
    }));

    await record('MÓVIL-PEDIDO-CATÁLOGO-MANUAL-OC', async () => {
      const lines = await inRole('jefe_taller', 390, async page => {
        await page.goto(`${origin}/parts`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Buscar repuesto').fill('OEM-QA-002');
        await clickByName(page, 'Agregar al Pedido');
        await page.goto(`${origin}/pedidos`, { waitUntil: 'domcontentloaded' });
        await clickByName(page, 'Editar partida QA-002');
        await page.getByLabel('Unidad QA-002').selectOption('DZ203');
        await page.getByLabel('Unidad QA-002').selectOption('EX401');
        await page.getByLabel('Cantidad QA-002').fill('4');
        await clickByName(page, 'Agregar parte manual');
        await page.getByLabel('Número de parte manual').fill('MANUAL-UI-QA');
        await page.getByLabel('Descripción manual').fill('Empaque manual desde móvil');
        await page.getByLabel('Unidad manual').selectOption('EX401');
        await page.getByLabel('Cantidad manual').fill('3');
        await clickByName(page, 'Agregar al carrito');
        await clickByName(page, 'Enviar Pedido (2 partes)');
        await visible(page.getByRole('heading', { name: 'Pedido Enviado' }));
        const manual = sheet.read(tabs.requests).find(row => row[1] === 'MANUAL-UI-QA');
        assert(manual);
        const rows = sheet.read(tabs.requests).filter(row => row[9] === manual[9]);
        const catalog = rows.find(row => row[1] === 'QA-002');
        assert.deepEqual([catalog[3], catalog[4], manual[3], manual[4], manual[5]], ['EX401', '4', 'EX401', '3', 'Manual']);
        await noHorizontalOverflow(page, 390);
        return { catalog, manual };
      });
      return inRole('gerencia', 390, async page => {
        await page.locator('#main-content').getByRole('button', { name: 'Pedidos', exact: true }).first().tap();
        await page.waitForURL(`${origin}/pedidos`);
        await visible(page.getByRole('button', { name: 'Pedidos Pendientes', exact: true }));
        await page.getByText('MANUAL-UI-QA', { exact: true }).locator('xpath=../..').getByRole('link', { name: 'Convertir a OC', exact: true }).tap();
        const form = page.locator('form').first();
        await form.getByLabel('Vincular partida del pedido').selectOption(lines.catalog[15]);
        await form.getByLabel('Proveedor', { exact: true }).selectOption({ label: 'Proveedor QA' });
        await form.getByLabel('ITBMS según documento').fill('0');
        await form.getByRole('button', { name: 'Guardar orden', exact: true }).tap();
        const linked = await waitUntil(() => sheet.read(tabs.requests).find(row => row[15] === lines.manual[15] && row[16]), 'La OC no se vinculó al pedido');
        const folio = linked[16];
        assert.equal(sheet.read(tabs.lines).filter(row => row[0] === folio && row[7] === lines.manual[9]).length, 2);
        await page.goto(`${origin}/pedidos`, { waitUntil: 'domcontentloaded' });
        await clickByName(page, 'Historial');
        await visible(page.getByRole('link', { name: `Ver OC ${folio}`, exact: true }));
        await shot(page, 'pedido-vinculado-390.png');
        return { request: lines.manual[9], purchaseOrder: folio, lines: 2, historyLink: true };
      });
    });

    let purchaseFolio;
    await record('MÓVIL-COMPRAS-CREAR-APROBAR-PDF', () => inRole('gerencia', 390, async page => {
      await page.goto(`${origin}/admin/ordenes-compra`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      const form = page.locator('form').first();
      await form.getByLabel('Entidad emisora').selectOption('TP_PA_QA');
      await form.getByLabel('Proveedor', { exact: true }).selectOption({ label: 'Proveedor QA' });
      await form.getByLabel('Unidad', { exact: true }).fill('DZ203');
      await form.getByLabel('Fecha de la orden').fill('2026-11-12');
      await form.getByLabel('Fecha de entrega').fill('2026-11-14');
      const parts = [['Filtro OC móvil QA', '2', '123.45'], ['Sello OC móvil QA', '3', '45.67'], ['Tornillo OC móvil QA', '5', '9.89']];
      for (const [index, [name, quantity, price]] of parts.entries()) {
        if (index) await form.getByRole('button', { name: 'Agregar partida', exact: true }).click();
        await form.getByLabel(`Descripción ${index + 1}`, { exact: true }).fill(name);
        await form.getByLabel(`Cantidad ${index + 1}`, { exact: true }).fill(quantity);
        await form.getByLabel(`Precio unitario ${index + 1}`, { exact: true }).fill(price);
      }
      await form.getByLabel('Envío', { exact: true }).fill('25.50');
      await form.getByLabel('Otros cargos', { exact: true }).fill('8.75');
      assert.equal(await form.getByRole('button', { name: 'Guardar orden', exact: true }).isDisabled(), true);
      await form.getByLabel('ITBMS según documento').fill('30.34');
      await visible(form.getByText(/497[.,]95/));
      await noHorizontalOverflow(page, 390);
      await form.getByRole('button', { name: 'Guardar orden', exact: true }).tap();
      const firstLine = await waitUntil(() => sheet.read(tabs.lines).find(row => row[2] === parts[0][0]), 'No se guardó la OC desde el formulario');
      const folio = firstLine[0];
      purchaseFolio = folio;
      const card = page.locator('article').filter({ hasText: folio });
      await visible(card.getByText(/· Borrador ·/));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await card.getByRole('button', { name: 'Aprobar', exact: true }).tap();
      await card.getByLabel('Soporte de la aprobación Q25').fill('Requisición validada en QA');
      await card.getByRole('button', { name: 'Confirmar aprobación', exact: true }).tap();
      await visible(card.getByText(/· Aprobada ·/));
      const header = sheet.read(tabs.purchases).find(row => row[0] === folio);
      assert.deepEqual(header.slice(6, 12), ['433.36', '30.34', '25.50', '8.75', '497.95', 'Aprobada']);
      await card.getByRole('link', { name: 'Ver / Imprimir', exact: true }).tap();
      await visible(page.locator('.po-document'));
      const rendered = await page.locator('.po-document').innerText();
      assert(rendered.includes('Proveedor QA') && rendered.includes('DZ203') && rendered.includes(folio));
      assert.match(rendered, /Trans Plus Panamá/i);
      assert.match(rendered, /497[.,]95/);
      assert.match(rendered, /14[/-]11[/-]2026|2026-11-14/);
      assert.match(rendered, /QA gerencia/);
      const artifact = 'Hermes_OC_QA.pdf';
      const pdfPath = resolve(out, artifact);
      await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
      const printed = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
      assert.match(printed, /497[.,]95/);
      assert(printed.includes(folio) && printed.includes(parts[2][0]));
      assert.match(execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' }), /^Pages:\s+1$/m);
      return { folio, unit: 'DZ203', amount: 497.95, artifact, pages: 1 };
    }, browserBuyer));

    await record('MÓVIL-COMPRAS-RECEPCIONES-PARCIALES', () => inRole('jefe_taller', 390, async page => {
      assert(purchaseFolio, 'Falta la OC sintética creada en móvil');
      await page.goto(`${origin}/panama/recepciones`, { waitUntil: 'domcontentloaded' });
      const card = page.locator('article').filter({ hasText: purchaseFolio });
      const line = card.locator('li').filter({ has: page.getByRole('heading', { name: /Filtro OC móvil QA/ }) });
      const lineId = sheet.read(tabs.lines).find(row => row[0] === purchaseFolio && row[1] === '1')[6];
      const receive = async (quantity, reference, balance) => {
        await line.getByRole('button', { name: 'Recibir partida' }).tap();
        await line.getByLabel('Cantidad recibida').fill(quantity);
        await line.getByLabel('Referencia o remisión').fill(reference);
        await line.getByRole('button', { name: 'Registrar recepción', exact: true }).tap();
        await visible(line.getByText('Pendientes ' + balance, { exact: true }));
      };
      await receive('0.75', 'Entrega QA A', '1.25');
      await receive('1.25', 'Entrega QA B', '0');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await visible(card.getByText(/Entrega QA A/));
      await visible(card.getByText(/Entrega QA B/));
      await visible(card.getByText('Recibida parcial', { exact: true }));
      const item = sheet.read(tabs.lines).find(row => row[6] === lineId);
      assert.equal(JSON.parse(item[11]).length, 2);
      await noHorizontalOverflow(page, 390);
      await shot(page, 'oc-recepcion-parcial-390.png');
      return { folio: purchaseFolio, received: 2, remainingOnLine: 0, receipts: 2, orderStatus: 'Recibida parcial' };
    }, browserWarehouse));

    await record('MÓVIL-GASTOS-RECIBO-REPARTO', () => inRole('jefe_taller', 390, async page => {
      await page.goto(`${origin}/gastos`, { waitUntil: 'domcontentloaded' });
      await clickByName(page, 'Nuevo');
      await visible(page.getByRole('heading', { name: 'Nuevo Gasto', exact: true }));
      await page.locator('input[type=file][accept="image/*,application/pdf"]').setInputFiles({ name: 'recibo-sintetico.png', mimeType: 'image/png', buffer: photoPng });
      await visible(page.getByText(/Datos extraídos/));
      assert.equal(await page.getByPlaceholder('A-04821').inputValue(), 'FAC-QA-MOVIL');
      const entity = page.getByRole('combobox', { name: 'Entidad y moneda', exact: true });
      await entity.selectOption('TP_PA_QA');
      await clickByName(page, 'Múltiples · Flota');
      const unitPicker = page.locator('select').filter({ has: page.locator('option').filter({ hasText: 'Agregar unidad' }) });
      await unitPicker.selectOption('DZ203');
      await unitPicker.selectOption('EX401');
      const allocations = page.locator('input.w-24[type=number]');
      await allocations.nth(0).fill('83.52');
      await allocations.nth(1).fill('55.68');
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.expenses), when: 'after' });
      await clickByName(page, 'Registrar 2 gastos');
      const retry = page.getByRole('button', { name: 'Reintentar registro', exact: true });
      await visible(retry);
      assert.equal(await entity.isDisabled(), true);
      assert.equal(await allocations.nth(0).isDisabled(), true);
      const pending = sheet.read(tabs.expenses).filter(row => row[6] === 'FAC-QA-MOVIL');
      assert.equal(pending.length, 2);
      await retry.tap();
      await visible(page.getByText('2 repartos registrados para revisión', { exact: true }));
      const saved = sheet.read(tabs.expenses).filter(row => row[6] === 'FAC-QA-MOVIL');
      assert.deepEqual(saved, pending);
      assert.deepEqual(saved.map(row => [row[10], row[9]]), [['DZ203', '83.52'], ['EX401', '55.68']]);
      assert(saved.every(row => /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/.test(row[15])));
      assert(saved.every(row => row[16] === 'Pendiente'));
      await noHorizontalOverflow(page, 390);
      return { folio: saved[0][17], total: 139.2, units: saved.map(row => row[10]), ocr: 'simulado', review: 'pendiente' };
    }));

    await record('MÓVIL-GASTOS-MES-PDF', () => inRole('gerencia', 390, async page => {
      await page.goto(`${origin}/gastos`, { waitUntil: 'domcontentloaded' });
      await clickByName(page, 'Detalle');
      await visible(page.getByRole('link', { name: 'Abrir recibo' }));
      assert.equal(await page.getByText('Proveedor QA mes anterior', { exact: true }).count(), 0);
      await clickByName(page, 'Mes anterior');
      await visible(page.getByText('Proveedor QA mes anterior', { exact: true }));
      assert.equal(await page.getByRole('link', { name: 'Abrir recibo' }).count(), 0);
      await clickByName(page, 'Resumen');
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 7000 }),
        clickByName(page, /^Descargar PDF/),
      ]);
      const artifact = 'Hermes_Gastos_QA.pdf';
      const target = resolve(out, artifact);
      await download.saveAs(target);
      const printed = execFileSync('pdftotext', [target, '-'], { encoding: 'utf8' });
      assert.match(printed, /116[.,]29/);
      assert.doesNotMatch(printed, /139[.,]20|83[.,]52|55[.,]68/);
      await noHorizontalOverflow(page, 390);
      return { period: 'mes anterior', priorExpense: 116.29, artifact, excludesCurrentMonth: true };
    }));
    return [...external];
  } finally { await browser.close(); }
}
