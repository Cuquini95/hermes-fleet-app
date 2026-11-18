// Read-only count review acceptance. Synthetic files/accounts and loopback only.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { startFixture, firstAccount, fixturePassword, tabs } from './fixture.mjs';
import { STOCK_COUNT_HEADERS } from '../../src/lib/panama-stock-count.ts';

const exec = promisify(execFile);
const repoDirectory = resolve(process.env.HERMES_QA_REPO ?? new URL('../../', import.meta.url).pathname);
const out = resolve(process.env.HERMES_QA_EVIDENCE ?? join(tmpdir(), 'hermes-stock-review-' + Date.now()));
const distDirectory = await mkdtemp(join(tmpdir(), 'hermes-stock-review-build-'));
const report = { environment: 'Identidad, catálogo y conteo ficticios; HTTPS loopback', startedAt: new Date().toISOString(), results: [] };
await mkdir(out, { recursive: true });
let fixture; let browser;
try {
  report.commit = (await exec('git', ['rev-parse', 'HEAD'], { cwd: repoDirectory })).stdout.trim();
  report.dirtyTree = Boolean((await exec('git', ['status', '--short'], { cwd: repoDirectory })).stdout.trim());
  fixture = await startFixture({ repoDirectory, distDirectory, withGateway: true });
  const parts = fixture.sheet.read(tabs.parts);
  parts[4][16] = 'Almacén'; for (const row of parts.slice(5)) row[16] = 'Almacén QA';
  fixture.sheet.seed(tabs.parts, parts);
  const before = JSON.stringify(fixture.sheet.checkpoint());
  const cohort = fixture.registerLoadAccounts(28);
  const warehouse = cohort.find(actor => actor.membership.can_receive_purchases);
  assert(warehouse); warehouse.membership.role = 'almacen';
  await exec(process.execPath, [join(repoDirectory, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'rollout-qa', '--outDir', distDirectory], {
    cwd: repoDirectory, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...fixture.buildEnv }, timeout: 90000,
  });
  browser = await chromium.launch({ executablePath: process.env.HERMES_QA_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-quic', '--proxy-server=http://127.0.0.1:1', '--proxy-bypass-list=127.0.0.1'] });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const base = { SKU_interno: 'QA-001', Descripcion: 'Filtro ficticio QA', OEM_conocido: 'OEM-QA-001', Unidad: 'pza', Almacen: 'Almacén QA',
    Ubicacion: 'A-01', Cantidad_contada: '10', Fecha_conteo: today, Fuente_soporte: 'CONTEO-FICTICIO-QA', Contado_por: 'Persona QA',
    Revisado_por: 'Revisor QA', Aprobado_por: 'Autoridad QA', Costo_unitario_aprobado: '12.50', Moneda: 'USD', Referencia_valuacion: 'VAL-QA',
    Excepcion: '', Pais: 'Panamá', Proyecto: 'tmf-panama' };
  const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
  const makeFile = rows => Buffer.from('\ufeff' + [STOCK_COUNT_HEADERS.map(quote).join(','),
    ...rows.map(row => STOCK_COUNT_HEADERS.map(name => quote({ ...base, ...row }[name])).join(','))].join('\r\n'));
  const validFile = makeFile([{}, { SKU_interno: 'QA-NEW', Descripcion: 'Repuesto nuevo ficticio', Cantidad_contada: '1.25' }]);
  await writeFile(join(out, 'conteo-ficticio.csv'), validFile);
  for (const role of ['almacen', 'gerencia']) for (const width of [320, 360, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true,
      serviceWorkers: 'block', ignoreHTTPSErrors: true, acceptDownloads: true, timezoneId: 'America/Panama', locale: 'es-PA' });
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      const writes = []; page.on('request', request => {
        if (!['GET', 'HEAD'].includes(request.method()) && !new URL(request.url()).pathname.startsWith('/api/auth/')) writes.push(request.url());
      });
      async function login(actor) {
        await page.goto(fixture.origin + '/login');
        await page.getByLabel('Correo de trabajo').fill(actor.user.email); await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
        await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); await page.waitForURL(url => !url.pathname.endsWith('/login'));
      }
      await login(role === 'almacen' ? warehouse : firstAccount('gerencia'));
      await page.goto(fixture.origin + '/inventory');
      await page.getByRole('heading', { name: 'Inventario por almacén', exact: true }).waitFor();
      const notice = page.getByRole('region', { name: 'Aviso de privacidad', exact: true });
      await notice.waitFor();
      const close = notice.getByRole('button', { name: 'Cerrar aviso temporalmente', exact: true });
      const closeBounds = await close.boundingBox(); assert(closeBounds && closeBounds.width >= 44 && closeBounds.height >= 44);
      if (width === 320 && role === 'almacen') {
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        await page.setViewportSize({ width, height: 320 });
        const bounds = await close.boundingBox(); assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 320);
        await page.screenshot({ path: join(out, 'aviso-320-texto-200.png') });
        await close.click(); await page.evaluate(() => { document.documentElement.style.fontSize = ''; }); await page.setViewportSize({ width, height: 780 });
      } else await close.click();
      await page.getByRole('button', { name: 'Revisar conteo', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Revisión del conteo', exact: true });
      await panel.getByLabel('Archivo de conteo CSV', { exact: true }).setInputFiles({ name: 'conteo-ficticio.csv', mimeType: 'text/csv', buffer: validFile });
      await panel.getByText('2 filas revisadas · 0 con errores de datos', { exact: true }).waitFor();
      const first = panel.getByRole('article').filter({ has: page.getByRole('heading', { name: 'QA-001 · Almacén QA', exact: true }) });
      assert.equal(await first.locator('dd').nth(1).innerText(), '8'); assert.equal(await first.locator('dd').nth(2).innerText(), '2');
      const fresh = panel.getByRole('article').filter({ has: page.getByRole('heading', { name: 'QA-NEW · Almacén QA', exact: true }) });
      assert.equal(await fresh.locator('dd').nth(1).innerText(), 'Sin base');
      async function dimensions() {
        const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          overflow: getComputedStyle(document.documentElement).overflowX }));
        assert.equal(result.width, width); assert(result.scrollWidth <= width + 1, JSON.stringify(result)); assert(!['hidden', 'clip'].includes(result.overflow)); return result;
      }
      const normal = await dimensions(); await page.screenshot({ path: join(out, `conteo-${role}-${width}.png`), fullPage: true });
      const downloads = [];
      if (width === 320 && role === 'almacen') for (let repeat = 1; repeat <= 3; repeat++) {
        const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Descargar observaciones', exact: true }).click()]);
        const file = `revision-conteo-${repeat}.csv`; await download.saveAs(join(out, file)); const csv = await readFile(join(out, file), 'utf8');
        assert(csv.includes('SOLO REVISION; NO APLICA SALDOS')); assert(csv.includes('QA-NEW')); assert(csv.includes('conteo-ficticio.csv'));
        downloads.push({ file, bytes: Buffer.byteLength(csv) });
      }
      await page.route('**/hermes-api/api/purchasing/inventory-stock', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Catálogo QA no disponible.' }) }));
      await panel.getByRole('button', { name: 'Actualizar comparación', exact: true }).click();
      await panel.getByText(/Catálogo QA no disponible/).waitFor();
      assert.equal(await first.locator('dd').nth(1).innerText(), 'Sin base');
      await page.unroute('**/hermes-api/api/purchasing/inventory-stock');
      await panel.getByRole('button', { name: 'Actualizar comparación', exact: true }).click();
      await first.locator('dd').nth(1).filter({ hasText: /^8$/ }).waitFor();
      await panel.getByLabel('Archivo de conteo CSV', { exact: true }).setInputFiles({ name: 'conteo-con-errores.csv', mimeType: 'text/csv', buffer: makeFile([{}, { Cantidad_contada: '-1' }]) });
      await panel.getByText('2 filas revisadas · 2 con errores de datos', { exact: true }).waitFor();
      await panel.getByText(/Cantidad inválida/).waitFor();
      await panel.getByLabel('Archivo de conteo CSV', { exact: true }).setInputFiles({ name: 'conteo-ficticio.csv', mimeType: 'text/csv', buffer: validFile });
      await panel.getByText('2 filas revisadas · 0 con errores de datos', { exact: true }).waitFor();
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); const enlarged = await dimensions();
      if (width === 320 && role === 'almacen') await page.screenshot({ path: join(out, 'conteo-texto-200.png'), fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.setViewportSize({ width, height: 320 }); const search = panel.getByLabel('Buscar SKU, descripción o almacén'); await search.focus(); await search.fill('QA-001');
      await dimensions(); const action = panel.getByRole('button', { name: 'Descargar observaciones', exact: true }); await action.scrollIntoViewIfNeeded();
      const bounds = await action.boundingBox(); assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 321 && bounds.height >= 44);
      assert.equal(writes.length, 0, 'La revisión emitió una escritura de negocio');
      report.results.push({ role, width, status: 'pasa', normal, enlarged, keyboardViewport: 320, downloads, immutableStock: true,
        actualWarehouseRole: role === 'almacen', unavailableIsNotZero: true, retainedFileOnRetry: true, businessWrites: writes.length });
      if (width === 320 && role === 'almacen') {
        await page.setViewportSize({ width, height: 780 });
        await page.getByRole('button', { name: 'Opciones de la cuenta', exact: true }).click();
        await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/login');
        await login(firstAccount('gerencia')); await page.goto(fixture.origin + '/inventory');
        await page.getByRole('heading', { name: 'Inventario por almacén', exact: true }).waitFor();
        const freshNotice = page.getByRole('button', { name: 'Cerrar aviso temporalmente', exact: true });
        if (await freshNotice.isVisible()) await freshNotice.click();
        await page.getByRole('button', { name: 'Revisar conteo', exact: true }).click();
        const freshPanel = page.getByRole('region', { name: 'Revisión del conteo', exact: true });
        await freshPanel.getByLabel('Archivo de conteo CSV', { exact: true }).waitFor({ state: 'attached' });
        assert.equal(await freshPanel.getByText('conteo-ficticio.csv', { exact: true }).count(), 0);
        report.fileClearedAcrossAccounts = true;
      }
    } finally { await context.close(); }
  }
  assert.equal(JSON.stringify(fixture.sheet.checkpoint()), before, 'Cambió el catálogo, reservas, compras o comprobantes');
  assert.equal(fixture.errors.length, 0, JSON.stringify(fixture.errors));
  assert.equal((await exec('git', ['rev-parse', 'HEAD'], { cwd: repoDirectory })).stdout.trim(), report.commit);
  assert.equal(Boolean((await exec('git', ['status', '--short'], { cwd: repoDirectory })).stdout.trim()), report.dirtyTree);
  report.serverEgressBlocked = [...new Set(fixture.outboundBlocked)];
} catch (error) { report.results.push({ status: 'falla', message: error.stack }); process.exitCode = 1; }
finally {
  await browser?.close(); await fixture?.stop(); await rm(distDirectory, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString(); await writeFile(join(out, 'revision-conteo.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
