import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fixturePassword, loadAccounts, photoPng, tabs } from './fixture.mjs';

const button = (page, name) => page.getByRole('button', { name, exact: true });
const view = (page, label) => page.getByRole('heading', { name: label, exact: true });
const photo = name => ({ name, mimeType: 'image/png', buffer: photoPng });

export async function checkOfflineRestart(fixture, out) {
  const { origin, sheet, photos } = fixture;
  const caseId = randomUUID().slice(0, 8);
  const failureNote = 'Prueba de arranque sin señal: presión hidráulica ' + caseId;
  const checklistNote = 'Prueba de arranque sin señal: inspección de frenos ' + caseId;
  const baselineTables = [tabs.orders, tabs.failure, tabs.history, tabs.dvir, 'HERMES_PA_ESTADO_UNIDAD']
    .map(tab => [tab, sheet.read(tab)]);
  const baselinePhotoKeys = new Set(photos.keys());
  const baselinePhotos = photos.size;
  const executablePath = process.env.HERMES_QA_CHROMIUM_EXECUTABLE
    ?? ['/usr/bin/chromium', '/tmp/chromium'].find(existsSync);
  const profile = await mkdtemp(join(tmpdir(), 'hermes-restart-profile-'));
  const options = {
    executablePath, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-quic',
      '--disable-component-update', '--proxy-server=http://127.0.0.1:1', '--proxy-bypass-list=127.0.0.1',
      '--ignore-certificate-errors'],
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    timezoneId: 'America/Panama', locale: 'es-PA', ignoreHTTPSErrors: true,
  };
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, options);
    const page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(9000);
    await page.goto(origin + '/login');
    const operator = loadAccounts.findLast(account => account.membership.role === 'operador');
    await page.getByLabel('Correo de trabajo').fill(operator.user.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
    await button(page, 'Ingresar').click();
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    await button(page, 'Aceptar y continuar').click();
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js'));
    await navigation.getByRole('button', { name: 'Reportar', exact: true }).click();
    await page.locator('#main-content select').first().selectOption('DZ203');

    await context.setOffline(true);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    await page.locator('#main-content select').nth(1).selectOption({ label: 'Mecánica' });
    await page.getByPlaceholder('Describe los síntomas observados...').fill(failureNote);
    await button(page, 'No').click();
    await page.locator('input[type=file]').first().setInputFiles(photo('falla-sin-senal.png'));
    await button(page, 'Enviar reporte').click();
    await button(page, 'Confirmar').click();
    await expect(page.getByText(/Guardado pendiente\./)).toBeVisible();

    await navigation.getByRole('button', { name: 'Checklist', exact: true }).click();
    await page.locator('#main-content select').first().selectOption('DZ205');
    await page.getByPlaceholder('Ej: 3240').fill('391');
    const ok = button(page, 'OK');
    const fail = button(page, 'Falla');
    assert.equal(await ok.count(), 12);
    for (let index = 0; index < 12; index++) await (index === 2 ? fail : ok).nth(index).click();
    await page.getByPlaceholder('Describe el problema...').fill('Freno reprobado en el checklist');
    await page.getByLabel('Observaciones', { exact: true }).fill(checklistNote);
    await page.locator('input[type=file]:not([capture])').first().setInputFiles(photo('inspeccion-sin-senal.png'));
    await button(page, 'Enviar Inspección').click();
    await button(page, 'Confirmar').click();
    await expect(page.getByText(/Guardado pendiente\./)).toBeVisible();
    await expect(page.getByText('2 registros pendientes', { exact: true })).toBeVisible({ timeout: 9000 });
    const failures = () => sheet.read(tabs.orders).filter(row => row[5] === failureNote);
    const inspections = () => sheet.read(tabs.dvir).filter(row => row[23]?.includes(checklistNote));
    assert.equal(failures().length + inspections().length, 0);
    assert.equal(photos.size, baselinePhotos);

    await context.close();
    context = undefined;
    context = await chromium.launchPersistentContext(profile, { ...options, offline: true });
    const restarted = context.pages()[0] ?? await context.newPage();
    restarted.setDefaultTimeout(9000);
    const coldNavigation = await restarted.goto(origin + '/falla', { waitUntil: 'domcontentloaded' });
    assert.equal(coldNavigation?.fromServiceWorker(), true);
    assert.equal(await restarted.evaluate(() => navigator.onLine), false);
    await expect(view(restarted, 'Sesión pendiente de verificar')).toBeVisible();
    assert.equal(await restarted.locator('#main-content textarea').count(), 0);
    assert.equal(failures().length + inspections().length, 0);
    await restarted.screenshot({ path: resolve(out, 'c14-reinicio-sin-senal-390.png') });

    const validated = restarted.waitForResponse(response =>
      response.url() === origin + '/api/auth/session' && response.status() === 200, { timeout: 12000 });
    await context.setOffline(false);
    await validated;
    await expect.poll(() => [failures().length, inspections().length, photos.size - baselinePhotos], {
      timeout: 15000,
    }).toEqual([1, 1, 2]);

    const [failure] = failures();
    const [inspection] = inspections();
    assert.equal(inspection[22], 'reprobado');
    assert.equal(inspection[11], 'falla');
    assert.equal(sheet.read(tabs.failure).filter(row => row[13] === failure[1]).length, 1);
    assert.equal(sheet.read(tabs.failure).filter(row => row[13] === inspection[25]).length, 1);
    const photoPaths = [failure[10], inspection[24]];
    assert.equal(new Set(photoPaths).size, 2);
    for (const path of photoPaths) {
      assert.match(path, /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/);
      const response = await restarted.request.get(origin + path);
      assert.equal(response.status(), 200);
      assert.deepEqual(await response.body(), photoPng);
    }
    await context.setOffline(true);
    await expect(restarted.getByText('Sin conexión', { exact: true })).toBeVisible();
    assert.equal(await restarted.getByText(/registros? pendientes/).count(), 0);
    await context.setOffline(false);
    await restarted.reload({ waitUntil: 'domcontentloaded' });
    await expect(restarted.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    assert.deepEqual([failures().length, inspections().length, photos.size - baselinePhotos], [1, 1, 2]);
    return { failure: failure[1], inspection: inspection[1], inspectionOrder: inspection[25],
      persistedAfterOfflineRestart: true, chromiumProcessRestarted: true,
      authenticatedAfterReconnect: true, duplicateSuppressed: true,
      photosWithOriginalBytes: 2, width: 390, device: 'Chromium con viewport móvil' };
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
    for (const [tab, rows] of baselineTables) sheet.seed(tab, rows);
    for (const key of photos.keys()) if (!baselinePhotoKeys.has(key)) photos.delete(key);
  }
}
