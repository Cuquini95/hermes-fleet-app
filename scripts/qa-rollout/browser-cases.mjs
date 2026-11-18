import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { firstAccount, fixturePassword, loadAccounts, photoPng, roles, tabs } from './fixture.mjs';
import { checkMobileRoleHomes } from './mobile-role-home-cases.mjs';
import { checkShiftRegister } from './shift-register-browser.mjs';
import { checkConnectedPmPdfs, checkPanamaViewportMatrix } from './panama-viewport-cases.mjs';

const roleMenus = {
  operador: ['Reportar', '/falla'], mecanico: ['Órdenes', '/workorders'],
  jefe_taller: ['Órdenes', '/workorders'], coordinador: ['Órdenes', '/workorders'],
  supervisor: ['Equipos', '/fleet'], gerencia: ['Pedidos', '/pedidos'],
};

const clickByName = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' }).first().click();
const visible = locator => locator.first().waitFor({ state: 'visible' });
const orderHeading = folio => /^OT-\d{4,15}$/.test(folio) ? folio : 'Orden de trabajo';
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

export async function checkBrowser(fixture, record, out, { withGateway, withPurchasing, focusedPanama = false }) {
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

  async function inRole(role, width, check, account = browserAccounts.get(role).shift(), entryPath = '', useActualHome = false) {
    assert(account, `Falta una identidad de navegador para ${role}`);
    const context = await browser.newContext({
      viewport: { width, height: width === 360 ? 640 : 844 }, isMobile: true, hasTouch: true,
      serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'America/Panama', locale: 'es-PA',
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
      await page.goto(origin + (entryPath || '/login'), { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Correo de trabajo').fill(account.user.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
      const [login] = await Promise.all([
        page.waitForResponse(response => response.url() === `${origin}/api/auth/login` && response.request().method() === 'POST'),
        clickByName(page, 'Ingresar'),
      ]);
      assert.equal(login.status(), 200, `El inicio de sesión de ${role} devolvió un error`);
      if (entryPath) {
        await page.waitForURL(origin + entryPath, { waitUntil: 'domcontentloaded' });
      } else {
        await page.waitForURL(url => url.origin === origin && url.pathname !== '/login', { waitUntil: 'domcontentloaded' });
        if (!useActualHome && page.url() !== origin + roles[role]) {
          await page.goto(origin + roles[role], { waitUntil: 'domcontentloaded' });
        }
      }
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
    await visible(page.getByRole('heading', { name: orderHeading(folio), exact: true }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('heading', { name: orderHeading(folio), exact: true }));
  }

  async function changeOrderStatus(page, target, folio, isPM = false, diagnosis) {
    const option = page.locator('select').filter({ has: page.getByRole('option', { name: target, exact: true }) }).first();
    await option.selectOption({ label: target });
    if (target === 'Resuelta') {
      await page.getByLabel('Resultado de la prueba funcional').fill('Prueba funcional registrada en QA móvil');
      await page.getByLabel('Horas reales de trabajo').fill('2.25');
      if (diagnosis) await page.getByLabel('Causa confirmada (si se identificó)').fill(diagnosis);
      if (isPM) {
        await page.getByRole('checkbox', { name: 'Comprobación sintética de mantenimiento' }).check();
        await page.getByLabel('Horómetro de ejecución').fill('1975');
        assert.equal(await option.locator('..').getByRole('button', { name: 'Guardar', exact: true }).isDisabled(), true);
        await page.getByLabel('Foto de evidencia · Comprobación sintética de mantenimiento')
          .setInputFiles({ name: 'pm-qa.png', mimeType: 'image/png', buffer: photoPng });
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
    await dialog.getByLabel('Turno').selectOption('Día');
    await dialog.getByLabel('Disponibilidad de repuestos').selectOption('not_required');
    const selectedDate = await dialog.getByLabel('Fecha programada').inputValue();
    const submit = dialog.getByRole('button', { name: 'Programar', exact: true });
    await submit.scrollIntoViewIfNeeded();
    await submit.tap();
    await dialog.waitFor({ state: 'hidden' });
    const date = await waitUntil(() => sheet.read(tabs.schedule).find(row => row[1] === selectedDate && row[2] === order), 'No persistió la programación');
    return date[1];
  }

  async function fillFailure(page, description, withPhoto, unit = 'DZ203', previousOtId, stopStartedAt) {
    await page.goto(`${origin}/falla`, { waitUntil: 'domcontentloaded' });
    await dismissPrivacy(page);
    const selects = page.locator('#main-content select');
    await selects.nth(0).selectOption(unit);
    await selects.nth(1).selectOption({ label: 'Mecánica' });
    await page.getByPlaceholder('Describe los síntomas observados...').fill(description);
    if (previousOtId) {
      await page.locator('summary').filter({ hasText: 'Más detalles (opcional)' }).click();
      await page.getByLabel('OT anterior si la falla se repitió').fill(previousOtId);
      await page.getByLabel('Tiempo de paro estimado').selectOption('1-4 horas');
    }
    await clickByName(page, 'No');
    if (stopStartedAt) await page.getByLabel('Inicio de parada · hora de Panamá').fill(stopStartedAt);
    if (withPhoto) {
      await page.getByLabel('Cliente afectado').fill('Cliente ficticio QA');
      await page.locator('input[type=file]').first().setInputFiles({ name: 'foto-sintetica.png', mimeType: 'image/png', buffer: photoPng });
    }
    await clickByName(page, /^Enviar reporte$/i);
    await visible(page.getByRole('heading', { name: 'Confirmar reporte de falla' }));
  }

  try {
    if (withGateway) await record('MÓVIL-DVIR-FOTOS-APROBADAS', async () => {
      const saved = [];
      const baseline = sheet.checkpoint();
      const photoKeys = new Set(fixture.photos.keys());
      const evidenceKeys = new Set(fixture.evidence.keys());
      const photo = name => ({ name, mimeType: 'image/png', buffer: photoPng });
      try {
        for (const [width, type, label] of [[320, 'pre-operacion', 'Pre-Operación'], [390, 'post-operacion', 'Post-Operación']]) {
          const links = await inRole('operador', width, async page => {
            await page.goto(origin + '/dvir', { waitUntil: 'domcontentloaded' });
            const section = page.getByRole('region', { name: 'Fotos de la inspección' });
            const [camera] = await Promise.all([page.waitForEvent('filechooser'), clickByName(page, 'Tomar foto')]);
            assert.equal(await camera.element().getAttribute('capture'), 'environment');
            await camera.setFiles(photo('frente.png'));
            const [gallery] = await Promise.all([page.waitForEvent('filechooser'), clickByName(page, 'Galería')]);
            assert.equal(gallery.isMultiple(), true);
            await gallery.setFiles([photo('costado.png'), photo('serie.png')]);
            await visible(section.getByRole('img', { name: 'Foto 3' }));
            await section.getByRole('button', { name: 'Eliminar foto' }).nth(1).click();
            assert.equal(await section.getByRole('img').count(), 2);
            await page.locator('#main-content select').first().selectOption('DZ203');
            await clickByName(page, label);
            await noHorizontalOverflow(page, width);
            await section.scrollIntoViewIfNeeded();
            await shot(page, `dvir-fotos-${width}.png`);
            const ok = page.getByRole('button', { name: 'OK', exact: true });
            for (let i = 0; i < 12; i++) await ok.nth(i).click();
            const note = 'Fotos QA ' + randomUUID();
            await page.getByLabel('Observaciones', { exact: true }).fill(note);
            await clickByName(page, 'Enviar Inspección');
            await clickByName(page, 'Confirmar');
            await visible(page.getByText('Inspección registrada.', { exact: true }));
            const row = sheet.read(tabs.dvir).find(item => item[23] === note);
            assert(row);
            assert.deepEqual([row[7], row[22], row[25]], [type, 'aprobado', '']);
            const urls = row[24].split(', ');
            assert.equal(new Set(urls).size, 2);
            await page.goto(origin + '/perfil', { waitUntil: 'domcontentloaded' });
            await clickByName(page, 'Historial de mis acciones');
            const history = page.getByText(row[1], { exact: false }).locator('..');
            await visible(history.getByRole('link', { name: 'Ver evidencia 1', exact: true }));
            for (const [index, path] of urls.entries()) {
              assert.match(path, /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/);
              const link = history.getByRole('link', { name: 'Ver evidencia ' + (index + 1), exact: true });
              assert.equal(await link.getAttribute('href'), path);
              const image = await page.request.get(origin + path);
              assert.equal(image.status(), 200);
              assert.deepEqual(await image.body(), photoPng);
            }
            return urls;
          }, firstAccount('operador'));
          saved.push(...links);
        }
        await inRole('gerencia', 390, async page => {
          await page.goto(origin + '/data', { waitUntil: 'domcontentloaded' });
          const data = page.locator('#main-content');
          await data.getByRole('button', { name: /^Inspecciones/ }).click();
          await visible(data.getByRole('columnheader', { name: /^fotos$/i })).catch(async error => {
            throw new Error(`${error.message}\n${(await data.innerText()).slice(0, 700)}`);
          });
          const summaries = data.locator('td summary').filter({ hasText: '2 fotos' });
          await visible(summaries);
          assert.equal(await summaries.count(), 2);
          for (const summary of await summaries.all()) await summary.click();
          const urls = await data.getByRole('link', { name: /^Foto [12]$/ }).evaluateAll(links => links.map(link => link.getAttribute('href')));
          assert.deepEqual(urls.sort(), [...saved].sort());
          await noHorizontalOverflow(page, 390);
        }, firstAccount('gerencia'));
        const anon = await browser.newContext({ ignoreHTTPSErrors: true });
        try {
          assert.equal((await anon.request.get(origin + saved[0])).status(), 401);
        } finally { await anon.close(); }
        return { inspections: 2, photos: saved.length, visibleInHistory: true, visibleInReports: true, authenticatedOnly: true };
      } finally {
        sheet.restoreCheckpoint(baseline);
        for (const key of fixture.photos.keys()) if (!photoKeys.has(key)) fixture.photos.delete(key);
        for (const key of fixture.evidence.keys()) if (!evidenceKeys.has(key)) fixture.evidence.delete(key);
      }
    });
    if (focusedPanama) {
      await checkPanamaViewportMatrix({ fixture, record, inRole, shot, out });
      await checkConnectedPmPdfs({ fixture, record, inRole, out });
      await checkMobileRoleHomes({ fixture, record, inRole, shot });
      return [...external];
    }
    await record('MÓVIL-LOGIN-RECUPERA-ARCHIVO', async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        serviceWorkers: 'block', ignoreHTTPSErrors: true,
      });
      try {
        const page = await context.newPage();
        let interrupted = false;
        await page.route(/\/assets\/LoginPage-[^/]+\.js$/, route => {
          if (interrupted) return route.continue();
          interrupted = true;
          return route.abort('failed');
        });
        await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
        await waitUntil(() => interrupted, 'No se interrumpió el archivo de acceso');
        const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
        await retry.waitFor({ state: 'visible', timeout: 7000 });
        await retry.click();
        await page.getByRole('button', { name: 'Ingresar', exact: true }).waitFor({ state: 'visible', timeout: 7000 });
        return { width: 390, retryRestoredLogin: true };
      } finally { await context.close(); }
    });

    if (withGateway) await record('MÓVIL-DIÉSEL-MISMO-INTERVALO', () => inRole('gerencia', 390, async page => {
      const tab = 'Combustible';
      const prior = sheet.read(tab);
      const fill = (id, day, unit, liters, meter) => [id, `${day}/11/2026`, '08:00', unit, 'QA', 'Diesel', liters, '', meter];
      sheet.seed(tab, [prior[0], fill('QA-01', 11, 'DZ203', '110', '1000'), fill('QA-02', 12, 'DZ203', '80', '1004'),
        fill('QA-03', 11, 'EX401', '60', '2000'), fill('QA-04', 12, 'EX401', '50', '')]);
      try {
        await clickByName(page, 'Actualizar datos');
        const panel = page.getByRole('region', { name: 'Consumo de diésel por familia' });
        await panel.getByLabel('Fecha final · Panamá').fill('2026-11-12');
        await visible(panel.getByText('20 L/h', { exact: true }).first());
        await visible(panel.getByText('Horómetro faltante o sin avance cuadrable.', { exact: true }));
        await visible(panel.getByText(/80 L \/ 4 h/).first());
        await noHorizontalOverflow(page, 390);
        return { liters: 80, meterHours: 4, incompleteReadingVisible: true };
      } finally { sheet.seed(tab, prior); }
    }, loadAccounts[71]));

    if (withGateway) await checkPanamaViewportMatrix({ fixture, record, inRole, shot, out });
    if (withGateway) await checkConnectedPmPdfs({ fixture, record, inRole, out });

    if (withGateway) await record('MÓVIL-QR-PRESELECCIÓN-UNIDAD', () => inRole('operador', 390, async page => {
      await page.goto(`${origin}/falla?unit=NO-ASIGNADA`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      const control = page.getByLabel('Unidad', { exact: true });
      await visible(control.locator('option[value="DZ203"]').locator('..'));
      assert.equal(await control.inputValue(), '');
      await page.goto(`${origin}/falla?unit=DZ203`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await waitUntil(async () => (await control.inputValue()) === 'DZ203', 'No se precargó la unidad autorizada');
      await noHorizontalOverflow(page, 390);
      return { allowedUnitPrefilled: true, externalUnitIgnored: true };
    }, loadAccounts[72]));

    if (withGateway) await record('MÓVIL-FALLA-EQUIPOS-REINTENTO', () => inRole('operador', 360, async page => {
      sheet.setUnavailable([tabs.fleet], true);
      try {
        await clickByName(page, 'Reportar falla');
        const unit = page.getByLabel('Unidad', { exact: true });
        const retry = page.getByRole('button', { name: 'Volver a cargar equipos', exact: true });
        await retry.waitFor({ state: 'visible', timeout: 5000 });
        assert(await unit.isDisabled());
        const notes = page.getByLabel('Descripción', { exact: true });
        await notes.fill('Observación conservada durante el reintento');
        sheet.setUnavailable([tabs.fleet], false);
        await retry.tap();
        await unit.selectOption('DZ203');
        assert.equal(await notes.inputValue(), 'Observación conservada durante el reintento');
        assert.equal(await retry.count(), 0);
        await noHorizontalOverflow(page, 360);
        return { recoveryFromRosterFailure: true, keptDraft: true };
      } finally { sheet.setUnavailable([tabs.fleet], false); }
    }, loadAccounts[78]));

    if (withGateway) await record('MÓVIL-FALLA-FLOTA-PUBLICADA-SIN-HOJAS', () => inRole('operador', 360, async page => {
      const description = 'La bomba pierde aceite al arrancar';
      const capturedAt = new Date().toISOString();
      const previous = [tabs.orders, tabs.failure, tabs.history].map(tab => [tab, sheet.read(tab)]);
      const store = fixture.operationalSheets;
      const previousReadReportFleet = store.readReportFleet;
      store.readReportFleet = async () => ({ capturedAt, units: [
        { code: 'DZ203', model: 'Caterpillar 745' }, { code: 'EX410', model: 'Komatsu PC490' },
      ] });
      sheet.setUnavailable([tabs.fleet], true);
      try {
        const roster = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/workshop/reportunits'));
        await fillFailure(page, description, false);
        const loaded = await roster;
        assert.equal(loaded.status(), 200);
        const units = await loaded.json();
        assert.equal(units.capturedAt, capturedAt);
        assert.deepEqual(units.units, [{ code: 'DZ203', model: 'Caterpillar 745' }]);
        await noHorizontalOverflow(page, 360);
        await clickByName(page, 'Confirmar');
        await visible(page.getByText(/OT creada/i));
        const [order] = sheet.read(tabs.orders).filter(row => row[5] === description);
        assert(order, 'La OT no quedó guardada');
        assert.equal(order[3], 'DZ203');
        assert.equal(sheet.read(tabs.orders).filter(row => row[5] === description).length, 1);
        assert.equal(sheet.read(tabs.failure).filter(row => row[13] === order[1]).length, 1);
        assert.equal(sheet.read(tabs.history).filter(row => row[1] === order[1] && row[4] === 'Abierta').length, 1);
        await shot(page, 'falla-sin-hojas-360.png');
        return { width: 360, capturedAt, allowedUnits: units.units.length, folio: order[25] || order[1], failureAndHistoryLinked: true };
      } finally {
        sheet.setUnavailable([tabs.fleet], false);
        if (previousReadReportFleet) store.readReportFleet = previousReadReportFleet;
        else delete store.readReportFleet;
        for (const [tab, rows] of previous) sheet.seed(tab, rows);
      }
    }, loadAccounts[78]));

    if (withGateway) await record('MÓVIL-MI-TURNO-AVISO-Y-BANDEJAS', async () => {
      const operator = firstAccount('operador');
      const coordinator = firstAccount('coordinador');
      const workshop = firstAccount('jefe_taller');
      const tab = 'HERMES_PA_DESPACHO';
      const prior = [tab, tabs.orders, tabs.failure, tabs.history, tabs.sticker, tabs.dvir].map(name => [name, sheet.read(name)]);
      for (const [name, column] of [[tabs.orders, 3], [tabs.failure, 2], [tabs.sticker, 5], [tabs.dvir, 4]]) {
        sheet.seed(name, sheet.read(name).filter(row => row[column] !== 'DZ203'));
      }
      const now = new Date();
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const assignment = ['DPA-' + 'A'.repeat(20), 'DZ203', date, 'Noche', 'TMF QA',
        operator.user.id, operator.membership.user_name, coordinator.user.id, coordinator.membership.user_name, now.toISOString()];
      sheet.seed(tab, [...prior[0][1], assignment]);
      try {
        return await inRole('coordinador', 390, async coord => {
          await visible(coord.getByRole('heading', { name: 'OT pendientes', exact: true }));
          return inRole('jefe_taller', 390, async chief => {
            await visible(chief.getByRole('heading', { name: 'OTs por recibir', exact: true }));
            return inRole('operador', 360, async (page, context) => {
              await visible(page.getByRole('heading', { name: 'Mi turno' }));
              const dispatch = await page.request.get(origin + '/hermes-api/api/panama/turnos/despacho?date=' + date);
              assert.equal(dispatch.status(), 200, await dispatch.text());
              assert.equal((await dispatch.json()).assignments[0]?.id, assignment[0], 'El despacho no devolvió la asignación de prueba');
              await visible(page.getByText('DZ203 · Noche', { exact: true }));
              await noHorizontalOverflow(page, 360);
              const home = async () => {
                await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Inicio', exact: true }).click();
                await visible(page.getByText('DZ203 · Noche', { exact: true }));
              };
              for (const name of ['Horómetro', 'Inspección']) {
                await clickByName(page, name);
                const select = page.locator('#main-content select').first();
                await waitUntil(async () => (await select.inputValue()) === 'DZ203', 'No se precargó la unidad en ' + name);
                await home();
              }
              await clickByName(page, 'Mis reportes');
              await visible(page.getByRole('heading', { name: 'Mis reportes' }));
              await home();
              await clickByName(page, 'Reportar falla');
              const selects = page.locator('#main-content select');
              await waitUntil(async () => (await selects.first().inputValue()) === 'DZ203', 'No se precargó la unidad en la avería');
              const description = 'Manguera dañada · Mi turno QA';
              await selects.nth(1).selectOption({ label: 'Mecánica' });
              await page.getByPlaceholder('Describe los síntomas observados...').fill(description);
              await clickByName(page, 'Sí');
              await page.locator('input[type=file]').first().setInputFiles({ name: 'mi-turno.png', mimeType: 'image/png', buffer: photoPng });
              await clickByName(page, /^Enviar reporte$/i);
              await visible(page.getByRole('heading', { name: 'Confirmar reporte de falla' }));
              assert.equal(await coord.getByText(description, { exact: true }).count(), 0);
              assert.equal(await chief.getByText(description, { exact: true }).count(), 0);
              await context.setOffline(true);
              await clickByName(page, 'Confirmar');
              await visible(page.getByText(/pendiente en este dispositivo/i));
              await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Inicio', exact: true }).click();
              await clickByName(page, 'Mis reportes');
              await visible(page.getByText('Guardado en el teléfono', { exact: true }));
              assert.equal(sheet.read(tabs.orders).filter(row => row[5] === description).length, 0);

              const accepted = page.waitForResponse(response => response.url() === origin + '/hermes-api/api/workshop/report'
                && response.request().method() === 'POST' && response.ok());
              await context.setOffline(false);
              const receipt = await (await accepted).json();
              const began = Date.now();
              const observed = await Promise.all([coord, chief].map(async inbox => {
                await inbox.getByText(description, { exact: true }).first().waitFor({ timeout: 22_000 });
                return Date.now() - began;
              }));
              await page.getByText('Recibido por Taller', { exact: true }).first().waitFor({ timeout: 22_000 });
              assert.equal(await page.getByText('Guardado en el teléfono', { exact: true }).count(), 0);
              const [order] = sheet.read(tabs.orders).filter(row => row[5] === description);
              assert.equal(order[1], receipt.otId);
              for (const inbox of [coord, chief]) {
                await inbox.getByText(description, { exact: true }).first().click();
                await inbox.waitForURL(origin + '/workorders/' + encodeURIComponent(order[1]));
                assert.deepEqual(await (await inbox.request.get(origin + order[10])).body(), photoPng);
              }
              const tech = firstAccount('mecanico');
              await chief.getByLabel('Mecánico asignado').selectOption(tech.user.id);
              await clickByName(chief, 'Asignar');
              await waitUntil(() => sheet.read(tabs.orders).find(row => row[1] === order[1] && row[17] === tech.user.id), 'No persistió la asignación');
              await changeOrderStatus(chief, 'En Reparación', order[1]);
              await page.getByText('En reparación', { exact: true }).first().waitFor({ timeout: 22_000 });
              assert.equal(sheet.read(tabs.orders).filter(row => row[5] === description).length, 1);
              assert.equal(sheet.read(tabs.failure).filter(row => row[13] === order[1]).length, 1);
              await shot(page, 'mi-turno-mis-reportes-360.png');
              const orderPath = '/workorders/' + encodeURIComponent(order[1]);
              await inRole('mecanico', 360, async mechanic => {
                await mechanic.goto(origin + orderPath, { waitUntil: 'domcontentloaded' });
                await visible(mechanic.getByRole('heading', { name: orderHeading(order[1]), exact: true }));
                await changeOrderStatus(mechanic, 'Resuelta', order[1], false, 'Manguera sustituida en el piloto sintético');
              }, tech);
              await chief.reload({ waitUntil: 'domcontentloaded' });
              await visible(chief.getByRole('heading', { name: orderHeading(order[1]), exact: true }));
              await changeOrderStatus(chief, 'Completado', order[1]);
              await inRole('supervisor', 390, async operations => {
                await operations.goto(origin + orderPath, { waitUntil: 'domcontentloaded' });
                await operations.getByLabel('Observación de Operaciones').fill('Recibido por Operaciones en prueba aislada');
                const returned = operations.waitForResponse(response => response.url() === origin + '/hermes-api/api/workshop/returns'
                  && response.request().method() === 'POST');
                await clickByName(operations, 'Confirmar retorno ahora');
                const response = await returned;
                assert(response.ok(), await response.text());
                await visible(operations.getByText(/Equipo recibido por /));
              }, firstAccount('supervisor'));
              const closedOrder = sheet.read(tabs.orders).find(row => row[1] === order[1]);
              assert.equal(closedOrder[9], 'Completado');
              assert.equal(JSON.parse(closedOrder[22]).decision, 'accepted');
              return { unit: 'DZ203', shift: 'Noche', folio: receipt.folio ?? order[25] ?? order[1], prefills: 3,
                officeViewsMs: { coordinator: observed[0], workshop: observed[1] }, samePhoto: true, offlineStatus: true,
                receivedStatus: true, repairStatus: true, technicalClose: true, operationalReturn: true, duplicateOrders: 0 };
            }, operator);
          }, workshop);
        }, coordinator);
      } finally {
        for (const [name, rows] of prior) sheet.seed(name, rows);
      }
    });

    if (withGateway) await record('MÓVIL-FLOTA-HISTORIAL-UNIDAD', () => inRole('gerencia', 390, async page => {
      const priorFailures = sheet.read(tabs.failure);
      const priorOrders = sheet.read(tabs.orders);
      const cut = new Date().toISOString();
      sheet.seed(tabs.failure, [priorFailures[0]]);
      const today = cut.slice(0, 10);
      sheet.seed(tabs.orders, [priorOrders[0],
        ['qa', 'OT-0100', today, 'DZ204', 'Avería', 'OT crítica sintética', '', 'CRITICA', '', 'Abierta'],
        ['qa', 'OT-0101', today, 'DZ204', 'Avería', 'OT cerrada sintética', '', 'CRITICA', '', 'Completado']]);
      sheet.setWorkshopMasters({ failures: { records: [], capturedAt: cut },
        orders: { records: [{ id: 'OT-0001', unit: 'DZ203', status: 'Abierta' },
          { id: 'OT-0002', unit: 'DZ204', status: 'Abierta' }], capturedAt: cut } });
      try {
        await clickByName(page, 'Actualizar datos');
        const summary = page.getByRole('region', { name: 'Maestro de Taller' });
        await visible(summary.getByText('OTs abiertas: 3', { exact: true }));
        const indicator = page.getByRole('button', { name: 'Ver OT críticas' });
        await visible(indicator.getByText('1 confirmada', { exact: true }));
        await indicator.click();
        const critical = page.getByRole('region', { name: 'Detalle de OT críticas' });
        await visible(critical.getByRole('list', { name: 'Críticas confirmadas' }).getByText(/OT-0100/));
        await visible(critical.getByRole('list', { name: 'Prioridad pendiente de confirmar' }).getByText(/OT-0001/));
        assert.equal(await critical.getByText(/OT-0101/).count(), 0);
        await clickByName(page, 'Ver detalle de DZ203');
        const modal = page.getByRole('dialog', { name: 'Detalle de DZ203' });
        await visible(modal.getByText('OT-0001', { exact: true }));
        await visible(modal.getByText('Maestro de Taller', { exact: false }));
        assert.equal(await modal.getByText('OT-0002', { exact: true }).count(), 0);
        assert.equal(await modal.getByText('Sin reporte de avería registrado', { exact: true }).count(), 0);
        await noHorizontalOverflow(page, 390);
        await page.goto(`${origin}/fleet`, { waitUntil: 'domcontentloaded' });
        await dismissPrivacy(page);
        await clickByName(page, 'Ver detalle de DZ203');
        await visible(modal.getByText('OT-0001', { exact: true }));
        return { unit: 'DZ203', order: 'OT-0001', source: 'Maestro de Taller',
          otherUnitExcluded: true, criticalOrder: 'OT-0100', orderWithoutPriority: 'OT-0001' };
      } finally {
        sheet.setWorkshopMasters(undefined);
        sheet.seed(tabs.failure, priorFailures);
        sheet.seed(tabs.orders, priorOrders);
      }
    }, firstAccount('gerencia')));

    if (withGateway) await record('MÓVIL-16-CORTES-FECHA-Y-RECUPERACIÓN', () => inRole('gerencia', 390, async page => {
      const keys = ['fleet', 'orders', 'failures', 'shifts', 'maintenance', 'maintenancePlan', 'maintenanceAnchor',
        'equipmentDetails', 'costs', 'purchases', 'dozers', 'dozerChanges', 'dozerLife', 'excavators', 'excavatorChanges', 'excavatorLife'];
      let responseStatus = 200;
      await page.route('**/hermes-api/api/panama/cortes', route => responseStatus !== 200
        ? route.fulfill({ status: responseStatus, json: { error: 'No disponible' } })
        : route.fulfill({ json: { project: 'tmf-panama', sources: keys.map((key, index) => ({
          key, label: key === 'orders' ? 'Órdenes de Taller' : key, status: index === 1 ? 'previous' : 'latest',
          capturedAt: index === 1 ? '2026-11-14T21:18:02.050Z' : '2026-11-15T01:16:43.960Z',
        })) } }));
      await page.goto(`${origin}/panama`, { waitUntil: 'domcontentloaded' });
      await page.locator('summary').filter({ hasText: /^Cortes de los 16 maestros$/ }).click();
      const list = page.getByRole('list', { name: 'Estado de cortes publicados' });
      const orders = list.getByRole('listitem').filter({ hasText: 'Órdenes de Taller' });
      await visible(orders.getByText(/Corte anterior conservado.*Panamá/));
      assert.equal(await list.getByRole('listitem').count(), 16);
      responseStatus = 503;
      await clickByName(page, 'Actualizar');
      await visible(page.getByText(/Se muestran las fechas verificadas anteriormente/));
      assert.equal(await list.getByRole('listitem').count(), 16);
      responseStatus = 403;
      await clickByName(page, 'Actualizar');
      await visible(page.getByText('No se pudieron consultar las fechas de corte.', { exact: true }));
      assert.equal(await list.count(), 0);
      await noHorizontalOverflow(page, 390);
      return { sources: 16, olderCutLabeled: true, retainedAfterUnavailable: true, clearedAfterPermissionLoss: true };
    }, firstAccount('gerencia')));

    if (withGateway) await record('MÓVIL-GERENCIA-MAESTRO-DE-TALLER', () => inRole('gerencia', 390, async page => {
      const cut = new Date().toISOString();
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const previousFailures = sheet.read(tabs.failure);
      const previousOrders = sheet.read(tabs.orders);
      sheet.seed(tabs.failure, [previousFailures[0],
        [today, '07:30', 'DZ203', 'Llanta', 'Avería sintética', 'ALTA', '', '', '', 'Abierta', '', '', '', 'OT-0004']]);
      sheet.seed(tabs.orders, [previousOrders[0],
        ['qa', 'OT-0004', today, 'DZ203', 'Llanta', 'OT sintética', 'ALTA', 'ALTA', '', 'Abierta']]);
      sheet.setWorkshopMasters({
        failures: { records: [
          { id: 'TMF-QA-42', order: 'OT-0004', unit: 'DZ203', status: 'Cerrada', last: today },
          { id: 'tmf-qa-42', order: 'OT-0004', unit: 'DZ203', status: 'Cerrada', last: today },
        ], capturedAt: cut },
        orders: { records: [{ id: 'OT-0004', unit: 'DZ203', status: 'Cerrada' }], capturedAt: cut },
      });
      try {
        await clickByName(page, 'Actualizar datos');
        const alertsCard = page.getByText('Averías hoy', { exact: true }).locator('..');
        await visible(alertsCard.getByText('1', { exact: true }));
        const summary = page.getByRole('region', { name: 'Maestro de Taller' });
        await visible(summary.getByText('Maestro: Cerrada', { exact: true }).first());
        await visible(summary.getByText('Hermes: Abierta', { exact: true }).first());
        await visible(summary.getByText('Por conciliar', { exact: true }).first());
        await visible(summary.getByText('TMF-QA-42 · DZ203', { exact: true }));
        assert.equal(await summary.getByText('TMF-QA-42 · DZ203', { exact: true }).count(), 1);
        await visible(summary.getByText(/Corte del Maestro de Taller/));
        await clickByName(page, 'Briefing');
        await visible(summary.getByText('Averías hoy: 1', { exact: true }));
        await visible(summary.getByText('OTs abiertas: 0', { exact: true }));
        await visible(summary.getByText('TMF-QA-42 · DZ203', { exact: true }));
        await noHorizontalOverflow(page, 390);
        return { masterPrimary: true, caseCount: 1, duplicateSuppressed: true, discrepancyVisible: true, sameInBriefing: true };
      } finally {
        sheet.setWorkshopMasters(undefined);
        sheet.seed(tabs.failure, previousFailures);
        sheet.seed(tabs.orders, previousOrders);
      }
    }, firstAccount('gerencia')));

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
        await visible(page.getByText('Combustible sin verificar.', { exact: true }));
        await visible(page.getByText('DESPACHO SIN VERIFICAR', { exact: true }));
        assert.equal(await page.getByText(/0 L diésel total|Sin anomalías detectadas/).count(), 0);
        await noHorizontalOverflow(page, 390);

        await page.goto(`${origin}/pedidos`);
        await visible(page.getByText('No se pudieron consultar los pedidos de Hermes.', { exact: true }));
        await clickByName(page, 'Historial');
        await visible(page.getByText('Cotización del maestro QA', { exact: true }));
        await page.getByText('Fuente y fecha', { exact: true }).click();
        await visible(page.getByText(/Corte del Maestro de Compras/));
        assert.equal(await page.getByText('No hay pedidos registrados aún.').count(), 0);
        await noHorizontalOverflow(page, 390);

        await page.goto(`${origin}/workorders`);
        await page.getByText('Referencia del maestro', { exact: true }).first().click();
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
        await page.reload({ waitUntil: 'domcontentloaded' });
        await visible(part.getByText('Sin coincidencia en el corte de REGISTRO'));
        assert.equal(sheet.read(shiftTab).filter(row => row[0] === folio).at(-1)[20], 'accept');
        await noHorizontalOverflow(page, 390);
        await shot(page, 'relevo-aceptado-390.png');
      });
      return { folio, hours: 8, scopes: ['operador', 'supervisor'], officialReconciliation: 'pendiente' };
    });

    await record('MÓVIL-TURNOS-CONCILIACIÓN-REGISTRO', () => checkShiftRegister({ fixture, inRole, noHorizontalOverflow, shot }));

    await record('MÓVIL-VALORIZACIÓN-TMF-A-FACTURA', async () => {
      const tab = 'HERMES_PA_TURNOS';
      const prior = sheet.read(tab);
      const priorOrders = sheet.read(tabs.orders);
      const pmHistoryTab = '05 Historial PM';
      const priorPmHistory = sheet.read(pmHistoryTab);
      const id = 'TPA-C4300000000000000001';
      const author = firstAccount('operador');
      const supervisor = firstAccount('supervisor');
      const shift = [id, 'EX401', '2026-11-15', 'Día de prueba', 1, 'Pendiente de revisión', 100, 108, 8,
        'Operativo', 'PARTE-QA-43', 1, 20, 'Sin paradas', 'Cliente QA', author.user.id, author.membership.user_name,
        author.user.id, author.membership.user_name, '2026-11-15T15:00:00Z', 'deliver', ''];
      const accepted = [...shift];
      Object.assign(accepted, { 4: 2, 5: 'Aceptado por Supervisión', 17: supervisor.user.id, 18: supervisor.membership.user_name,
        19: '2026-11-15T17:00:00Z', 20: 'accept' });
      sheet.seed(tab, [...prior, shift, accepted]);
      sheet.seed(pmHistoryTab, priorPmHistory.slice(0, 1));
      const repair = Object.assign(Array(26).fill(''), { 1: 'OT-QA-FICHA-401', 2: '16/11/2026', 3: 'EX401',
        5: 'Cierre para ficha', 9: 'Completado', 14: new Date().toISOString(), 25: 'OT-0701' });
      sheet.seed(tabs.orders, [...priorOrders, repair]);
      try {
        return await inRole('gerencia', 360, async page => {
          await page.route('**/hermes-api/api/panama/maintenance', route => route.fulfill({ json: { project: 'tmf-panama', sections: {
            maintenance: [{ unit: 'EX401', next: 'PM-500', due: '2000', hours: '1924', remaining: '76', status: 'Al día' }],
          } } }));
          await page.route('**/hermes-api/api/panama/componentes?*', route => {
            assert.equal(new URL(route.request().url()).searchParams.get('unit'), 'EX401');
            return route.fulfill({ json: { unit: 'EX401', changes: [], unavailable: [], life: [
              { part: 'Dientes', position: 'Frente', calculation: { status: 'verified', elapsed: 956, remaining: 44 } },
            ] } });
          });
          await page.route('**/hermes-api/api/purchasing/requests', route => route.fulfill({ json: { items: [
            { equipo: 'EX401', ot: 'OT-QA-ABIERTA-401', partNum: 'DIENTE-QA', descripcion: 'Diente de excavadora', cantidad: '2', estado: 'Pendiente' },
          ] } }));
          await page.route('**/hermes-api/api/purchasing/ot-part?*', route => {
            const params = new URL(route.request().url()).searchParams;
            assert.equal(params.get('ot'), 'OT-QA-ABIERTA-401');
            assert.equal(params.get('partNumber'), 'DIENTE-QA');
            return route.fulfill({ json: { unit: 'EX401', ot: 'OT-QA-ABIERTA-401', folio: 'OT-0702', match: 'verified', partNumber: 'DIENTE-QA',
              items: [{ partNumber: 'DIENTE-QA', warehouse: 'Almacén QA', available: '3', reservedForOt: '2' }] } });
          });
          await page.route('**/hermes-api/api/purchasing/workorder-cost?*', route => {
            assert.equal(new URL(route.request().url()).searchParams.get('ot'), repair[1]);
            return route.fulfill({ json: { ot: repair[1], unit: 'EX401', folio: repair[25], project: 'tmf-panama',
              totals: [{ currency: 'USD', amount: '240.50' }], pending: [] } });
          });
          await clickByName(page, 'Ver detalle de EX401');
          const card = page.getByRole('region', { name: 'Ficha operativa de EX401' });
          await visible(card.getByText('76 h restantes')).catch(async error => {
            throw new Error(`${error.message}\n${await card.innerText({ timeout: 1500 })}`);
          });
          await visible(card.getByText('Dientes · Frente'));
          await visible(card.getByText('44 h restantes'));
          await visible(card.getByText(/3 disponibles · 2 reservados/));
          await visible(card.getByText('OT-0701', { exact: true }));
          await visible(card.getByText(/240[.,]50/));
          await noHorizontalOverflow(page, 360);
          await card.getByRole('link', { name: 'Partes aceptados, valorización y factura' }).click();
          await visible(page.getByRole('heading', { name: 'Partes aceptados · EX401' }));
          const part = page.getByRole('article').filter({ hasText: id });
          await visible(part.getByText(/8 h del turno/));
          await part.getByRole('button', { name: 'Ver valorización y factura' }).click();
          await visible(part.getByText('Horas a valorizar', { exact: true }));
          await visible(part.getByText(/FAC-QA/));
          await visible(part.getByText(/4[,.]?275[,.]00/).first());
          await visible(part.getByText(/-5 h|−5 h/));
          await noHorizontalOverflow(page, 360);
          await part.getByText(/FAC-QA/).scrollIntoViewIfNeeded();
          await shot(page, 'valorizacion-factura-360.png');
          return { folio: id, acceptedHours: 8, valuedPeriodHours: 95, adjustmentHours: -5, invoice: 'FAC-QA', currency: 'USD', width: 360,
            unitCard: { unit: 'EX401', nextPmRemaining: 76, componentRemaining: 44, stockAvailable: 3, reserved: 2, lastRepairCost: '240.50 USD' } };
        });
      } finally { sheet.seed(tab, prior); sheet.seed(tabs.orders, priorOrders); sheet.seed(pmHistoryTab, priorPmHistory); }
    });

    await record('MÓVIL-HORÓMETRO-CAMBIO-CON-CONTINUIDAD', async () => {
      const tab = '04B Registro Horómetros';
      sheet.seed(tab, [...sheet.read(tab), ['12/11/2026','07:00:00','DZ203','Caterpillar 745','QA','inicio','390']]);
      const path = `${origin}/horometro`;
      const select = async page => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Unidad', { exact: true }).selectOption('DZ203');
        await visible(page.getByText(/REG-QA-HOROMETRO/));
      };
      await inRole('supervisor', 360, async page => {
        await select(page);
        await clickByName(page, 'Registrar cambio de medidor');
        await page.getByLabel('Fecha del cambio').fill('2026-11-12');
        await page.getByLabel('Hora en Panamá').fill('14:00');
        await page.getByLabel('Lectura final anterior').fill('397');
        await page.getByLabel('Lectura inicial nueva').fill('2');
        await page.getByLabel('Referencia de Taller').fill('OT-QA-CAMBIO');
        await clickByName(page, 'Confirmar cambio');
        await visible(page.getByText('397 h acumuladas', { exact: true }));
        await page.getByText('Ver lecturas y cambios').click();
        await visible(page.getByText(/397 → 2 h en medidor/));
        await visible(page.getByText(/Coincide con REGISTRO para la fecha del parte/));
        await noHorizontalOverflow(page, 360);
      }, firstAccount('supervisor'));
      await inRole('operador', 390, async page => {
        await select(page);
        assert.equal(await page.getByRole('button', { name: 'Registrar cambio de medidor' }).count(), 0);
        await page.getByLabel('Horómetro', { exact: true }).fill('1');
        await clickByName(page, 'Registrar Horómetro');
        await clickByName(page, 'Confirmar');
        await visible(page.getByText(/El horómetro no concuerda/));
        await page.getByLabel('Horómetro', { exact: true }).fill('4');
        await clickByName(page, 'Registrar Horómetro');
        await clickByName(page, 'Confirmar');
        await visible(page.getByText('399 h acumuladas', { exact: true }));
        await select(page);
        await visible(page.getByText('399 h acumuladas', { exact: true }));
        await noHorizontalOverflow(page, 390);
      }, firstAccount('operador'));
      const rows = sheet.read(tab).filter(row => row[2] === 'DZ203');
      assert.deepEqual(rows.map(row => row[6]), ['390','2','4']);
      return { earlier: 390, replacementTotal: 397, updatedTotal: 399, invalidReadingRejected: true, officialCutVisible: true, reloaded: true };
    });

    await record('MÓVIL-TELEMÁTICA-FLOTA-MIXTA', () => inRole('operador', 360, async page => {
      await page.goto(`${origin}/horometro`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      const selector = page.getByLabel('Unidad', { exact: true });
      await selector.selectOption('DZ203');
      const section = page.getByRole('region', { name: 'Lecturas por origen' });
      await visible(section);
      await visible(section.getByText(/800 h/).first());
      await visible(section.getByText(/Telemática QA/).first());

      await selector.selectOption('DZ205');
      await visible(section.getByText(/160[,.]934 km/).first());
      await visible(section.getByText(/Vencida/));
      await clickByName(page, 'Registrar lectura en km');
      const form = page.getByRole('button', { name: 'Guardar lectura en km' }).locator('xpath=ancestor::form[1]');
      await form.getByLabel('Lectura (km)', { exact: true }).fill('170');
      await form.getByLabel('Referencia del respaldo').fill('Parte manual QA-41');
      await form.getByRole('button', { name: 'Guardar lectura en km' }).click();
      await visible(section.getByText(/170 km/).first());
      await visible(section.getByText(/Respaldo manual/));
      await visible(section.getByText(/Parte manual QA-41/).first());
      await noHorizontalOverflow(page, 360);
      await section.scrollIntoViewIfNeeded();
      await shot(page, 'telematica-mixta-360.png');
      return { unitHours: 'DZ203', unitDistance: 'DZ205', normalizedHours: 800, backedUpKm: 170, width: 360 };
    }));

    await record('MÓVIL-CAMPO-CONFIRMACIÓN', () => inRole('operador', 390, async page => {
      const fuelTab = 'Combustible';
      const tripTab = 'Reporte_Fletes_Transporte';
      await page.goto(`${origin}/diesel`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await page.locator('select').first().selectOption('EX401');
      await page.getByPlaceholder('0', { exact: true }).fill('125');
      await page.getByPlaceholder('Ej: 8450', { exact: true }).fill('5528');
      await page.getByLabel('Observaciones', { exact: true }).fill('COMBUSTIBLE-QA-ESPERA');
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
      const start = new Date(Date.now() - 3_600_000).toISOString().slice(0, 16) + ':00.000Z';
      const localStart = new Date(Date.parse(start) - 5 * 3_600_000).toISOString().slice(0, 16);
      await fillFailure(page, description, false, 'EX401', undefined, localStart);
      const attempts = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/workshop/report')) attempts.push(request.postDataJSON().mutationId);
      });
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.orders), delay: 1000, when: 'after' });
      await page.getByRole('button', { name: 'Confirmar', exact: true }).evaluate(button => {
        button.click();
        button.click();
      });
      await sleep(200);
      assert.equal(sheet.read(tabs.orders).find(row => row[5] === description), undefined);
      assert.equal(await page.getByText(/OT.*creada|reporte guardado/i).count(), 0, 'La app confirmó antes de guardar');
      const order = await waitUntil(() => sheet.read(tabs.orders).find(row => row[5] === description), 'No llegó la OT sintética');
      await visible(page.getByRole('button', { name: 'Reintentar', exact: true }));
      assert.equal(attempts.length, 1);
      await clickByName(page, 'Reintentar');
      await visible(page.getByText(/OT creada/i));
      assert.deepEqual(attempts, [order[0], order[0]]);
      assert.equal(sheet.read(tabs.orders).filter(row => row[5] === description).length, 1);
      filed = { folio: order[1], description };
      assert.equal(sheet.read(tabs.failure).filter(row => row[13] === order[1]).length, 1);
      assert.equal(JSON.parse(sheet.read(tabs.failure).find(row => row[13] === order[1])[16]).startedAt, start);
      await noHorizontalOverflow(page, 360);
      await shot(page, 'falla-360.png');
      return { ...filed, linked: true, prematureConfirmation: false, confirmationRecovered: true, duplicateSuppressed: true };
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
        await visible(page.getByRole('heading', { name: role === 'coordinador' ? 'OT pendientes' : 'OTs por recibir', exact: true }));
        await visible(page.locator(`[data-ot="${filed.folio}"]`).or(page.getByText(filed.description, { exact: true })));
        await readOrder(page, filed.folio, filed.description);
        await noHorizontalOverflow(page, 390);
        await shot(page, `ot-${role}-390.png`);
        return { ...filed, role, reloaded: true };
      }));
    }

    let pmMobileFolio;
    await record('MÓVIL-PM-DISPARADORES-Y-ORDEN-ÚNICA', () => inRole('jefe_taller', 360, async page => {
      const path = `${origin}/pm-order?unidad=DZ205&nivel=PM-250`;
      const create = async () => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const rules = page.getByRole('region', { name: 'Disparadores de mantenimiento' });
        await visible(rules.getByText(/390 h registradas \/ 388 h programadas/));
        await visible(rules.getByText(/vence 2026-11-12/));
        await visible(rules.getByText(/2 críticos \/ umbral 1/));
        await page.getByLabel('Horas estimadas').fill('2');
        await page.getByLabel('Turno').selectOption('Día');
        await page.getByLabel('Disponibilidad de repuestos').selectOption('not_required');
        await clickByName(page, 'Activar Orden de PM');
        await clickByName(page, 'Confirmar');
      };
      await create();
      await visible(page.getByRole('button', { name: 'Abrir Calendario' }));
      const rows = () => sheet.read(tabs.orders).filter(row => row[3] === 'DZ205' && row[4] === 'PM');
      const [order] = rows();
      assert.equal(rows().length, 1);
      assert.equal(JSON.parse(order[23]).triggers.length, 3);
      await create();
      await visible(page.getByText('Ya existe una orden para este servicio.'));
      assert.equal(rows().length, 1);
      await clickByName(page, /^Abrir orden(?: |$)/);
      const reasons = page.getByRole('region', { name: 'Motivo del mantenimiento' });
      await visible(reasons.getByText(/390 h registradas/));
      for (const detail of await reasons.locator('summary').all()) await detail.click();
      await visible(reasons.getByText(/Plan sintético QA rev1/).first());
      await noHorizontalOverflow(page, 360);
      return { folio: order[1], reasons: 3, duplicateSuppressed: true, persisted: true };
    }));

    await record('MÓVIL-PROGRAMA-PM-CALENDARIO', () => inRole('jefe_taller', 360, async page => {
      await page.goto(`${origin}/pm`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await visible(page.getByRole('heading', { name: 'Programa de Mantenimiento', exact: true }));
      await page.getByText('Nueva Orden PM', { exact: true }).tap();
      await page.waitForURL(`${origin}/pm-order`);
      await page.locator('fieldset select').first().selectOption('EX401');
      await page.getByRole('button', { name: /^PM[- ]?\d+$/ }).first().tap();
      assert.equal(await page.getByText('Auto-generado', { exact: true }).count(), 0);
      assert.equal(await page.getByLabel('Horas estimadas').inputValue(), '');
      await page.getByLabel('Horas estimadas').fill('3');
      const mechanic = firstAccount('mecanico');
      await page.getByLabel('Mecánico (opcional)').selectOption(mechanic.user.id);
      await page.getByLabel('Turno').selectOption('Día');
      await page.getByLabel('Disponibilidad de repuestos').selectOption('pending');
      await page.getByLabel('Repuestos de la orden').fill('Filtro QA');
      const scheduledDate = await page.getByLabel('Fecha programada').inputValue();
      sheet.seed(tabs.schedule, [...sheet.read(tabs.schedule),
        ['qa-capacity', scheduledDate, 'OT-CARGA-QA', 'EX401', 'Mecánico QA', '7', 'MEDIA', 'Programado', '', mechanic.user.id]]);
      const knownRows = sheet.read(tabs.pm).length;
      await clickByName(page, 'Activar Orden de PM');
      await visible(page.getByRole('dialog').getByText(/Sobrecarga de Taller/));
      await visible(page.getByRole('dialog').getByText(/Hay repuestos pendientes/));
      assert.equal(sheet.read(tabs.pm).length, knownRows);
      const attempts = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/workshop/pm')) attempts.push(request.postDataJSON().mutationId);
      });
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.pm), when: 'after' });
      await page.getByRole('button', { name: 'Confirmar', exact: true }).evaluate(button => {
        button.click();
        button.click();
      });
      const saved = await waitUntil(() => sheet.read(tabs.pm).slice(knownRows).find(row => row[2] === 'EX401'), 'No se guardó la Orden de PM');
      const folio = saved[0];
      pmMobileFolio = folio;
      await visible(page.getByRole('button', { name: /Reintentar/ }));
      assert.equal(attempts.length, 1);
      await clickByName(page, /Reintentar/);
      await page.getByRole('button', { name: 'Abrir Calendario', exact: true }).tap();
      assert.equal(attempts.length, 2);
      assert.equal(attempts[0], attempts[1]);
      assert.equal(sheet.read(tabs.pm).length, knownRows + 1);
      assert.equal(sheet.read(tabs.schedule).filter(row => row[2] === folio).length, 1);
      await page.waitForURL(`${origin}/calendar`);
      const scheduledOrder = page.locator(`button[data-ot="${folio}"]:visible`);
      await visible(scheduledOrder);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await visible(scheduledOrder);
      await scheduledOrder.first().tap();
      await visible(page.getByText('Filtro QA', { exact: true }));
      assert.deepEqual(sheet.read(tabs.schedule).find(row => row[2] === folio).slice(11), ['Día', 'pending', 'Filtro QA']);
      sheet.seed(tabs.schedule, sheet.read(tabs.schedule).filter(row => row[0] !== 'qa-capacity'));
      await noHorizontalOverflow(page, 360);
      return { folio, unit: 'EX401', reloaded: true, confirmationRecovered: true, duplicateSuppressed: true, overloadBeforeSave: true, retainedShiftAndParts: true };
    }));

    await record('MÓVIL-PM-POR-LOTE', () => inRole('coordinador', 360, async page => {
      await page.goto(`${origin}/pm`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      const start = performance.now();
      await clickByName(page, 'Programar por lote');
      await page.getByRole('checkbox', { name: 'Seleccionar DZ203', exact: true }).check();
      await page.getByRole('checkbox', { name: 'Seleccionar EX410', exact: true }).check();
      await page.getByLabel('Horas estimadas de DZ203').fill('2');
      await page.getByLabel('Horas estimadas de EX410').fill('3');
      await page.getByLabel('Fecha programada').fill('2026-12-06');
      await page.getByLabel('Turno').selectOption('Día');
      await page.getByLabel('Disponibilidad de repuestos').selectOption('not_required');
      await clickByName(page, 'Revisar lote');
      await visible(page.getByText('Checklist QA, articulado', { exact: true }));
      await visible(page.getByText('Checklist QA, volquete', { exact: true }));
      const prior = sheet.read(tabs.pm).length;
      const attempts = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/workshop/pmbatch')) attempts.push(request.postDataJSON().mutationId);
      });
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.pm && write.append?.length === 2), when: 'after' });
      await clickByName(page, 'Confirmar 2 órdenes');
      await visible(page.getByRole('button', { name: 'Reintentar el mismo lote' }));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await clickByName(page, 'Reintentar el mismo lote');
      await visible(page.getByText('2 órdenes programadas', { exact: true }));
      const elapsedMs = Math.round(performance.now() - start);
      const batch = sheet.read(tabs.pm).slice(prior);
      assert.deepEqual(attempts, [attempts[0], attempts[0]]);
      assert.equal(new Set(batch.map(row => row[0])).size, 2);
      assert.deepEqual(batch.map(row => [row[2], row[4], row[6]]), [['EX410', 'PM-1000', '420'], ['DZ203', 'PM-500', '1475']]);
      await noHorizontalOverflow(page, 360);
      await shot(page, 'pm-por-lote-360.png');
      await page.getByRole('link', { name: 'Abrir calendario' }).click();
      await page.waitForURL(`${origin}/calendar?fecha=2026-12-06`);
      const scheduledDay = page.locator('section').filter({ has: page.locator('time[datetime="2026-12-06"]') });
      for (const row of batch) await visible(scheduledDay.locator(`button[data-ot="${row[0]}"]:visible`));
      for (const [index, row] of batch.entries()) {
        const otId = row[0];
        await page.goto(`${origin}/workorders/${otId}`, { waitUntil: 'domcontentloaded' });
        await visible(page.getByText(index ? /Vencimiento oficial: 1,500 h/ : /Vencimiento oficial: 440 h/));
        await page.getByText('Datos del checklist', { exact: true }).click();
        await visible(page.getByText(index ? 'Checklist QA, articulado' : 'Checklist QA, volquete', { exact: true }));
      }
      return { units: batch.map(row => row[2]), folios: batch.map(row => row[0]), elapsedMs, recoveredAfterReload: true, distinctChecklists: true };
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
        const photoLink = page.getByRole('link', { name: 'Ver foto' });
        await visible(photoLink);
        const evidence = await page.request.get(origin + await photoLink.getAttribute('href'));
        assert.equal(evidence.status(), 200);
        assert.deepEqual(await evidence.body(), photoPng);
        await changeOrderStatus(page, 'Completado', pmMobileFolio);
        await visible(page.getByText(/Aceptación técnica de /));
        await visible(page.getByRole('group', { name: 'Próximo servicio PM' }).getByText('Próximo servicio sin verificar', { exact: true }));
        await shot(page, 'pm-aceptado-390.png');
      });
      const history = sheet.read(tabs.pmHistory).find(row => row[1] === pmMobileFolio);
      assert.deepEqual([history?.[6], history?.[10]], ['1975', 'Completada']);
      return { folio: pmMobileFolio, meter: history[6], synchronized: true, requiredTaskPhoto: true, unknownNextServiceVisible: true };
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
        await changeOrderStatus(page, 'Resuelta', folio, false, 'Manguera dañada en la OT original QA');
        assert.equal(await page.getByRole('option', { name: 'Completado', exact: true }).count(), 0);
      }, tech);
      await inRole('jefe_taller', 390, async page => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('heading', { name: orderHeading(folio), exact: true }));
        await visible(page.getByText('50%', { exact: true }));
        await changeOrderStatus(page, 'Completado', folio);
      });
      const previousStickers = sheet.read(tabs.sticker);
      const confirmationTab = 'HERMES_PA_CONFIRMACION_OPERATIVA';
      const previousConfirmations = sheet.read(confirmationTab);
      const previousMode = sheet.nativeOperations;
      const conditional = Object.assign(Array(21).fill(''), {
        1: 'STICKER-QA-CONDICIONAL', 2: new Date().toISOString(), 5: 'EX401',
        10: 'aprobado_supervisor', 12: 'amarillo', 13: 'yes', 14: '2099-01-01',
      });
      sheet.seed(tabs.sticker, [...previousStickers, conditional]);
      sheet.seed(confirmationTab, [['UNIDAD'], ['EX401', 'operativo']]);
      sheet.nativeOperations = true;
      try { return await inRole('supervisor', 390, async page => {
        await page.goto(`${origin}/fleet`, { waitUntil: 'domcontentloaded' });
        await page.locator(`a[href="/workorders/${encodeURIComponent(folio)}"]`).first().click();
        await visible(page.getByRole('heading', { name: orderHeading(folio), exact: true }));
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
        await page.route('**/hermes-api/api/panama/documentos-tecnicos?*', route => {
          const params = new URL(route.request().url()).searchParams;
          assert.equal(params.get('unit'), 'EX401');
          return route.fulfill({ json: { documents: [{
            title: 'Manual QA asignado', kind: 'manual', model: 'D65EX-16',
            source: 'Catálogo QA', revision: 'R3', url: 'https://drive.google.com/file/d/fixture/view',
          }] } });
        });
        await page.getByRole('link', { name: 'Manuales de EX401' }).click();
        await page.getByText('Fuente y revisión', { exact: true }).first().click();
        await visible(page.getByText('Catálogo QA · Revisión R3', { exact: true }));
        for (const destination of ['/fleet', '/dashboard']) {
          await page.goto(origin + destination, { waitUntil: 'domcontentloaded' });
          const tile = page.getByRole('button', { name: 'Ver detalle de EX401', exact: true });
          await visible(tile.getByText('Inoperativo', { exact: true }));
          await tile.tap();
          const detail = page.getByRole('dialog', { name: 'Detalle de EX401' });
          await visible(detail.getByText('Inoperativo', { exact: true }));
          await visible(detail.getByText('Sticker STICKER-QA-CONDICIONAL condicionado', { exact: true }));
          await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
        }
        const accepted = JSON.parse(row[22]);
        assert.equal(new Set([JSON.parse(row[20]).userId, JSON.parse(row[21]).userId, accepted.userId]).size, 3);
        return { folio, closedAt: row[14], returnedAt: accepted.returnedAt, progress: 50, cost: 85.25,
          laborHours: 2.25, evidenceLinked: true, separateActors: true, restrictedInFleetAndDashboard: true };
      });
      } finally {
        sheet.nativeOperations = previousMode;
        sheet.seed(tabs.sticker, previousStickers);
        sheet.seed(confirmationTab, previousConfirmations);
      }
    });

    if (withGateway) await record('MÓVIL-TIEMPO-CAÍDO-POR-TURNO', async () => {
      const previousFailures = sheet.read(tabs.failure);
      const previousOrders = sheet.read(tabs.orders);
      const failure = (id, start, cause) => Object.assign(Array(17).fill(''), {
        0: '13/11/2026', 2: 'DZ203', 3: cause, 9: 'Completado', 11: 'Puede moverse: No', 13: id,
        16: start ? JSON.stringify({ stopped: true, startedAt: start }) : '',
      });
      const order = (id, end, folio) => Object.assign(Array(26).fill(''), {
        1: id, 3: 'DZ203', 4: 'Avería', 5: 'Parada sintética QA', 7: 'ALTA', 9: 'Completado', 25: folio,
        20: JSON.stringify({ userId: 'tecnico-sintetico', diagnosis: 'Causa confirmada en QA', functionalTest: 'Prueba funcional QA' }),
        21: JSON.stringify({ userId: 'taller-sintetico', acceptedAt: end }),
        22: JSON.stringify({ userId: 'operaciones-sintetico', decision: 'accepted', returnedAt: end, recordedAt: end }),
      });
      sheet.seed(tabs.failure, [previousFailures[0],
        failure('OT-STOP-QA-A', '2026-11-13T21:30:00Z', 'Hidráulica'),
        failure('OT-STOP-QA-B', '2026-11-13T22:00:00Z', 'Motor'), failure('OT-STOP-QA-C', '', 'Mecánica'),
      ]);
      sheet.seed(tabs.orders, [...previousOrders,
        order('OT-STOP-QA-A', '2026-11-14T00:30:00Z', 'OT-0801'),
        order('OT-STOP-QA-B', '2026-11-14T01:30:00Z', 'OT-0802'),
        order('OT-STOP-QA-C', '2026-11-14T01:30:00Z', 'OT-0803'),
      ]);
      try {
        return await inRole('coordinador', 360, async page => {
          await page.goto(`${origin}/workorders`, { waitUntil: 'domcontentloaded' });
          await dismissPrivacy(page);
          await page.getByRole('link', { name: 'Tiempo caído', exact: true }).click();
          await visible(page.getByRole('heading', { name: 'Tiempo caído por avería' }));
          await page.getByLabel('Desde', { exact: true }).fill('2026-11-13');
          await page.getByLabel('Hasta', { exact: true }).fill('2026-11-13');
          await page.getByLabel('Unidad', { exact: true }).fill('dz203');
          await clickByName(page, 'Consultar');
          const summary = page.getByRole('region', { name: 'Resumen de tiempo caído' });
          await visible(summary.getByText('4 h 0 min', { exact: true }));
          await visible(summary.getByText(/1 parada medida/));
          const shifts = page.getByRole('list', { name: 'Horas por turno' });
          await visible(shifts.getByText('1 h 30 min', { exact: true }));
          await visible(shifts.getByText('2 h 30 min', { exact: true }));
          const pending = page.getByRole('region', { name: 'Paradas pendientes de confirmar' });
          await visible(pending.getByText('DZ203 · OT-0803', { exact: true }));
          assert.equal(await page.getByRole('link', { name: 'OT-0801', exact: true }).getAttribute('href'), '/workorders/OT-0801');
          assert.equal(await page.getByRole('link', { name: 'OT-0802', exact: true }).getAttribute('href'), '/workorders/OT-0802');
          await noHorizontalOverflow(page, 360);
          await shot(page, 'tiempo-caido-360.png');
          await page.getByRole('link', { name: 'OT-0801', exact: true }).click();
          await visible(page.getByRole('heading', { name: 'OT-0801', exact: true }));
          return { intervals: 1, hours: 4, day: 1.5, night: 2.5, unmeasuredExcluded: 1, orderLink: true, width: 360 };
        });
      } finally {
        sheet.seed(tabs.failure, previousFailures);
        sheet.seed(tabs.orders, previousOrders);
      }
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
        await visible(page.locator(`button[data-ot="${folio}"]:visible`));
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
        await page.getByLabel('Observaciones', { exact: true }).fill(note);
        await page.locator('input[type=file]:not([capture])').last().setInputFiles({ name: 'dvir-sintetico.png', mimeType: 'image/png', buffer: photoPng });
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
        const card = page.locator(`[data-ot="${result.folio}"]`).first();
        await visible(card);
        await card.click();
        await visible(page.getByRole('heading', { name: orderHeading(result.folio), exact: true }));
        return { ...result, visibleForCoordinator: true };
      });
    });

    await record('MÓVIL-STICKER-REVISIÓN', async () => {
      const folio = await inRole('operador', 360, async page => {
        await page.goto(`${origin}/sticker-inspection`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Unidad', { exact: true }).selectOption('EX401');
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
        await page.locator('details').filter({ hasText: `Folio ${folio}` }).locator('summary').first().tap();
        await clickByName(page, 'Aprobar revisión');
        await visible(page.getByRole('button', { name: 'Imprimir / guardar sticker', exact: true }));
        const approved = sheet.read(tabs.sticker).find(row => row[1] === folio);
        assert.deepEqual([approved[10], approved[13]], ['aprobado_supervisor', 'yes']);
        assert(approved[18] && approved[19] && approved[18] !== approved[19]);
        await shot(page, 'sticker-aprobado-390.png');
        return { folio, unit: 'EX401', approved: true, canDispatch: true };
      }, firstAccount('supervisor'));
    });

    await record('MÓVIL-OT-REINCIDENCIA-EVIDENCIA', async () => {
      assert(filed, 'Falta la OT original');
      const original = sheet.read(tabs.orders).find(row => row[1] === filed.folio);
      assert.equal(original?.[9], 'Completado');
      const description = 'Falla reincidente con evidencia QA';
      const recurrent = await inRole('operador', 390, async page => {
        await fillFailure(page, description, true, original[3], original[1]);
        await clickByName(page, 'Confirmar');
        await visible(page.getByText(/OT creada/i));
        const row = sheet.read(tabs.orders).find(order => order[5] === description);
        assert.equal(row[24], original[1]);
        assert.equal(sheet.read(tabs.failure).find(failure => failure[13] === row[1])?.[7], '1-4 horas');
        return row;
      });
      const second = loadAccounts.filter(account => account.membership.role === 'mecanico')[5];
      await inRole('coordinador', 390, async page => {
        await readOrder(page, recurrent[1], description);
        const image = page.getByRole('img', { name: 'Foto 1', exact: true });
        assert.equal(await image.getAttribute('src'), recurrent[10]);
        assert.deepEqual(await (await page.request.get(origin + recurrent[10])).body(), photoPng);
      });
      await inRole('jefe_taller', 390, async page => {
        await readOrder(page, recurrent[1], description);
        await visible(page.getByText(recurrent[2], { exact: true }));
        const evidence = page.getByRole('img', { name: 'Foto 1', exact: true });
        assert.equal(await evidence.getAttribute('src'), recurrent[10]);
        assert.deepEqual(await (await page.request.get(origin + recurrent[10])).body(), photoPng);
        await page.getByLabel('Mecánico asignado').selectOption(second.user.id);
        await clickByName(page, 'Asignar');
        await waitUntil(() => sheet.read(tabs.orders).find(order => order[1] === recurrent[1] && order[17] === second.user.id), 'La OT nueva no cambió de técnico');
        await page.getByRole('link', { name: `Reincidencia de ${original[1]}`, exact: true }).tap();
        await visible(page.getByRole('heading', { name: orderHeading(original[1]), exact: true }));
        await visible(page.getByText(filed.description, { exact: true }));
        await visible(page.getByText(/Manguera dañada en la OT original QA/));
        await visible(page.getByText(`Cierre ${original[14]}`, { exact: true }));
        assert.equal(await evidence.getAttribute('src'), original[10]);
        assert.deepEqual(await (await page.request.get(origin + original[10])).body(), photoPng);
      });
      return inRole('mecanico', 390, async page => {
        await readOrder(page, recurrent[1], description);
        await visible(page.getByText('OT anterior disponible para Taller y Coordinación.', { exact: true }));
        assert.equal(await page.getByRole('link', { name: /Reincidencia de/ }).count(), 0);
        return { previous: original[1], recurrent: recurrent[1], evidenceFromBoth: true, priorKeptScoped: true, coordinatorPhotoAfterReload: true };
      }, second);
    });

    await record('MÓVIL-VIDA-COMPONENTE-POR-POSICIÓN', () => inRole('gerencia', 390, async page => {
      const { dispatchPanama } = await import(pathToFileURL(resolve(fixture.repoDirectory, 'api/_lib/hermes-panama.js')).href);
      await page.route('**/hermes-api/api/panama/componentes?*', async route => {
        const unit = new URL(route.request().url()).searchParams.get('unit');
        const result = await dispatchPanama({
          method: 'GET', path: 'api/panama/componentes', query: { unit },
          session: { project: 'tmf-panama', role: 'gerencia', allUnits: true },
          read: async spec => spec.key === 'dozerLife' ? [
            ['Equipo','Pieza','Lado','Vida','UltHor','HorAct','Usadas','Restantes','Estado'],
            ['DZ203','CADENA','Izquierdo','2,000','3,010.5','4,211.75','1,201.25','798.75','Vigente'],
            ['DZ203','CADENA','Derecho','2,000','4,100','4,211.75','100','1,900','Vigente'],
          ] : [],
        });
        await route.fulfill({ status: result.status, json: result.body });
      });
      await page.goto(`${origin}/panama`, { waitUntil: 'domcontentloaded' });
      const history = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Historial y vida de componentes' }) });
      await history.getByLabel('Código de equipo').fill('DZ203');
      await history.getByRole('button', { name: 'Consultar componentes' }).tap();
      const left = history.getByRole('listitem').filter({ hasText: 'CADENA · Izquierdo' });
      const right = history.getByRole('listitem').filter({ hasText: 'CADENA · Derecho' });
      await visible(left.getByText(/Restantes 798\.75/));
      await visible(right.getByText(/Restantes 1,900/));
      await visible(right.getByText(/Difiere del maestro.*111[.,]75 h de uso/));
      await noHorizontalOverflow(page, 390);
      return { unit: 'DZ203', retainedMaster: true, isolatedByPosition: true, recalculatedRemainingHours: 1888.25 };
    }, loadAccounts[77]));

    if (withGateway) await record('MÓVIL-INTERVENCIONES-DE-COMPONENTES', async () => {
      const technician = firstAccount('mecanico');
      const reviewer = firstAccount('jefe_taller');
      const priorOrders = sheet.read(tabs.orders);
      const priorLogs = sheet.read(tabs.history);
      const folios = ['OT-0841', 'OT-0842', 'OT-0843'];
      const ids = ['OT-COMP-QA-A', 'OT-COMP-QA-B', 'OT-COMP-QA-C'];
      sheet.seed(tabs.orders, [...priorOrders, ...folios.map((folio, index) => Object.assign(Array(26).fill(''), {
        1: ids[index], 3: 'DZ203', 4: 'Avería', 5: 'Intervención sintética de cadena QA', 7: 'MEDIA', 9: 'Completado',
        17: technician.user.id, 18: 'version-componente-' + index,
        20: JSON.stringify({ userId: technician.user.id, userName: technician.membership.user_name, functionalTest: 'Prueba funcional QA' }),
        21: JSON.stringify({ userId: reviewer.user.id, userName: reviewer.membership.user_name, acceptedAt: '2026-11-13T15:00:00.000Z' }),
        25: folio,
      }))]);
      try {
        return await inRole('jefe_taller', 360, async page => {
          async function recordWork(index, action, meter, previous, retained) {
            await page.goto(`${origin}/workorders/${folios[index]}`, { waitUntil: 'domcontentloaded' });
            await dismissPrivacy(page);
            await visible(page.getByRole('heading', { name: orderHeading(folios[index]), exact: true }));
            const box = page.locator('details').filter({ has: page.getByText('Intervenciones de componentes', { exact: true }) });
            await box.locator('summary').click();
            await box.getByLabel('Tipo de intervención').selectOption(action);
            await box.getByLabel('Componente', { exact: true }).selectOption('Cadena');
            await box.getByLabel('Posición', { exact: true }).selectOption('Izquierda');
            await box.getByLabel('Horómetro acumulado al intervenir').fill(meter);
            if (previous) await box.getByLabel(/Horas anteriores al trabajo/).fill(previous);
            if (retained) await box.getByLabel('Horas que conserva la reconstrucción').fill(retained);
            await box.getByLabel('Trabajo realizado').fill('Intervalo de vida comprobado en QA');
            await box.getByLabel('Referencia del respaldo').fill('Acta sintética QA');
            if (index === 1) {
              sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.history && write.append?.[0]?.[2] === 'intervencion_componente'), when: 'after' });
            }
            await clickByName(page, 'Guardar intervención');
            if (index === 1) {
              await visible(page.getByRole('button', { name: 'Reintentar registro' }));
              await page.reload({ waitUntil: 'domcontentloaded' });
            }
            await visible(box.getByText('Intervención guardada.', { exact: true }));
            await visible(box.getByText(/Vida arrastrada/));
            assert.equal(sheet.read(tabs.history).filter(row => row[1] === ids[index] && row[2] === 'intervencion_componente').length, 1);
            await noHorizontalOverflow(page, 360);
          }
          await recordWork(0, 'new', '4000', '650');
          await recordWork(1, 'partial', '4220.25');
          await recordWork(2, 'rebuild', '4500.50', undefined, '140');
          await page.goto(`${origin}/panama`, { waitUntil: 'domcontentloaded' });
          const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Historial y vida de componentes' }) });
          await section.getByLabel('Código de equipo').fill('DZ203');
          await section.getByRole('button', { name: 'Consultar componentes' }).tap();
          const rows = section.getByRole('list', { name: 'Intervenciones de componentes' });
          await visible(rows.getByText(/Instalación nueva/));
          await visible(rows.getByText(/Cambio parcial/));
          await visible(rows.getByText(/Reconstrucción/));
          await visible(rows.getByText(/Vida arrastrada 220[.,]25 h/));
          await visible(rows.getByText('Vida arrastrada 140 h', { exact: true }));
          await visible(rows.getByRole('link', { name: 'Anterior OT-0842', exact: true }));
          await noHorizontalOverflow(page, 360);
          await rows.scrollIntoViewIfNeeded();
          await shot(page, 'intervenciones-360.png');
          await rows.getByRole('link', { name: 'Anterior OT-0842', exact: true }).click();
          await visible(page.getByRole('heading', { name: 'OT-0842', exact: true }));
          return { unit: 'DZ203', folios, carriedHours: [0, 220.25, 140], retryDidNotDuplicate: true, orderLink: true, width: 360 };
        }, reviewer);
      } finally {
        sheet.seed(tabs.orders, priorOrders);
        sheet.seed(tabs.history, priorLogs);
      }
    });

    if (withGateway) await record('MÓVIL-LLANTAS-NÚMERO-DE-FUEGO', async () => {
      const tab = '13 Neumáticos';
      const previous = sheet.read(tab);
      sheet.seed(tab, [['ID','UNIDAD','MODELO','POSICIÓN']]);
      try {
        return await inRole('coordinador', 360, async page => {
          await page.goto(`${origin}/neumaticos`, { waitUntil: 'domcontentloaded' });
          await dismissPrivacy(page);
          await visible(page.getByRole('heading', { name: 'Neumáticos por número de fuego' }));
          await page.getByLabel('Serie o número de fuego').fill('FUEGO-QA-37');
          await clickByName(page, 'Consultar');
          await clickByName(page, 'Montar');
          let form = page.getByRole('form', { name: 'Montar' });
          await form.getByLabel(/Unidad de destino/).selectOption('DZ203');
          await form.getByLabel(/Posición de destino/).selectOption('I1');
          await form.getByLabel(/Medida del equipo/).selectOption('h');
          await form.getByLabel(/Lectura acumulada/).fill('1000');
          await form.getByLabel(/Costo de adquisición/).fill('850');
          await form.getByLabel(/Moneda/).selectOption('USD');
          await form.getByLabel(/Factura o comprobante/).fill('Factura QA-37');
          await form.getByRole('button', { name: 'Guardar' }).click();
          await visible(page.getByText('Montaje', { exact: true }));
          await clickByName(page, 'Inspeccionar');
          form = page.getByRole('form', { name: 'Inspeccionar' });
          await form.getByLabel(/Lectura acumulada/).fill('1050');
          await form.getByLabel('Presión (PSI)').fill('0');
          await form.getByLabel('Profundidad (mm)').fill('11.5');
          await form.getByRole('button', { name: 'Guardar' }).click();
          await visible(page.getByText(/Presión 0 PSI/));
          await clickByName(page, 'Trasladar o rotar');
          form = page.getByRole('form', { name: 'Trasladar o rotar' });
          await form.getByLabel(/Unidad de destino/).selectOption('DZ205');
          await form.getByLabel(/Posición de destino/).selectOption('D2');
          await form.getByLabel(/Lectura acumulada de origen/).fill('1100');
          await form.getByLabel(/Lectura acumulada de destino/).fill('600');
          await form.getByLabel(/Medida del destino/).selectOption('h');
          sheet.failNext({ matches: writes => writes.some(write => write.tab === tab), when: 'after' });
          await form.getByRole('button', { name: 'Guardar' }).click();
          await visible(page.getByRole('button', { name: 'Reintentar guardado' }));
          await page.reload({ waitUntil: 'domcontentloaded' });
          await clickByName(page, 'Reintentar guardado');
          await visible(page.getByText('Origen DZ203 · I1', { exact: true }));
          await visible(page.getByText('Destino DZ205 · D2', { exact: true }));
          await clickByName(page, 'Inspeccionar');
          form = page.getByRole('form', { name: 'Inspeccionar' });
          await form.getByLabel(/Lectura acumulada/).fill('640');
          await form.getByLabel('Presión (PSI)').fill('105');
          await form.getByLabel('Profundidad (mm)').fill('10');
          await form.getByRole('button', { name: 'Guardar' }).click();
          await visible(page.getByText('140 h', { exact: true }));
          await visible(page.getByText(/USD 6[.,]0714\/h/));
          assert.equal(sheet.read(tab).filter(row => row[7] === 'FUEGO-QA-37').length, 4);
          await noHorizontalOverflow(page, 360);
          await shot(page, 'llantas-360.png');
          return { serial: 'FUEGO-QA-37', unit: 'DZ205', position: 'D2', usage: 140, rate: 6.0714, events: 4, persistedRetry: true, width: 360 };
        });
      } finally { sheet.seed(tab, previous); }
    });

    if (withGateway) await record('MÓVIL-GARANTÍAS-Y-RECLAMOS', async () => {
      const otId = 'OT-GARANTIA-QA';
      const folio = 'OT-0891';
      const orders = sheet.read(tabs.orders);
      const logs = sheet.read(tabs.warranties);
      const row = Object.assign(Array(26).fill(''), { 1: otId, 2: '14/11/2026', 3: 'DZ203', 4: 'Avería',
        5: 'Prueba de garantía', 7: 'MEDIA', 9: 'Completado', 18: 'garantia-version-qa', 25: folio });
      sheet.seed(tabs.orders, [...orders, row]);
      let claimLink;
      let recoveryLink;
      const caseBox = page => page.locator('details').filter({ has: page.getByText('Garantías y reclamos', { exact: true }) });
      async function visit(page) {
        await page.goto(`${origin}/workorders/${folio}`, { waitUntil: 'domcontentloaded' });
        await dismissPrivacy(page);
        await visible(page.getByRole('heading', { name: orderHeading(folio), exact: true }));
        const box = caseBox(page);
        await box.locator('summary').click();
        return box;
      }

      try {
        await inRole('coordinador', 360, async page => {
          const box = await visit(page);
          await clickByName(page, 'Agregar cobertura');
          let form = box.getByRole('form', { name: 'Agregar cobertura' });
          await form.getByLabel('Proveedor').fill('Proveedor QA');
          await form.getByLabel('Componente o equipo').fill('Bomba hidráulica');
          await form.getByLabel('Documento de garantía').fill('FACT-QA-38');
          await form.getByLabel('Inicio de vigencia').fill('2026-08-01');
          await form.getByLabel('Fin de vigencia').fill('2026-07-14');
          await form.getByRole('button', { name: 'Guardar', exact: true }).click();
          await visible(box.getByText('El fin de la garantía debe ser igual o posterior al inicio'));
          assert.equal(await form.getByLabel('Proveedor').inputValue(), 'Proveedor QA');
          await form.getByLabel('Fin de vigencia').fill('2026-11-14');
          await form.getByRole('button', { name: 'Guardar', exact: true }).click();
          await visible(box.getByText(/Dentro de vigencia/));

          await clickByName(page, 'Registrar reclamo');
          form = box.getByRole('form', { name: 'Registrar reclamo' });
          await form.getByLabel('Folio del reclamo').fill('REC-QA-38');
          await form.getByLabel('Evidencia (foto o PDF)').setInputFiles({ name: 'bomba.png', mimeType: 'image/png', buffer: photoPng });
          sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.warranties), when: 'after' });
          await form.getByRole('button', { name: 'Guardar', exact: true }).click();
          await visible(box.getByRole('button', { name: 'Reintentar guardado' }));
          assert.equal(sheet.read(tabs.warranties).filter(log => log[1] === otId).length, 2, 'El reclamo debe quedar confirmado en el registro');
          await page.reload({ waitUntil: 'domcontentloaded' });
          try {
            await visible(box.getByText('Reclamo REC-QA-38', { exact: true }));
          } catch (error) {
            const diagnosis = await box.innerText({ timeout: 2000 }).catch(() => '');
            throw new Error(`${error.message} · Garantías: ${diagnosis}`);
          }
          const evidence = box.getByRole('link', { name: 'Ver evidencia 1' });
          claimLink = origin + await evidence.getAttribute('href');
          const attachment = await page.request.get(claimLink);
          assert.equal(attachment.status(), 200);
          assert.deepEqual(await attachment.body(), photoPng);

          await clickByName(page, 'Registrar dictamen');
          form = box.getByRole('form', { name: 'Registrar dictamen' });
          await form.getByLabel('Referencia del dictamen').fill('DICT-QA-38');
          await form.getByLabel('Resultado del dictamen').selectOption('partial');
          await form.getByRole('button', { name: 'Guardar', exact: true }).click();
          await visible(box.getByText('Aprobado parcialmente · Dictamen DICT-QA-38', { exact: true }));
          assert.equal(await box.getByRole('button', { name: 'Registrar recuperación' }).count(), 0);
          await noHorizontalOverflow(page, 360);
        }, firstAccount('coordinador'));

        await inRole('gerencia', 360, async page => {
          const box = await visit(page);
          await clickByName(page, 'Registrar recuperación');
          const form = box.getByRole('form', { name: 'Registrar recuperación' });
          await form.getByLabel('Comprobante de recuperación').fill('NC-QA-38');
          await form.getByLabel('Monto recuperado').fill('125.25');
          await form.getByLabel('Moneda').selectOption('USD');
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF();
          pdf.text('NC-QA-38', 15, 20);
          const proof = Buffer.from(pdf.output('arraybuffer'));
          await form.getByLabel('Evidencia (foto o PDF)').setInputFiles({ name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: proof });
          await form.getByRole('button', { name: 'Guardar', exact: true }).click();
          await visible(box.getByText('Monto recuperado', { exact: true }));
          await visible(box.getByText(/^USD\s+125\.25$/));
          const receiptLink = box.getByRole('link', { name: 'Ver evidencia 1' }).last();
          recoveryLink = origin + await receiptLink.getAttribute('href');
          const receipt = await page.request.get(recoveryLink);
          assert.equal(receipt.status(), 200);
          assert.equal(receipt.headers()['content-type'], 'application/pdf');
          assert.deepEqual(await receipt.body(), proof);
          await noHorizontalOverflow(page, 360);
          await box.getByText('Monto recuperado', { exact: true }).scrollIntoViewIfNeeded();
          await shot(page, 'garantias-360.png');
        }, firstAccount('gerencia'));

        await inRole('coordinador', 360, async page => {
          const box = await visit(page);
          await visible(box.getByText('Recuperación registrada por Gerencia'));
          assert.equal(await box.getByText(/125[.,]25/).count(), 0);
          assert.equal((await page.request.get(recoveryLink)).status(), 404);
          const raw = await page.request.get(origin + '/hermes-api/api/sheets/read?tab=OT_STATUS_LOG');
          assert.equal(raw.status(), 200);
          assert(!(await raw.text()).includes('NC-QA-38'));
          const privateLedger = await page.request.get(origin + '/hermes-api/api/sheets/read?tab=HERMES_PA_GARANTIAS');
          assert.equal(privateLedger.status(), 403);
        }, firstAccount('coordinador'));

        const events = sheet.read(tabs.warranties).filter(log => log[1] === otId && log[2] === 'garantia_ot');
        assert.deepEqual(events.map(log => JSON.parse(log[4]).action), ['coverage', 'claim', 'decision', 'recovery']);
        return { folio, width: 360, recovered: 'USD 125.25', calendarCoverage: true, privateEvidence: true,
          recoveryRestricted: true, retryDidNotDuplicate: true, events: events.length };
      } finally {
        sheet.seed(tabs.orders, orders);
        sheet.seed(tabs.warranties, logs);
      }
    });

    await record('MÓVIL-TABLERO-EXCEPCIONES', async () => {
      const prior = sheet.read(tabs.orders);
      const id = 'OT-EXCEPTION-QA';
      const row = Object.assign(Array(26).fill(''), { 1: id, 2: '14/11/2026', 3: 'DZ203', 4: 'PM', 5: 'Excepción sintética QA',
        7: 'CRITICA', 8: 'Mecánico QA', 9: 'En Reparación', 23: JSON.stringify({ dueAt: 1500 }), 25: 'OT-0892' });
      sheet.seed(tabs.orders, [...prior, row]);
      try {
        return await inRole('gerencia', 360, async page => {
          await page.goto(`${origin}/dashboard`, { waitUntil: 'domcontentloaded' });
          await dismissPrivacy(page);
          const box = page.getByRole('region', { name: 'Excepciones de Taller' });
          const link = box.getByRole('link', { name: /OT-0892/ });
          const refresh = box.getByRole('button', { name: 'Actualizar excepciones' });
          await visible(link);
          assert.match(await link.getAttribute('href'), /^\/workorders\/OT-(?:EXCEPTION-QA|0892)$/);
          await visible(box.getByText(/Mecánico QA/));
          await visible(box.getByText(/1[,.]?500 h/));
          await noHorizontalOverflow(page, 360);
          await box.scrollIntoViewIfNeeded();
          await shot(page, 'excepciones-360.png');

          sheet.setUnavailable([tabs.orders], true);
          const failed = page.waitForResponse(response => response.url().endsWith('/api/workshop/exceptions'));
          await refresh.click();
          assert.equal((await failed).status(), 503);
          await visible(link);

          sheet.setUnavailable([tabs.orders], false);
          const closed = [...row];
          closed[9] = 'Completado';
          sheet.seed(tabs.orders, [...prior, closed]);
          await refresh.click();
          await link.waitFor({ state: 'hidden' });
          return { folio: 'OT-0892', owner: 'Mecánico QA', dueAtHours: 1500, preservedDuringReadFailure: true,
            closedAfterSourceConfirmation: true, width: 360 };
        });
      } finally {
        sheet.setUnavailable([tabs.orders], false);
        sheet.seed(tabs.orders, prior);
      }
    });

    if (!withPurchasing) return [...external];
    const browserBuyer = loadAccounts.find(account => account.membership.can_approve_purchases === true);
    const browserWarehouse = loadAccounts.find(account => account.membership.can_receive_purchases === true);
    const browserAccounting = loadAccounts.find(account => account.membership.can_record_purchase_invoices === true);
    const browserTreasury = loadAccounts.find(account => account.membership.can_record_purchase_payments === true);

    await record('MÓVIL-COMPRAS-BANDEJAS-POR-PUESTO', async () => {
      const positions = [
        [browserBuyer, 'gerencia', '/pedidos', 'Pedidos de Refacciones'],
        [browserWarehouse, 'jefe_taller', '/panama/recepciones', 'Recepciones de compras'],
        [browserAccounting, 'gerencia', '/panama/cuentas-por-pagar?bandeja=conciliar#facturas', 'Cuentas por pagar'],
        [browserTreasury, 'gerencia', '/panama/cuentas-por-pagar?bandeja=pagar#facturas', 'Cuentas por pagar'],
      ];
      const results = [];
      for (const [index, [account, role, path, heading]] of positions.entries()) {
        const width = index % 2 === 0 ? 360 : 390;
        await inRole(role, width, async page => {
          assert.equal(page.url(), origin + path);
          await visible(page.getByRole('heading', { name: heading, exact: true }));
          if (account === browserBuyer) {
            const main = page.getByRole('main');
            await visible(main.getByRole('link', { name: 'Comparar cotizaciones', exact: true }).first());
            await visible(main.getByRole('link', { name: 'Órdenes de compra', exact: true }));
          }
          if (account === browserWarehouse) {
            assert.equal(await page.getByRole('button', { name: 'Por recibir', exact: true }).getAttribute('aria-pressed'), 'true');
          }
          if (account === browserAccounting) await visible(page.getByRole('heading', { name: 'Por conciliar', exact: true }));
          if (account === browserTreasury) {
            await visible(page.getByRole('heading', { name: 'Por pagar', exact: true }));
            assert.equal(await page.getByRole('combobox', { name: 'Estado' }).inputValue(), 'open');
          }
          await noHorizontalOverflow(page, width);
          results.push({ path, width });
        }, account, '', true);
      }
      return { results };
    });

    await record('MÓVIL-OT-RESERVA Y COTIZACIÓN A OC', async () => {
      const ot = 'OT-3104';
      const item = 'Filtro hidráulico';
      const availablePart = 'HF-204';
      const warehouse = 'Almacén Central';
      const suppliers = ['Repuestos del Istmo', 'Suministros del Pacífico'];
      const date = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const requiredDate = date(2);
      const movementsTab = 'Movimientos Repuestos PA';
      const snapshots = new Map([tabs.orders, tabs.requests, tabs.parts, tabs.changes, tabs.providers, movementsTab]
        .map(tab => [tab, sheet.read(tab)]));
      const width = 390;
      const time = {};
      try {
        sheet.seed(tabs.orders, [...snapshots.get(tabs.orders),
          ['M-1042', ot, '12/11/2026', 'DZ203', 'Mecánica', 'Falla hidráulica', 'CRITICA', 'CRITICA', '', 'En Reparación']]);
        const vendors = snapshots.get(tabs.providers).map(row => [...row]);
        vendors[1][0] = suppliers[0];
        vendors[2][0] = suppliers[1];
        sheet.seed(tabs.providers, vendors);
        const catalog = snapshots.get(tabs.parts).map(row => [...row]);
        catalog[4][14] = 'Almacén';
        const stockRow = [...catalog.find(row => row[0] === 'QA-001')];
        stockRow[0] = availablePart;
        stockRow[1] = 'Filtro de presión';
        stockRow[2] = 'OEM-HF-204';
        stockRow[14] = warehouse;
        catalog.push(stockRow);
        sheet.seed(tabs.parts, catalog);
        const openPart = async (page, part) => {
          await page.goto(origin + '/workorders/' + ot, { waitUntil: 'domcontentloaded' });
          await clickByName(page, 'Pedir repuestos');
          const details = page.locator('section').filter({ has: page.getByRole('button', { name: 'Pedir repuestos', exact: true }) });
          await visible(details.getByText(/Equipo DZ203/));
          assert.equal(await details.getByText(/Serie QA-DZ203/).isVisible(), false);
          await details.getByText('Datos de la OT', { exact: true }).click();
          await visible(details.getByText(/Serie QA-DZ203/));
          await details.getByText('Datos de la OT', { exact: true }).click();
          await page.getByLabel('Número de parte o SKU').fill(part);
          await clickByName(page, 'Ver existencias');
        };
        await inRole('jefe_taller', width, async page => {
          const started = Date.now();
          await openPart(page, availablePart);
          await visible(page.getByText('Libre', { exact: true }));
          await visible(page.getByText('Reservado', { exact: true }));
          await visible(page.getByText('En tránsito', { exact: true }));
          await page.getByLabel('Cantidad requerida').fill('2');
          await page.getByLabel('Fecha requerida').fill(requiredDate);
          await page.getByLabel('Referencia de reserva').fill('R-1042');
          await clickByName(page, 'Reservar para la OT');
          await visible(page.getByText('2 reservadas en Almacén Central.', { exact: true }));
          const movements = sheet.read(movementsTab);
          assert.equal(movements.filter(row => row.includes(ot) && row.some(value => value.includes('R-1042'))).length, 1);
          assert.deepEqual(sheet.read(tabs.requests), snapshots.get(tabs.requests));
          await noHorizontalOverflow(page, width);
          await shot(page, 'compra-ot-reserva-390.png');
          time.reserva = Date.now() - started;
        }, browserWarehouse);
        await inRole('jefe_taller', 360, async page => {
          const started = Date.now();
          await openPart(page, 'HF-310');
          await visible(page.getByText('Sin stock compatible verificado.'));
          await page.getByLabel('Cantidad requerida').fill('1');
          await page.getByLabel('Fecha requerida').fill(requiredDate);
          await page.getByLabel('Descripción del repuesto').fill(item);
          await clickByName(page, 'Enviar pedido a Compras');
          await visible(page.getByText('Pedido enviado a Compras.', { exact: true }));
          await noHorizontalOverflow(page, 360);
          time.pedido = Date.now() - started;
        }, loadAccounts.find(account => account.membership.role === 'jefe_taller' && !account.membership.can_receive_purchases));
        const request = sheet.read(tabs.requests).find(row => row[2] === item);
        assert(request, 'Falta el pedido persistido desde la OT');
        await inRole('gerencia', width, async page => {
          const started = Date.now();
          const row = page.getByRole('listitem').filter({ has: page.getByText(item, { exact: true }) });
          await visible(row.getByRole('link', { name: ot, exact: true }));
          assert.equal(await row.getByText(/Serie QA-DZ203/).isVisible(), false);
          await row.getByText('Detalles del pedido', { exact: true }).click();
          await visible(row.getByText(/Serie QA-DZ203/));
          await row.getByRole('link', { name: 'Comparar cotizaciones', exact: true }).tap();
          await page.waitForURL(new RegExp(origin.replaceAll('.', '\\.') + '/panama/comparar-cotizaciones\\?partida='));
          const forms = [page.getByRole('group', { name: 'Cotización 1', exact: true }), page.getByRole('group', { name: 'Cotización 2', exact: true })];
          for (const [index, group] of forms.entries()) {
            const supplier = group.getByRole('combobox', { name: 'Proveedor', exact: true });
            assert.ok((await supplier.locator('option').allTextContents()).every(label => !label.includes('QAT')));
            await supplier.selectOption({ label: suppliers[index] });
            await group.getByLabel('Referencia', { exact: true }).fill('COT-' + (1042 + index));
            await group.getByLabel('Cantidad ofrecida', { exact: true }).fill('1');
            await group.getByLabel('Precio unitario', { exact: true }).fill(index === 0 ? '100.00' : '125.00');
            await group.getByLabel('Flete total', { exact: true }).fill('0.00');
            await group.getByLabel('Entrega prometida', { exact: true }).fill(date(index === 0 ? 5 : 2));
            await group.getByText('Garantía y otros cargos', { exact: true }).click();
            await group.getByLabel('Garantía', { exact: true }).fill('90 días');
            await group.getByRole('combobox', { name: 'Compatibilidad', exact: true }).selectOption('confirmed');
            await group.getByLabel('Respaldo de compatibilidad').fill('Verificado con serie QA-DZ203');
          }
          await visible(forms[0].getByText('Menor costo puesto en obra', { exact: true }));
          await page.locator('summary').filter({ hasText: /^Costo del paro$/ }).click();
          await page.getByLabel(/Costo por hora/).fill('100.00');
          await page.getByLabel('Horas de paro por día de atraso').fill('10');
          await page.getByLabel('Referencia del costo por hora').fill('Costo piloto QA · 100 USD/h');
          await visible(forms[1].getByText('Menor costo con paro', { exact: true }));
          await noHorizontalOverflow(page, width);
          await shot(page, 'compra-ot-cotizaciones-390.png');
          await page.reload({ waitUntil: 'domcontentloaded' });
          await visible(forms[1].getByText('Menor costo con paro', { exact: true }));
          await forms[1].getByRole('button', { name: 'Elegir cotización', exact: true }).tap();
          await page.getByLabel('Motivo de selección').fill('Disponibilidad para evitar tres días adicionales de paro.');
          await page.getByRole('link', { name: 'Preparar OC', exact: true }).tap();
          await page.waitForURL(new RegExp('/admin/ordenes-compra\\?partida='));
          const order = page.locator('form').first();
          const selectedSupplier = order.getByLabel('Proveedor', { exact: true }).locator('option:checked');
          await waitUntil(async () => (await selectedSupplier.textContent())?.trim() === suppliers[1],
            'El borrador de la OC no recuperó el proveedor de la cotización.');
          assert.equal(await order.getByLabel('Precio unitario 1', { exact: true }).inputValue(), '125.00');
          assert.equal(await order.getByLabel('Fecha de entrega').inputValue(), requiredDate);
          assert.equal(sheet.read(tabs.lines).some(line => line[2] === item), false);
          time.cotizaciones = Date.now() - started;
        }, browserBuyer, '', true);
        return { ot, requiredDate, reservedWithoutPurchase: true, quoteDraftNotCommitted: true, automatedScenarioMs: time };
      } finally {
        for (const [tab, rows] of snapshots) {
          if (tab === movementsTab && rows.length === 0) {
            const [header] = sheet.read(tab);
            if (header) sheet.seed(tab, [header]);
          } else {
            sheet.seed(tab, rows);
          }
        }
      }
    });

    await record('MÓVIL-PEDIDOS-AMBAS-FUENTES', () => inRole('gerencia', 390, async page => {
      const oldRows = sheet.read(tabs.requests);
      const prefix = 'PED-QA-FUENTES';
      sheet.seed(tabs.requests, [oldRows[0], [
        '14/11/2026', 'SELLO-QA', 'Sello solicitado en Hermes', 'DZ203', '2', 'Manual',
        'Pendiente', '', '', prefix, '08:10', 'Taller QA', 'Normal', '', '20', `${prefix}-L1`,
      ]]);
      let available = true;
      let slow = false;
      const sources = [{ id: '88', unit: 'EX401', description: 'Filtro pendiente en el Maestro', status: 'Recepción parcial', order: 'OC-QA-88', amount: '85', currency: 'USD' },
        { id: '89', unit: 'DZ203', description: 'Compra entregada en el Maestro', status: 'Entregada' },
        { id: '90', unit: 'DZ203', description: 'Compra cancelada en el Maestro', status: 'Cancelada' }];
      const summary = /\/hermes-api\/api\/panama\/summary\?sections=purchases$/;
      await page.route(summary, async route => {
        if (slow) await sleep(300);
        await route.fulfill({ json: { project: 'tmf-panama', sections: { purchases: available ? sources : null },
          snapshots: available ? { purchases: '2026-11-14T13:21:18Z' } : {} } });
      });
      try {
        await page.goto(`${origin}/pedidos`, { waitUntil: 'domcontentloaded' });
        const list = page.getByRole('list', { name: 'Pedidos', exact: true });
        const fromHermes = list.getByRole('listitem').filter({ hasText: 'Sello solicitado en Hermes' });
        const fromMaster = list.getByRole('listitem').filter({ hasText: 'Filtro pendiente en el Maestro' });
        await visible(fromHermes.getByText('Hermes', { exact: true }));
        await visible(fromMaster.getByText('Maestro de Compras', { exact: true }));
        await visible(fromMaster.getByText('OC-QA-88', { exact: false }));
        assert.equal(await fromMaster.getByRole('link', { name: /Convertir a OC|Ver OC/ }).count(), 0);
        assert.equal(await fromMaster.getByRole('button', { name: /Marcar/ }).count(), 0);
        assert.equal(await list.getByText(/Compra entregada|Compra cancelada/).count(), 0);
        await clickByName(page, 'Historial');
        await visible(list.getByText('Compra entregada en el Maestro', { exact: true }));
        await visible(list.getByText('Compra cancelada en el Maestro', { exact: true }));
        available = false;
        slow = true;
        await clickByName(page, 'Pedidos Pendientes');
        await visible(fromHermes);
        await visible(page.getByText('No se pudo consultar el Maestro de Compras.', { exact: true }));
        assert.equal(await page.getByText('No hay pedidos pendientes.', { exact: true }).count(), 0);
        await noHorizontalOverflow(page, 390);
        return { unifiedList: true, originLabels: true, closedOnlyInHistory: true, hermesSurvivesMasterFailure: true };
      } finally {
        sheet.seed(tabs.requests, oldRows);
      }
    }, firstAccount('gerencia')));

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
        await visible(ordersCard.getByText('Sin verificar', { exact: true }));
        await visible(page.getByText('Equipos operativos', { exact: true }).locator('xpath=..').getByText('—', { exact: true }));
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
        assert(pmMobileFolio, 'Falta la OT de EX401 para vincular el pedido');
        await page.getByLabel('OT del pedido (opcional)').fill(pmMobileFolio);
        await clickByName(page, 'Enviar Pedido (2 partes)');
        await visible(page.getByRole('heading', { name: 'Pedido Enviado' }));
        const manual = sheet.read(tabs.requests).find(row => row[1] === 'MANUAL-UI-QA');
        assert(manual);
        const rows = sheet.read(tabs.requests).filter(row => row[9] === manual[9]);
        const catalog = rows.find(row => row[1] === 'QA-002');
        assert.deepEqual([catalog[3], catalog[4], manual[3], manual[4], manual[5]], ['EX401', '4', 'EX401', '3', 'Manual']);
        assert.equal(manual[22], pmMobileFolio);
        await noHorizontalOverflow(page, 390);
        return { catalog, manual };
      });
      return inRole('gerencia', 390, async page => {
        await page.locator('#main-content').getByRole('button', { name: 'Pedidos', exact: true }).first().tap();
        await page.waitForURL(`${origin}/pedidos`);
        await visible(page.getByRole('button', { name: 'Pedidos Pendientes', exact: true }));
        const requestCard = page.getByText('Empaque manual desde móvil', { exact: true }).locator('xpath=../..');
        await visible(requestCard.getByText('MANUAL-UI-QA · EX401 · Cantidad 3', { exact: true }));
        await requestCard.getByRole('link', { name: 'Convertir a OC', exact: true }).tap();
        const form = page.locator('form').first();
        await form.getByLabel('Vincular partida del pedido').selectOption(lines.catalog[15]);
        for (const [index, expected] of ['MANUAL-UI-QA', 'QA-002'].entries()) {
          const number = form.getByLabel('N.º de parte ' + (index + 1), { exact: true });
          assert.equal(await number.inputValue(), expected);
          assert.equal(await number.isEditable(), false);
        }
        await form.getByLabel('Proveedor', { exact: true }).selectOption({ label: 'Proveedor QA' });
        await form.getByLabel('Cantidad 1', { exact: true }).fill('1');
        await form.getByLabel('ITBMS según documento').fill('0');
        await form.getByRole('button', { name: 'Guardar orden', exact: true }).tap();
        const linked = await waitUntil(() => sheet.read(tabs.requests).find(row => row[15] === lines.manual[15] && row[16]), 'La OC no se vinculó al pedido');
        const folio = linked[16];
        assert.equal(sheet.read(tabs.lines).filter(row => row[0] === folio && row[7] === lines.manual[9]).length, 2);
        await page.goto(`${origin}/pedidos`, { waitUntil: 'domcontentloaded' });
        await clickByName(page, 'Historial');
        const orderNumber = sheet.read(tabs.purchases).find(row => row[0] === folio)[27];
        assert.match(orderNumber, /^3\d{3}$/);
        await visible(requestCard.getByRole('link', { name: `Ver OC ${orderNumber}`, exact: true }));
        await visible(requestCard.getByText('Asignado 1 · Recibido 0 · Saldo por asignar 2'));
        await requestCard.getByRole('link', { name: 'Crear OC por el saldo' }).tap();
        const rest = page.locator('form').first();
        await rest.getByLabel('Proveedor', { exact: true }).selectOption({ label: 'Segundo proveedor QA' });
        assert.equal(await rest.getByLabel('Cantidad 1', { exact: true }).inputValue(), '2');
        await rest.getByLabel('ITBMS según documento').fill('0');
        await rest.getByRole('button', { name: 'Guardar orden', exact: true }).tap();
        const second = await waitUntil(() => sheet.read(tabs.lines).find(row => row[8] === lines.manual[15] && row[0] !== folio), 'No se guardó la segunda asignación');
        assert.equal(second[3], '2');
        assert.equal(second[12], pmMobileFolio);
        await page.goto(`${origin}/pedidos`, { waitUntil: 'domcontentloaded' });
        await clickByName(page, 'Historial');
        await visible(requestCard.getByText('Asignado 3 · Recibido 0 · Saldo por asignar 0'));
        assert.equal(await requestCard.getByRole('link', { name: /^Ver OC / }).count(), 2);
        await noHorizontalOverflow(page, 390);
        await shot(page, 'pedido-vinculado-390.png');
        return { request: lines.manual[9], purchaseOrder: folio, lines: 2, historyLink: true, suppliers: 2, ot: pmMobileFolio, unallocated: 0 };
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
      const parts = [['Filtro OC móvil QA', '2', '123.45', '000708-1H-QA'], ['Sello OC móvil QA', '3', '45.67', ''],
        ['Tornillo OC móvil QA', '5', '9.89', 'QA-003-OC']];
      for (const [index, [name, quantity, price, partNumber]] of parts.entries()) {
        if (index) await form.getByRole('button', { name: 'Agregar partida', exact: true }).click();
        await form.getByLabel(`Descripción ${index + 1}`, { exact: true }).fill(name);
        if (partNumber) await form.getByLabel(`N.º de parte ${index + 1}`, { exact: true }).fill(partNumber);
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
      const number = sheet.read(tabs.purchases).find(row => row[0] === folio)[27];
      assert.match(number, /^3\d{3}$/);
      const card = page.locator('article').filter({ has: page.getByRole('heading', { name: number, exact: true }) });
      await visible(card.getByText(/· Borrador ·/));
      assert.deepEqual(sheet.read(tabs.lines).filter(row => row[0] === folio).map(row => row[9]), parts.map(line => line[3]));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await card.getByRole('button', { name: 'Editar', exact: true }).tap();
      const editablePart = form.getByLabel('N.º de parte 1', { exact: true });
      assert.equal(await editablePart.inputValue(), parts[0][3]);
      assert.equal(await form.getByLabel('N.º de parte 2', { exact: true }).inputValue(), '');
      const updatedPart = '000708-1H-QA-R';
      await editablePart.fill(updatedPart);
      await form.getByRole('button', { name: 'Guardar orden', exact: true }).tap();
      await waitUntil(() => sheet.read(tabs.lines).find(row => row[0] === folio && row[1] === '1')?.[9] === updatedPart,
        'No se guardó el número de parte editado');
      await form.getByRole('button', { name: 'Cancelar edición' }).waitFor({ state: 'hidden' });
      await card.getByRole('link', { name: 'Ver / Imprimir', exact: true }).tap();
      await visible(page.locator('.po-document'));
      assert.equal(await page.getByRole('img', { name: /Firma de QA gerencia/i }).count(), 0);
      await page.locator('.po-toolbar').getByRole('link', { name: 'Volver', exact: true }).tap();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await card.getByRole('button', { name: 'Aprobar', exact: true }).tap();
      await card.getByLabel('Soporte de la aprobación Q25').fill('Requisición validada en QA');
      const approveAndSign = card.getByRole('button', { name: 'Aprobar y firmar', exact: true });
      assert.equal(await approveAndSign.isEnabled(), false);
      const pad = card.getByLabel('Área para dibujar la firma');
      await pad.evaluate(canvas => canvas.scrollIntoView({ block: 'center' }));
      await pad.click({ trial: true, position: { x: 28, y: 57 } });
      const bounds = await pad.boundingBox();
      assert(bounds);
      await page.mouse.move(bounds.x + 28, bounds.y + 57);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 75, bounds.y + 25, { steps: 7 });
      await page.mouse.move(bounds.x + 130, bounds.y + 54, { steps: 7 });
      await page.mouse.up();
      await approveAndSign.tap();
      await visible(card.getByText(/· Aprobada ·/));
      const header = sheet.read(tabs.purchases).find(row => row[0] === folio);
      assert.deepEqual(header.slice(6, 12), ['433.36', '30.34', '25.50', '8.75', '497.95', 'Aprobada']);
      await card.getByRole('link', { name: 'Ver / Imprimir', exact: true }).tap();
      const document = page.locator('.po-document');
      await visible(document);
      const rendered = await document.innerText();
      await page.waitForURL(`${origin}/admin/ordenes-compra/${number}`);
      assert.match(rendered, /proveedor qa/i);
      assert(rendered.includes('DZ203') && rendered.includes(number));
      assert.match(rendered, /Trans Plus Panamá/i);
      assert.match(rendered, /497[.,]95/);
      assert.match(rendered, /14[/-]11[/-]2026|2026-11-14/);
      assert.match(rendered, /QA gerencia/);
      await visible(document.getByText('Firma autorizada', { exact: true }));
      await visible(document.getByText('Firma aprueba', { exact: true }));
      for (const [index, expected] of [updatedPart, '—', parts[2][3]].entries()) {
        const line = document.getByRole('row').filter({ hasText: parts[index][0] });
        assert.equal(await line.getByRole('cell').nth(2).innerText(), expected);
      }
      await document.getByRole('img', { name: 'Trans Plus', exact: true }).evaluate(img => img.decode());
      await document.getByRole('img', { name: /Firma de QA gerencia/i }).evaluate(img => img.decode());
      await noHorizontalOverflow(page, 390);
      const artifact = 'Hermes_OC_QA.pdf';
      const pdfPath = resolve(out, artifact);
      await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
      const printed = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
      assert.match(printed, /497[.,]95/);
      assert.match(printed, /FIRMA AUTORIZADA/i);
      assert.match(printed, /FIRMA APRUEBA/i);
      const printedImages = execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' });
      assert.match(printedImages, /image\s+217\s+150\b/);
      assert.match(printedImages, /image\s+360\s+116\b/);
      assert(printed.includes(number) && printed.includes(parts[2][0]));
      const printedTable = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
      const firstPrintedLine = printedTable.split('\n').find(line => line.includes(parts[0][0]));
      assert(firstPrintedLine?.includes(updatedPart), 'El PDF no imprimió el número editado en la partida');
      assert(printedTable.split('\n').find(line => line.includes(parts[2][0]))?.includes(parts[2][3]));
      assert(!printed.includes(folio));
      assert.match(execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' }), /^Pages:\s+1$/m);
      await page.goto(`${origin}/admin/ordenes-compra/${folio}`, { waitUntil: 'domcontentloaded' });
      await visible(page.getByRole('heading', { name: new RegExp(number) }));
      return { folio, number, unit: 'DZ203', amount: 497.95, artifact, pages: 1, signaturePrinted: true,
        officialLogoPrinted: true, signatureSlots: 2, partNumbersPrinted: [updatedPart, parts[2][3]], optionalPartNumber: true };
    }, browserBuyer));

    await record('MÓVIL-COMPRAS-FIRMA-REGISTRADA', () => inRole('gerencia', 390, async page => {
      const api = origin + '/hermes-api/api/purchasing/';
      const post = (action, data) => page.request.post(api + action, { data: { ...data, operationId: randomUUID() } });
      const sourceRow = sheet.read(tabs.purchases).find(row => row[0] === purchaseFolio);
      assert(sourceRow, 'Falta la firma de origen sintética');
      const source = { folio: purchaseFolio, approvedById: sourceRow[17], approvedAt: sourceRow[18] };
      const archivedSignature = await sheet.readPurchaseSignature(source);
      assert(archivedSignature);
      async function createDraft(description) {
        const response = await post('order-save', { date: '2026-11-12', vendorName: 'Proveedor QA', vendorRfc: 'QAT000000000',
          unit: 'DZ203', entity: 'TP_PA_QA', tax: '0', lines: [{ description, quantity: '1', unitPrice: '25' }] });
        assert.equal(response.status(), 200, await response.text());
        return response.json();
      }
      const historical = await createDraft('OC sin firma de origen QA');
      const historicalApproval = await post('order-status', {
        folio: historical.folio, version: historical.version, status: 'Aprobada', reason: 'Aprobación anterior QA',
      });
      assert.equal(historicalApproval.status(), 200, await historicalApproval.text());
      assert.equal((await historicalApproval.json()).signed, undefined);
      const draft = await createDraft('OC con firma registrada QA');
      sheet.registerPurchaseSignature(source);
      try {
        await page.goto(origin + '/admin/ordenes-compra', { waitUntil: 'domcontentloaded' });
        await dismissPrivacy(page);
        const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: draft.number, exact: true }) });
        await card.getByRole('button', { name: 'Aprobar', exact: true }).tap();
        await card.getByLabel('Soporte de la aprobación Q25').fill('Firma automática QA');
        assert.equal(await card.getByLabel('Área para dibujar la firma').count(), 0);
        const [approval] = await Promise.all([
          page.waitForResponse(response => response.url() === api + 'order-status' && response.request().method() === 'POST'),
          card.getByRole('button', { name: 'Aprobar y firmar', exact: true }).tap(),
        ]);
        assert.equal(approval.status(), 200, await approval.text());
        assert.equal(approval.request().postDataJSON().signature, undefined);
        assert.equal((await approval.json()).signed, true);
        await visible(card.getByText(/· Aprobada ·/));
        await card.getByRole('link', { name: 'Ver / Imprimir', exact: true }).tap();
        const archivedImage = page.locator('.po-panama-signature img');
        await archivedImage.evaluate(image => image.decode());
        assert.equal(await archivedImage.getAttribute('src'), 'data:image/png;base64,' + archivedSignature);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await archivedImage.evaluate(image => image.decode());
        const pdfPath = resolve(out, 'Hermes_OC_Firma_Registrada_QA.pdf');
        await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
        assert.match(execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' }), /image\s+360\s+116\b/);
        assert.match(execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' }), /^Pages:\s+1$/m);

        await page.goto(origin + '/admin/ordenes-compra/' + historical.number, { waitUntil: 'domcontentloaded' });
        await visible(page.getByText('Firma pendiente', { exact: true }));
        assert.equal(await page.getByLabel('Área para dibujar la firma').count(), 0);
        const original = sheet.read(tabs.purchases).find(row => row[0] === historical.folio);
        await page.locator('.po-toolbar').getByRole('button', { name: 'Aplicar mi firma', exact: true }).tap();
        await archivedImage.evaluate(image => image.decode());
        assert.equal(await archivedImage.getAttribute('src'), 'data:image/png;base64,' + archivedSignature);
        assert.deepEqual(sheet.read(tabs.purchases).find(row => row[0] === historical.folio), original);
        return { registeredSignaturePrinted: true, matchingArchive: true, withoutDrawing: true, historicalApprovalPreserved: true };
      } finally {
        sheet.clearRegisteredPurchaseSignature(source.approvedById);
      }
    }, browserBuyer));

    await record('MÓVIL-COMPRAS-RECEPCIONES-PARCIALES', () => inRole('jefe_taller', 390, async page => {
      assert(purchaseFolio, 'Falta la OC sintética creada en móvil');
      await page.goto(`${origin}/panama/recepciones`, { waitUntil: 'domcontentloaded' });
      const number = sheet.read(tabs.purchases).find(row => row[0] === purchaseFolio)[27];
      await page.getByRole('searchbox').fill(number);
      const card = page.locator('article').filter({ has: page.getByRole('heading', { name: number, exact: true }) });
      const line = card.locator('li').filter({ has: page.getByRole('heading', { name: /Filtro OC móvil QA/ }) });
      const lineId = sheet.read(tabs.lines).find(row => row[0] === purchaseFolio && row[1] === '1')[6];
      const attempts = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/purchasing/order-receive')) attempts.push(request.postDataJSON().operationId);
      });
      const receive = async (quantity, reference, balance, loseConfirmation = false) => {
        await line.getByRole('button', { name: 'Recibir partida' }).tap();
        await line.getByLabel('Cantidad recibida').fill(quantity);
        await line.getByLabel('Referencia o remisión').fill(reference);
        const submit = line.getByRole('button', { name: 'Registrar recepción', exact: true });
        if (loseConfirmation) {
          sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.lines), when: 'after' });
          await submit.evaluate(button => {
            button.click();
            button.click();
          });
          await visible(line.getByRole('alert'));
          assert.equal(attempts.length, 1);
          assert.equal(JSON.parse(sheet.read(tabs.lines).find(row => row[6] === lineId)[11]).length, 1);
        }
        await submit.tap();
        await visible(line.getByText('Pendientes ' + balance, { exact: true }));
      };
      await receive('0.75', 'Entrega QA A', '1.25', true);
      assert.equal(attempts.length, 2);
      assert.equal(attempts[0], attempts[1]);
      await receive('1.25', 'Entrega QA B', '0');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await visible(card.getByText(/Entrega QA A/));
      await visible(card.getByText(/Entrega QA B/));
      await visible(card.getByText('Recibida parcial', { exact: true }));
      const item = sheet.read(tabs.lines).find(row => row[6] === lineId);
      assert.equal(JSON.parse(item[11]).length, 2);
      await noHorizontalOverflow(page, 390);
      await shot(page, 'oc-recepcion-parcial-390.png');

      const ot = 'OT-MOV-QA-001';
      const movements = 'Movimientos Repuestos PA';
      sheet.seed(tabs.orders, [...sheet.read(tabs.orders),
        ['M-QA', ot, '12/11/2026', 'DZ203', 'Mecánica', 'Movimiento QA', 'MEDIA', 'MEDIA', '', 'En Reparación']]);
      const stock = () => Number(sheet.read(tabs.parts).find(row => row[0] === 'QA-001')[5]);
      const before = stock();
      await page.goto(`${origin}/workorders/${ot}`, { waitUntil: 'domcontentloaded' });
      const history = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Movimientos de repuestos', exact: true }) });
      await history.getByLabel('SKU del catálogo').fill('QA-001');
      await history.getByLabel('Cantidad', { exact: true }).fill('2');
      await history.getByLabel('Referencia del movimiento').fill('SALIDA-QA-MÓVIL');
      const [movementResponse] = await Promise.all([
        page.waitForResponse(response => response.request().method() === 'POST'
          && response.url() === origin + '/hermes-api/api/purchasing/inventory-move'),
        history.getByRole('button', { name: 'Registrar movimiento' }).tap(),
      ]);
      assert.equal(movementResponse.status(), 200, await movementResponse.text());
      await visible(history.getByText(/Costo OT.*25\.00/));
      const original = sheet.read(movements).find(row => row[9] === 'SALIDA-QA-MÓVIL');
      assert.equal(stock(), before - 2);
      await history.getByLabel('Movimiento', { exact: true }).selectOption('Devolución');
      await history.getByLabel('Salida original').selectOption(original[0]);
      await history.getByLabel('Cantidad', { exact: true }).fill('1');
      await history.getByLabel('Referencia del movimiento').fill('DEV-QA-MÓVIL');
      await history.getByRole('button', { name: 'Registrar movimiento' }).tap();
      await visible(history.getByText('Salida original · SALIDA-QA-MÓVIL'));
      await visible(history.getByText('Saldo para devolución 1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await visible(history.getByText(/Costo OT.*12\.50/));
      const returned = sheet.read(movements).find(row => row[9] === 'DEV-QA-MÓVIL');
      assert.deepEqual([returned[14], JSON.parse(returned[15]).delta, stock()], [original[0], '-12.50', before - 1]);
      await noHorizontalOverflow(page, 390);

      return { folio: purchaseFolio, received: 2, remainingOnLine: 0, receipts: 2, orderStatus: 'Recibida parcial', confirmationRecovered: true,
        duplicateSuppressed: true, returnLinked: true, costReversed: '-12.50', remainingReturnable: 1 };
    }, browserWarehouse));

    await record('MÓVIL-STOCK-POR-ALMACÉN', () => inRole('jefe_taller', 390, async page => {
      const sku = 'QA-BODEGA', ot = 'OT-STOCK-QA', oc = 'OC-STOCK-QA';
      const inventory = sheet.read(tabs.parts);
      inventory[4][14] = 'Almacén';
      for (const [warehouse, stock] of [['Patio Norte', '4'], ['Patio Sur', '10']]) {
        inventory.push([sku, 'Filtro compartido QA', '', '', 'pza', stock, '1', '20', '', '', 'DZ203', '', '', '', warehouse]);
      }
      sheet.seed(tabs.parts, inventory);
      sheet.seed(tabs.orders, [...sheet.read(tabs.orders),
        ['STOCK-QA', ot, '12/11/2026', 'DZ203', 'Mecánica', 'Stock QA', 'MEDIA', 'MEDIA', '', 'En Reparación']]);
      const header = Array(28).fill('');
      Object.assign(header, { 0: oc, 1: '15/11/2026', 2: 'Proveedor QA', 5: 'DZ203', 6: '100.00', 7: '7.00', 10: '107.00',
        11: 'Aprobada', 13: 'QA Gerencia', 15: 'version-stock', 16: JSON.stringify({ id: 'TP_PA_QA', name: 'QA', currency: 'USD' }),
        17: 'approver-stock-qa', 18: '2026-11-15T16:00:00Z', 27: '3999' });
      sheet.seed(tabs.purchases, [...sheet.read(tabs.purchases), header]);
      sheet.seed(tabs.lines, [...sheet.read(tabs.lines), [oc, '1', 'Filtro compartido QA', '5', '20', '100', 'LINE-STOCK-QA', '', '', sku, '0', '[]']]);
      const balance = async (warehouse, physical, reserved, available, transit) => {
        const card = page.getByRole('article', { name: `${sku} · ${warehouse}`, exact: true });
        for (const [label, amount] of [['Existencia', physical], ['Reservado', reserved], ['Disponible', available], ['En tránsito', transit]]) {
          const value = card.getByText(label, { exact: true }).locator('..');
          await visible(value.getByText(String(amount), { exact: true }));
        }
        return card;
      };
      await page.goto(`${origin}/inventory`, { waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      const north = await balance('Patio Norte', 4, 0, 4, 0);
      await north.getByRole('button', { name: 'Reservar', exact: true }).click();
      await north.getByLabel('Orden de trabajo').fill(ot);
      await north.getByLabel('Cantidad de reserva').fill('3');
      await north.getByLabel('Referencia').fill('Vale reserva QA');
      await north.getByRole('button', { name: 'Confirmar reserva' }).click();
      await balance('Patio Norte', 4, 3, 1, 0);
      await balance('Patio Sur', 10, 0, 10, 0);
      await page.getByLabel('Estado de stock').selectOption('Bajo');
      await visible(page.getByRole('article', { name: `${sku} · Patio Norte` }));
      assert.equal(await page.getByRole('article', { name: `${sku} · Patio Sur` }).count(), 0);
      await page.getByLabel('Estado de stock').selectOption('');
      await page.goto(`${origin}/panama/recepciones`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('searchbox').fill('3999');
      await clickByName(page, 'Confirmar despacho');
      await page.getByLabel('Almacén de destino').selectOption('Patio Sur');
      await page.getByLabel('Cantidad despachada').fill('4');
      await page.getByLabel('Guía del proveedor').fill('Guía tránsito QA');
      const attempts = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/purchasing/order-dispatch')) attempts.push(request.postDataJSON().operationId);
      });
      sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.lines), when: 'after' });
      await clickByName(page, 'Registrar despacho');
      await visible(page.getByRole('alert').filter({ hasText: 'No pudimos confirmar el guardado' }));
      await visible(page.getByRole('button', { name: 'Confirmar movimiento pendiente' }));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await dismissPrivacy(page);
      await clickByName(page, 'Confirmar movimiento pendiente');
      await page.getByRole('searchbox').fill('3999');
      await visible(page.getByText('Guía tránsito QA · 4 en tránsito'));
      assert.equal(attempts.length, 2);
      assert.equal(attempts[0], attempts[1]);
      await clickByName(page, 'Recibir partida');
      await page.getByLabel('Guía a recibir').selectOption({ label: 'Guía tránsito QA · 4' });
      await page.getByLabel('Cantidad recibida').fill('2');
      await page.getByLabel('Referencia o remisión').fill('Remisión parcial QA');
      await clickByName(page, 'Registrar recepción');
      await visible(page.getByText('Guía tránsito QA · 2 en tránsito'));
      await page.goto(`${origin}/inventory`, { waitUntil: 'domcontentloaded' });
      await balance('Patio Norte', 4, 3, 1, 0);
      await balance('Patio Sur', 12, 0, 12, 2);
      await noHorizontalOverflow(page, 390);
      await shot(page, 'inventario-por-almacen-390.png');
      return { sku, warehouses: 2, physicalAfterReceipt: 12, reserved: 3, inTransit: 2, persistedAfterNavigation: true, recoveredAfterReload: true };
    }, browserWarehouse));

    await record('MÓVIL-REPOSICIÓN-CRÍTICA', () => inRole('jefe_taller', 360, async page => {
      const earlier = sheet.read(tabs.purchases);
      const source = earlier.find(row => row[0] === 'OC-STOCK-QA');
      assert(source, 'Ejecuta el caso de recepción parcial antes de calcular la reposición.');
      const now = new Date();
      const date = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Panama', year:'numeric', month:'2-digit', day:'2-digit'});
      const today = date.format(now);
      const delivery = date.format(new Date(Number(now) + 2 * 86_400_000));
      sheet.seed(tabs.purchases, earlier.map(row => row !== source ? row : Object.assign([...row], { 14: delivery.split('-').reverse().join('/') })));
      try {
        await page.goto(`${origin}/inventory`, { waitUntil: 'domcontentloaded' });
        await dismissPrivacy(page);
        const card = page.getByRole('article', { name: 'QA-BODEGA · Patio Sur', exact: true });
        await card.getByText('Calcular reposición', { exact: true }).click();
        const unit = card.getByLabel('Unidad', { exact: true });
        if ((await unit.evaluate(node => node.tagName)) === 'SELECT') await unit.selectOption('DZ203');
        else await unit.fill('DZ203');
        await card.getByLabel('Vida restante', { exact: true }).fill('40');
        await card.getByLabel('Medida de vida').selectOption('h');
        await card.getByLabel(/Uso diario/).fill('10');
        await card.getByLabel('Fecha de lectura', { exact: true }).fill(today);
        await card.getByLabel('Respaldo de vida y uso').fill('Inspección y horómetro QA');
        await card.getByLabel('Cantidad para el cambio').fill('16');
        await card.getByLabel(/Plazo de proveedor/).fill('2');
        await card.getByLabel('Respaldo del plazo').fill('Cotización sintética QA');
        await card.getByRole('button', { name: 'Calcular', exact: true }).click();
        const recommendation = card.getByText('Reposición adicional', { exact: true });
        await visible(recommendation);
        await visible(recommendation.locator('..').getByText(/^2(?:\s+pza)?$/));
        await visible(card.getByText(/3999/).first());
        await noHorizontalOverflow(page, 360);
        await recommendation.scrollIntoViewIfNeeded();
        await shot(page, 'reposicion-360.png');
        return { sku: 'QA-BODEGA', warehouse: 'Patio Sur', available: 12, open: 3, required: 16, minimum: 1, suggested: 2, width: 360 };
      } finally { sheet.seed(tabs.purchases, earlier); }
    }, browserWarehouse));

    await record('MÓVIL-COSTO-REAL-OT', () => inRole('gerencia', 390, async page => {
      const ot = 'OT-COSTO-QA';
      const order = Array(26).fill('');
      Object.assign(order, { 0: 'COSTO-QA', 1: ot, 2: '14/11/2026', 3: 'DZ203', 4: 'Mecánica', 5: 'Verificación de costo',
        7: 'MEDIA', 9: 'Completado', 20: JSON.stringify({ userId: 'mechanic-cost-qa', userName: 'QA Mecánico',
          functionalTest: 'Prueba conforme', submittedAt: '2026-11-14T15:00:00Z', laborHours: 2.5 }),
        21: JSON.stringify({ userId: 'chief-cost-qa', userName: 'QA Taller', acceptedAt: '2026-11-14T16:00:00Z' }), 25: 'OT-0910' });
      const movement = (id, kind, quantity, delta, original = '') => ['COSTO-' + id, '2026-11-14T14:00:00Z', kind,
        'QA-001', quantity, 'DZ203', '', '', ot, id, 'QA Almacén', 'qa-warehouse', '7', 'pza', original,
        JSON.stringify({ unitCost: '12.50', currency: 'USD', reference: 'VALUACIÓN-QA-01', delta })];
      const service = Array(29).fill('');
      Object.assign(service, { 0: 'GST-COSTO-QA-1', 3: 'Servicio', 4: 'Proveedor QA', 5: 'RUC-COSTO-QA', 6: 'FACT-COSTO-QA',
        7: '50.00', 8: '3.50', 9: '53.50', 10: 'DZ203', 11: ot, 16: 'Aprobado', 17: 'GST-COSTO-QA', 18: 'expense-qa',
        19: '53.50', 21: 'TP_PA_QA', 22: 'PAB', 24: '14/11/2026', 25: 'accounting-qa', 26: '2026-11-14T17:00:00Z' });
      const movements = 'Movimientos Repuestos PA';
      const before = [sheet.read(tabs.orders), sheet.read(tabs.expenses), sheet.read(movements)];
      sheet.seed(tabs.orders, [...before[0], order]);
      sheet.seed(tabs.expenses, [...before[1], service]);
      sheet.seed(movements, [...before[2], movement('SALIDA', 'Salida', '2', '25.00'), movement('DEV', 'Devolución', '1', '-12.50', 'COSTO-SALIDA')]);
      try {
        await page.goto(`${origin}/workorders/OT-0910`, { waitUntil: 'domcontentloaded' });
        const card = page.getByRole('region', { name: 'Costo real de OT' });
        await visible(card.getByText(/Total documentado.*USD.*48\.18/));
        await visible(card.getByText(/Total documentado.*PAB.*53\.50/));
        await card.getByText('Ver soportes', { exact: true }).tap();
        await visible(card.getByText(/Mano de obra · HORAS-COSTO-QA/));
        await visible(card.getByText(/Devoluciones · DEV/));
        await visible(card.getByText(/Servicios externos · FACT-COSTO-QA/));
        await noHorizontalOverflow(page, 390);
        await shot(page, 'ot-costo-real-390.png');
        await card.getByRole('link', { name: 'Registrar factura de servicio' }).tap();
        await page.waitForURL(`${origin}/gastos/nuevo?ot=OT-0910&unit=DZ203`);
        assert.equal(await page.getByLabel('OT relacionada (opcional)').inputValue(), 'OT-0910');
        return { folio: 'OT-0910', unit: 'DZ203', totals: { USD: '48.18', PAB: '53.50' }, separateCurrencies: true, serviceFormPrefilled: true };
      } finally {
        [tabs.orders, tabs.expenses, movements].forEach((tab, index) => sheet.seed(tab, before[index]));
      }
    }));

    await record('MÓVIL-COMPARAR-INTERVENCIÓN', () => inRole('gerencia', 360, async page => {
      const ot = 'OT-COSTO-QA';
      const order = Array(26).fill('');
      Object.assign(order, { 0: 'COSTO-QA', 1: ot, 2: '14/11/2026', 3: 'DZ203', 4: 'Mecánica', 5: 'Verificación de costo',
        7: 'MEDIA', 9: 'Completado', 20: JSON.stringify({ userId: 'mechanic-cost-qa', userName: 'QA Mecánico',
          functionalTest: 'Prueba conforme', submittedAt: '2026-11-14T15:00:00Z', laborHours: 2.5 }),
        21: JSON.stringify({ userId: 'chief-cost-qa', userName: 'QA Taller', acceptedAt: '2026-11-14T16:00:00Z' }), 25: 'OT-0910' });
      const movement = (id, kind, quantity, delta, original = '') => ['COSTO-' + id, '2026-11-14T14:00:00Z', kind,
        'QA-001', quantity, 'DZ203', '', '', ot, id, 'QA Almacén', 'qa-warehouse', '7', 'pza', original,
        JSON.stringify({ unitCost: '12.50', currency: 'USD', reference: 'VALUACIÓN-QA-01', delta })];
      const service = Array(29).fill('');
      Object.assign(service, { 0: 'GST-COSTO-QA-1', 3: 'Servicio', 4: 'Proveedor QA', 5: 'RUC-COSTO-QA', 6: 'FACT-COSTO-QA',
        7: '50.00', 8: '3.50', 9: '53.50', 10: 'DZ203', 11: ot, 16: 'Aprobado', 17: 'GST-COSTO-QA', 18: 'expense-qa',
        19: '53.50', 21: 'TP_PA_QA', 22: 'USD', 24: '14/11/2026', 25: 'accounting-qa', 26: '2026-11-14T17:00:00Z' });
      const movements = 'Movimientos Repuestos PA';
      const before = [sheet.read(tabs.orders), sheet.read(tabs.expenses), sheet.read(movements)];
      sheet.seed(tabs.orders, [...before[0], order]);
      sheet.seed(tabs.expenses, [...before[1], service]);
      sheet.seed(movements, [...before[2], movement('SALIDA', 'Salida', '2', '25.00'), movement('DEV', 'Devolución', '1', '-12.50', 'COSTO-SALIDA')]);
      try {
        await page.goto(`${origin}/workorders/OT-0910`, { waitUntil: 'domcontentloaded' });
        const card = page.getByRole('region', { name: 'Costo real de OT' });
        await dismissPrivacy(page);
        await visible(card.getByText(/Total documentado.*USD.*101\.68/));
        await card.getByText('Reparar, reconstruir o reemplazar', { exact: true }).click();
        const repair = card.getByRole('group', { name: 'Reparar', exact: true });
        await repair.getByRole('button', { name: 'Usar total documentado de esta OT' }).click();
        assert.equal(await repair.getByLabel('Desembolso estimado').inputValue(), '101.68');
        assert.match(await repair.getByLabel('Fuente del desembolso').inputValue(), /FACT-COSTO-QA/);
        await card.getByLabel('Estimar el efecto económico de parar').check();
        const contribution = card.getByRole('group', { name: 'Contribución del equipo' });
        await contribution.getByLabel('Moneda').selectOption('USD');
        await contribution.getByLabel('Contribución neta por hora productiva').fill('22.50');
        await contribution.getByLabel('Fuente de la contribución').fill('Corte QA contribución');
        const samples = [
          ['Reparar', '101.68', '500', '12', '10', '0.20', '225.00'],
          ['Reconstruir', '2100.05', '1200', '20', '15.25', '1.75', '343.13'],
          ['Reemplazar', '5000', '2000', '8', '0', '2.50', '0.00'],
        ];
        for (const [name, cash, life, down, lost] of samples) {
          const group = card.getByRole('group', { name, exact: true });
          if (name !== 'Reparar') {
            await group.getByLabel('Moneda').selectOption('USD');
            await group.getByLabel('Desembolso estimado').fill(cash);
            await group.getByLabel('Fuente del desembolso').fill('Cotización QA ' + name);
          }
          await group.getByLabel('Vida útil (horas de operación)').fill(life);
          await group.getByLabel('Fuente de vida útil').fill('Informe técnico QA ' + name);
          await group.getByLabel('Parada estimada (horas)').fill(down);
          await group.getByLabel('Fuente de la parada').fill('Programa QA ' + name);
          await group.getByLabel('Horas productivas que se perderían').fill(lost);
        }
        await card.getByRole('button', { name: 'Comparar alternativas' }).click();
        const results = card.getByRole('region', { name: 'Resultado de la comparación' });
        for (const [name,,,,, cost, impact] of samples) {
          const row = results.getByRole('article', { name, exact: true });
          await visible(row.getByText('USD ' + cost + '/h', { exact: true }));
          await visible(row.getByText('USD ' + impact, { exact: true }));
        }
        await noHorizontalOverflow(page, 360);
        await results.getByRole('heading', { name: 'Menor desembolso por hora' }).scrollIntoViewIfNeeded();
        await shot(page, 'comparar-intervencion-360.png');
        return { folio: 'OT-0910', width: 360, documentedRepairCash: '101.68', perHour: ['0.20', '1.75', '2.50'], downtimeLoss: ['225.00', '343.13', '0.00'] };
      } finally {
        [tabs.orders, tabs.expenses, movements].forEach((tab, index) => sheet.seed(tab, before[index]));
      }
    }));

    await record('MÓVIL-CUENTAS-POR-PAGAR-PARCIALES', async () => {
      const apPath = `${origin}/panama/cuentas-por-pagar`;
      const apiPath = `${origin}/hermes-api/api/purchasing/`;
      const vendor = 'Segundo proveedor QA';
      const part = 'Filtro de factura parcial QA';
      const reference = 'FAC-PARCIAL-QA';
      const bankReference = 'TRF-PARCIAL-QA';
      const date = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const issueDate = date(-45), dueDate = date(-11), paymentDate = date(-9);
      const post = (page, action, data) => page.request.post(apiPath + action, { data: { ...data, operationId: randomUUID() } });
      async function readAP(page) {
        const response = await page.request.get(apiPath + 'ap');
        assert.equal(response.status(), 200, await response.text());
        return response.json();
      }
      const invoiceCard = page => page.getByRole('article').filter({ has: page.getByText(reference, { exact: true }) });
      const balanceCard = page => page.getByRole('article').filter({ has: page.getByText(vendor, { exact: true }), hasText: 'Saldo abierto' });
      const field = (card, name, value) => visible(card.getByText(name, { exact: true }).locator('..').getByText(value));
      const [year, month, day] = dueDate.split('-');
      const dueLabel = new RegExp(`${dueDate}|${day}[/-]${month}[/-]${year}`);

      const { folio, number } = await inRole('gerencia', 390, async page => {
        await visible(page.getByRole('heading', { name: 'Saldos por proveedor', exact: true }));
        assert.equal(await page.getByRole('heading', { name: 'Facturas', exact: true }).isVisible(), false);
        const saved = await post(page, 'order-save', {
          date: date(-70), deliveryDate: date(-35), vendorName: vendor, vendorRfc: 'QAT000000002', unit: 'DZ203',
          entity: 'TP_PA_QA', tax: '7.00', lines: [{ description: part, quantity: '10', unitPrice: '10.00' }],
        });
        assert.equal(saved.status(), 200, await saved.text());
        const draft = await saved.json();
        const approved = await post(page, 'order-status', {
          folio: draft.folio, version: draft.version, status: 'Aprobada', reason: 'Requisición de 10 filtros verificada por Compras QA',
        });
        assert.equal(approved.status(), 200, await approved.text());
        assert.equal((await approved.json()).status, 'Aprobada');
        const more = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Más', exact: true });
        await more.tap();
        await page.getByRole('button', { name: 'Órdenes de compra', exact: true }).tap();
        await page.waitForURL(origin + '/admin/ordenes-compra');
        await more.tap();
        await page.getByRole('button', { name: 'Cuentas por pagar', exact: true }).tap();
        await page.waitForURL(apPath);
        const invoicesHeading = page.getByRole('heading', { name: 'Facturas', exact: true });
        const balancesHeading = page.getByRole('heading', { name: 'Saldos por proveedor', exact: true });
        const invoicesLink = page.getByRole('link', { name: 'Facturas', exact: true });
        const balancesLink = page.getByRole('link', { name: 'Saldos por proveedor', exact: true });
        await visible(invoicesHeading);
        assert.equal(await invoicesLink.getAttribute('aria-current'), 'page');
        assert.equal(await balancesHeading.isVisible(), false);
        await balancesLink.tap();
        await page.waitForURL(apPath + '#saldos');
        await visible(balancesHeading);
        assert.equal(await balancesLink.getAttribute('aria-current'), 'page');
        assert.equal(await invoicesHeading.isVisible(), false);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await visible(balancesHeading);
        assert.equal(await invoicesHeading.isVisible(), false);
        await page.setViewportSize({ width: 1440, height: 900 });
        await invoicesLink.tap();
        await page.waitForURL(apPath + '#facturas');
        await visible(invoicesHeading);
        assert.equal(await balancesHeading.isVisible(), false);
        await balancesLink.click();
        await visible(balancesHeading);
        await page.goBack();
        await visible(invoicesHeading);
        await visible(page.getByText('Solo consulta.', { exact: true }));
        const queue = page.getByRole('region', { name: 'Órdenes por procesar', exact: true });
        const approvedRow = queue.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'OC ' + draft.number, exact: true }) });
        await visible(approvedRow.getByText('Por recibir', { exact: true }));
        assert.equal(await approvedRow.getByText('Lista para facturar', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Registrar factura', exact: true }).count(), 0);
        await more.tap();
        assert.equal(await page.getByRole('button', { name: 'Recepciones', exact: true }).count(), 0);
        return draft;
      }, browserBuyer, '/panama/cuentas-por-pagar#saldos');

      await inRole('jefe_taller', 390, async page => {
        await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Más', exact: true }).tap();
        await page.getByRole('button', { name: 'Recepciones', exact: true }).tap();
        await page.waitForURL(origin + '/panama/recepciones');
        await page.getByRole('searchbox').fill(number);
        const order = page.getByRole('article').filter({ has: page.getByRole('heading', { name: number, exact: true }) });
        await order.getByRole('button', { name: 'Recibir partida' }).tap();
        await order.getByLabel('Cantidad recibida').fill('6');
        await order.getByLabel('Referencia o remisión').fill('REM-PARCIAL-QA');
        await order.getByRole('button', { name: 'Registrar recepción', exact: true }).tap();
        await visible(order.getByText('Recibidas 6', { exact: true }));
        await visible(order.getByText('Pendientes 4', { exact: true }));
      }, browserWarehouse);

      await inRole('gerencia', 360, async page => {
        await page.goto(`${origin}/admin/ordenes-compra`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('main').getByRole('link', { name: 'Cuentas por pagar', exact: true }).tap();
        await page.waitForURL(apPath);
        await visible(page.getByRole('heading', { name: 'Cuentas por pagar', exact: true }));
        const order = (await readAP(page)).orders.find(item => item.folio === folio);
        assert.equal(order.status, 'Recibida parcial');
        const queue = page.getByRole('region', { name: 'Órdenes por procesar', exact: true });
        const receivedRow = queue.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'OC ' + number, exact: true }) });
        await visible(receivedRow.getByText('Recepción parcial', { exact: true }));
        await visible(receivedRow.getByText('Lista para facturar', { exact: true }));
        const line = order.lines[0];
        assert.deepEqual([line.ordered, line.received, line.invoiced, line.available].map(Number), [10, 6, 0, 6]);

        const excessive = await post(page, 'ap-invoice', {
          folio, version: order.version, reference: 'FAC-EXCESO-QA', issueDate, dueDate, currency: 'USD',
          amount: '74.90', tax: '4.90', discount: '0', shipping: '0', other: '0',
          lines: [{ lineId: line.id, quantity: '7', unitPrice: '10.00' }],
        });
        assert.equal(excessive.status(), 409, await excessive.text());
        assert.match((await excessive.json()).error, /saldo recibido sin facturar/i);
        assert.equal((await readAP(page)).invoices.some(invoice => invoice.folio === folio), false);

        await clickByName(page, 'Registrar factura');
        await page.getByRole('combobox', { name: 'Orden de compra', exact: true }).selectOption(folio);
        await page.getByLabel('Referencia de factura').fill(reference);
        await page.getByLabel('Fecha de emisión').fill(issueDate);
        await page.getByLabel('Fecha de vencimiento').fill(dueDate);
        await page.getByLabel('Total de factura').fill('64.20');
        await page.getByLabel('ITBMS', { exact: true }).fill('4.20');
        await page.getByLabel('Cantidad facturada').fill('6');
        await page.getByLabel('Precio unitario facturado').fill('10.00');
        await noHorizontalOverflow(page, 360);
        await page.screenshot({ path: resolve(out, 'cuentas-por-pagar-factura-360.png'), fullPage: true });
        await page.getByLabel('Total de factura').fill('64.21');
        await clickByName(page, 'Guardar factura');
        await visible(page.getByRole('form', { name: 'Registro de factura' }).getByRole('alert').filter({ hasText: /64[.,]20/ }));
        await page.getByLabel('Total de factura').fill('64.20');
        await clickByName(page, 'Guardar factura');
        const card = invoiceCard(page);
        await visible(card.getByText('Pendiente', { exact: true }));
        await visible(card.getByText(/Vencida/i));
        await field(card, 'Vence', dueLabel);
        await field(card, 'Saldo', /64[.,]20/);
        assert.equal(await card.getByRole('button', { name: 'Registrar pago', exact: true }).count(), 0);
      }, browserAccounting);

      await inRole('gerencia', 390, async page => {
        await page.goto(apPath, { waitUntil: 'domcontentloaded' });
        const card = invoiceCard(page);
        await card.getByRole('button', { name: 'Registrar pago', exact: true }).tap();
        assert.equal(await page.getByRole('button', { name: 'Registrar factura', exact: true }).count(), 0);
        await card.getByLabel('Referencia bancaria').fill(bankReference);
        await card.getByLabel('Fecha de pago').fill(paymentDate);
        await card.getByLabel('Importe confirmado').fill('25.00');
        const attempts = [];
        page.on('request', request => {
          if (request.method() === 'POST' && request.url() === apiPath + 'ap-payment') attempts.push(request.postDataJSON().operationId);
        });
        sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.apPayments), when: 'after' });
        await card.getByRole('button', { name: 'Guardar pago', exact: true }).evaluate(button => {
          button.click();
          button.click();
        });
        const retry = page.getByRole('button', { name: 'Reintentar confirmación', exact: true });
        await visible(retry);
        assert.equal(attempts.length, 1);
        assert.equal((await readAP(page)).invoices.find(item => item.folio === folio).payments.length, 1);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await retry.tap();
        await retry.waitFor({ state: 'hidden' });
        assert.equal(attempts.length, 2);
        assert.equal(attempts[0], attempts[1]);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await visible(card.getByText('Parcial', { exact: true }));
        await visible(card.getByText(/Vencida/i));
        await field(card, 'Vence', dueLabel);
        await field(card, 'Pagado', /25[.,]00/);
        await field(card, 'Saldo', /39[.,]20/);
        const statusFilter = page.getByRole('combobox', { name: 'Estado', exact: true });
        await statusFilter.selectOption({ label: 'Pagadas' });
        await card.waitFor({ state: 'hidden' });
        await statusFilter.selectOption({ label: 'Vencidas' });
        await card.getByText('Pagos registrados (1)', { exact: true }).tap();
        await visible(card.getByText(new RegExp(`^${bankReference} · `)));
        await page.goto(apPath + '#saldos', { waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('heading', { name: 'Saldos por proveedor', exact: true }));
        await field(balanceCard(page), 'Saldo abierto', /39[.,]20/);
        await field(balanceCard(page), 'Saldo vencido', /39[.,]20/);
        await page.getByRole('link', { name: 'Facturas', exact: true }).tap();
        assert.equal(await statusFilter.inputValue(), 'overdue');
        await visible(card.getByText(new RegExp(`^${bankReference} · `)));
        const matchingInvoices = (await readAP(page)).invoices.filter(item => item.folio === folio);
        assert.equal(matchingInvoices.length, 1);
        const [invoice] = matchingInvoices;
        assert.deepEqual([invoice.reference, invoice.issueDate, invoice.dueDate, invoice.status, invoice.currency],
          [reference, issueDate, dueDate, 'Parcial', 'USD']);
        assert.deepEqual([invoice.total, invoice.paid, invoice.balance].map(Number), [64.2, 25, 39.2]);
        assert.deepEqual(invoice.lines.map(line => [Number(line.quantity), Number(line.unitPrice)]), [[6, 10]]);
        assert.deepEqual(invoice.lines[0].receipts.map(receipt => [receipt.reference, Number(receipt.quantity)]), [['REM-PARCIAL-QA', 6]]);
        assert.deepEqual(invoice.payments.map(payment => [payment.reference, payment.date, Number(payment.amount)]), [[bankReference, paymentDate, 25]]);
        assert.equal(sheet.read(tabs.purchases).find(row => row[0] === folio)[11], 'Recibida parcial');
        await noHorizontalOverflow(page, 390);
        await page.screenshot({ path: resolve(out, 'cuentas-por-pagar-parciales-390.png'), fullPage: true });
      }, browserTreasury);

      return { folio, number, ordered: 10, received: 6, remainingDelivery: 4, invoiced: 6, currency: 'USD',
        dueDate, invoiceTotal: 64.2, payments: 1, paid: 25, openBalance: 39.2, overdueBalance: 39.2,
        invalidTotalRejected: true, excessInvoiceRejected: true, recoveredPaymentAfterLostResponse: true, persistedAfterReload: true };
    });

    await record('MÓVIL-CONCILIACIÓN-OC-RECEPCIÓN-FACTURA', () => inRole('gerencia', 390, async page => {
      const folio = 'OC-CRUCE-QA';
      const head = Array(28).fill('');
      Object.assign(head, { 0: folio, 1: '14/11/2026', 2: 'Proveedor conciliación QA', 3: 'RUC-CRUCE-QA', 5: 'DZ203',
        6: '20.00', 7: '1.40', 8: '0.00', 9: '0.00', 10: '21.40', 11: 'Recibida', 13: 'Compras QA',
        15: 'version-cruce-qa', 16: JSON.stringify({ id: 'TP_PA_QA', name: 'Trans Plus Panamá QA', currency: 'USD', taxLabel: 'ITBMS', template: 'transplus' }),
        17: 'buyer-qa', 18: '2026-11-14T14:00:00Z', 23: JSON.stringify({ reference: 'FACT-CRUCE-QA', amount: '21.40',
          currency: 'USD', at: '2026-11-14T17:00:00Z', by: 'Contabilidad histórica QA', actorId: 'legacy-accounting-qa' }),
        25: '0.00', 27: '3909' });
      const lineId = folio + '-L1';
      const receipts = [1, 2].map(n => ({ id: 'REM-CRUCE-' + n, quantity: '1', reference: 'Remisión ' + n,
        actorId: 'warehouse-qa', by: 'Almacén QA', at: '2026-11-14T16:00:00Z' }));
      const before = [sheet.read(tabs.purchases), sheet.read(tabs.lines)];
      sheet.seed(tabs.purchases, [...before[0], head]);
      sheet.seed(tabs.lines, [...before[1], [folio, '1', 'Filtro conciliación QA', '2', '10.00', '20.00',
        lineId, '', '', 'FILTRO-QA', '2', JSON.stringify(receipts)]]);
      try {
        await page.goto(`${origin}/admin/ordenes-compra`, { waitUntil: 'domcontentloaded' });
        const card = page.locator('article').filter({ hasText: 'Proveedor conciliación QA' });
        await card.getByRole('button', { name: 'Verificar factura' }).tap();
        await card.getByLabel('Folio de factura').fill('FACT-CRUCE-QA');
        await card.getByLabel('Total de factura').fill('21.40');
        await card.getByLabel('Moneda de factura').selectOption('PAB');
        await card.getByLabel('ITBMS de factura').fill('0');
        await card.getByLabel('Cantidad facturada').fill('1');
        await card.getByLabel('Precio unitario facturado').fill('20');
        await card.getByRole('button', { name: 'Confirmar registro' }).tap();
        await visible(page.getByText(/moneda.*ITBMS.*cantidad.*precio/i));
        assert.equal(sheet.read(tabs.purchases).find(row => row[0] === folio)[23], head[23]);
        await card.getByLabel('Moneda de factura').selectOption('USD');
        await card.getByLabel('ITBMS de factura').fill('1.40');
        await card.getByLabel('Cantidad facturada').fill('2');
        await card.getByLabel('Precio unitario facturado').fill('10');
        await card.getByRole('button', { name: 'Confirmar registro' }).tap();
        await visible(card.getByText(/Partidas y remisiones conciliadas/));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await visible(card.getByText(/Factura FACT-CRUCE-QA.*Partidas y remisiones conciliadas/));
        const match = JSON.parse(sheet.read(tabs.purchases).find(row => row[0] === folio)[23]).match;
        assert.deepEqual(match.lines[0].receiptIds, ['REM-CRUCE-1', 'REM-CRUCE-2']);
        await noHorizontalOverflow(page, 390);
        await shot(page, 'oc-factura-conciliada-390.png');
        return { rejectedSameTotal: true, differences: ['moneda', 'ITBMS', 'cantidad', 'precio'], receipts: 2, persistedAfterReload: true };
      } finally {
        sheet.seed(tabs.purchases, before[0]);
        sheet.seed(tabs.lines, before[1]);
      }
    }, browserAccounting));

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
    await checkMobileRoleHomes({ fixture, record, inRole, shot });
    return [...external];
  } finally { await browser.close(); }
}
