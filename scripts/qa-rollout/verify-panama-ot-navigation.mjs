import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { firstAccount, fixturePassword, startFixture, tabs } from './fixture.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = process.env.HERMES_QA_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const fixture = await startFixture({ repoDirectory: repo, distDirectory: join(repo, 'dist') });
let browser;

try {
  const [header, original] = fixture.sheet.read(tabs.orders);
  const order = [...original];
  order[25] = 'OT-0104';
  const other = [...order];
  Object.assign(other, { 0: 'qa-otra', 1: 'OT-0005', 3: 'EX401', 25: 'OT-0105' });
  fixture.sheet.seed(tabs.orders, [header, order, other]);

  browser = await chromium.launch({
    executablePath: process.env.HERMES_QA_CHROMIUM_EXECUTABLE || undefined,
    args: ['--disable-background-networking', '--proxy-server=http://127.0.0.1:1', '--proxy-bypass-list=127.0.0.1'],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const snapshot = async name => { if (evidence) await page.screenshot({ path: join(evidence, name + '.png') }); };
  await page.goto(fixture.origin + '/login');
  await page.getByLabel('Correo de trabajo').fill(firstAccount('gerencia').user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

  const menu = page.locator('aside').getByRole('navigation', { name: 'Menú de módulos' });
  const ordersLink = menu.getByRole('link', { name: 'Órdenes de trabajo', exact: true });
  const availabilityLink = menu.getByRole('link', { name: 'Disponibilidad', exact: true });
  const search = page.getByLabel('Buscar orden');
  const status = page.getByLabel('Estado', { exact: true });
  const priority = page.getByLabel('Prioridad', { exact: true });
  await ordersLink.click();
  await search.fill('DZ203');
  await page.getByRole('button', { name: /^Abiertas/ }).click();
  await priority.selectOption('ALTA');
  const detail = await page.getByRole('link', { name: 'Abrir orden' }).getAttribute('href');
  assert.equal(detail, '/workorders/OT-0104');
  await availabilityLink.click();
  await page.getByRole('heading', { level: 1, name: 'Disponibilidad', exact: true }).waitFor();
  assert(await menu.isVisible());
  assert.equal(await availabilityLink.getAttribute('aria-current'), 'page');
  await snapshot('175-disponibilidad');

  await page.reload();
  await ordersLink.click();
  await search.waitFor();
  assert.equal(await search.inputValue(), 'DZ203');
  assert.equal(await status.inputValue(), 'Abierta');
  assert.equal(await priority.inputValue(), 'ALTA');
  assert.equal(await ordersLink.getAttribute('aria-current'), 'page');
  assert.equal(await page.getByRole('table', { name: 'Órdenes de trabajo' }).locator('tbody tr').count(), 1);
  await snapshot('175-regreso-ot');
  await page.goto(fixture.origin + detail);
  await page.locator('#main-content').getByText('OT-0104', { exact: true }).first().waitFor();
  await snapshot('175-folio');
  await ordersLink.click();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await availabilityLink.click();
  await ordersLink.click();
  assert.equal(await search.inputValue(), '');
  assert.equal(await status.inputValue(), '');
  assert.equal(await priority.inputValue(), '');
  assert.equal(fixture.outboundBlocked.length, 0);
  console.log('PASS 175 · 1440 × 900 · Disponibilidad · DZ203 / Abierta / ALTA · OT-0104 · limpiar filtros');
} finally {
  await browser?.close();
  await fixture.stop();
}
