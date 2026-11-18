// Focused acceptance of the PM review. Synthetic identity/sources; loopback only.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { startFixture, firstAccount, fixturePassword } from './fixture.mjs';

const exec = promisify(execFile);
const repoDirectory = resolve(process.env.HERMES_QA_REPO ?? new URL('../../', import.meta.url).pathname);
const out = resolve(process.env.HERMES_QA_EVIDENCE ?? join(tmpdir(), 'hermes-pm-review-' + Date.now()));
const distDirectory = await mkdtemp(join(tmpdir(), 'hermes-pm-review-build-'));
const report = { startedAt: new Date().toISOString(), environment: 'Chromium, identidad y maestros sintéticos; HTTPS loopback', results: [] };
await mkdir(out, { recursive: true });
let fixture;
let browser;
try {
  const revision = await exec('git', ['rev-parse', 'HEAD'], { cwd: repoDirectory });
  const status = await exec('git', ['status', '--short'], { cwd: repoDirectory });
  report.commit = revision.stdout.trim(); report.dirtyTree = Boolean(status.stdout.trim());
  fixture = await startFixture({ repoDirectory, distDirectory, withGateway: true });
  fixture.setPrintablePmLevel(1000);
  await exec(process.execPath, [join(repoDirectory, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'rollout-qa', '--outDir', distDirectory], {
    cwd: repoDirectory, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...fixture.buildEnv }, timeout: 90000,
  });
  browser = await chromium.launch({ executablePath: process.env.HERMES_QA_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-quic', '--proxy-server=http://127.0.0.1:1', '--proxy-bypass-list=127.0.0.1'] });
  for (const width of [320, 360, 390, 412]) {
    fixture.setPrintablePmApproval(false);
    const context = await browser.newContext({ viewport: { width, height: 780 }, isMobile: true, hasTouch: true,
      ignoreHTTPSErrors: true, serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'America/Panama', locale: 'es-PA' });
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      await page.goto(fixture.origin + '/login');
      await page.getByLabel('Correo de trabajo').fill(firstAccount('gerencia').user.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await page.waitForURL(url => !url.pathname.endsWith('/login'));
      const privacy = page.getByRole('button', { name: 'Cerrar aviso temporalmente', exact: true });
      if (await privacy.isVisible()) await privacy.click();
      await page.goto(fixture.origin + '/pm');
      await page.getByRole('button', { name: 'Revisar planes', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Revisión de planes PM', exact: true });
      const summary = panel.locator('summary[aria-label^="Revisión PM de EX401"]');
      const instructions = panel.getByRole('list', { name: 'Pendientes de EX401' });
      const sources = panel.locator('summary[aria-label="Fuentes y CSV"]');
      const exportButton = panel.getByRole('button', { name: 'Descargar revisión completa', exact: true });
      const reload = page.getByRole('button', { name: 'Actualizar revisión', exact: true });
      await panel.getByText('1 pendiente', { exact: true }).waitFor();
      await summary.getByText('Aprobación pendiente', { exact: true }).waitFor();
      assert.equal(await instructions.isVisible(), false);
      assert.equal(await exportButton.isVisible(), false);
      const rowBounds = await summary.boundingBox();
      assert(rowBounds && rowBounds.height >= 44 && rowBounds.height <= 85);
      // The temporary dismissal can reset across a full navigation to /pm.
      const notice = page.getByRole('button', { name: 'Cerrar aviso temporalmente', exact: true });
      if (await notice.isVisible()) await notice.click();
      const dimensions = async () => {
        const value = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          overflowX: getComputedStyle(document.documentElement).overflowX }));
        assert.equal(value.width, width); assert(value.scrollWidth <= width + 1, JSON.stringify(value));
        assert(!['hidden', 'clip'].includes(value.overflowX)); return value;
      };
      const normal = await dimensions();
      await page.screenshot({ path: join(out, `revision-pm-${width}.png`), fullPage: true });
      await panel.getByLabel('Buscar equipo, modelo o serie').fill('NO-EXISTE');
      await panel.getByText('Sin coincidencias', { exact: true }).waitFor();
      await panel.getByLabel('Buscar equipo, modelo o serie').fill('QA-EX401');
      await summary.click();
      await panel.getByText('QA-EX401', { exact: true }).waitFor();
      await instructions.getByText(/Taller: validar tareas/).waitFor();
      await summary.click();
      const downloads = [];
      if (width === 320) {
        await sources.click();
        for (let repeat = 1; repeat <= 3; repeat++) {
          const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
          const file = `revision-PM-${repeat}.csv`; await download.saveAs(join(out, file));
          const csv = await readFile(join(out, file), 'utf8');
          assert(csv.includes('QA-EX401')); assert(csv.includes('Aprobación pendiente')); assert(csv.includes('Taller:'));
          downloads.push({ repeat, file, bytes: Buffer.byteLength(csv) });
        }
        await sources.click();
      }
      fixture.setPrintablePmApproval(true);
      await reload.click();
      await panel.getByText('0 pendientes', { exact: true }).waitFor();
      await panel.getByLabel('Solo pendientes', { exact: true }).uncheck();
      await summary.click();
      await panel.getByText('Registrada', { exact: true }).waitFor();
      await page.route('**/hermes-api/api/panama/pm-review', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fuente ficticia temporalmente no disponible.' }) }));
      await reload.click();
      await panel.getByText('Fuente ficticia temporalmente no disponible.', { exact: true }).waitFor();
      assert.equal(await panel.getByText('Registrada', { exact: true }).count(), 0);
      await page.unroute('**/hermes-api/api/panama/pm-review');
      await reload.click();
      await summary.getByText('Sin pendientes', { exact: true }).waitFor();
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const enlarged = await dimensions();
      await page.screenshot({ path: join(out, `revision-pm-texto-200-${width}.png`), fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.setViewportSize({ width, height: 320 });
      const search = panel.getByLabel('Buscar equipo, modelo o serie'); await search.focus(); await search.fill('EX401');
      await dimensions();
      await sources.click();
      await exportButton.scrollIntoViewIfNeeded();
      const bounds = await exportButton.boundingBox(); assert(bounds && bounds.height >= 44 && bounds.y >= 0 && bounds.y + bounds.height <= 321);
      report.results.push({ width, status: 'pasa', normal, enlarged, keyboardViewportHeight: 320,
        filterBySerial: true, approvalRefreshedFromSource: true, staleApprovalClearedOnFailure: true, retry: true, downloads });
    } finally { await context.close(); }
  }
  assert.equal(fixture.errors.length, 0, JSON.stringify(fixture.errors));
  const finalRevision = await exec('git', ['rev-parse', 'HEAD'], { cwd: repoDirectory });
  const finalStatus = await exec('git', ['status', '--short'], { cwd: repoDirectory });
  assert.equal(finalRevision.stdout.trim(), report.commit, 'Cambió la candidata durante el ensayo');
  assert.equal(Boolean(finalStatus.stdout.trim()), report.dirtyTree, 'Cambió el checkout durante el ensayo');
  report.serverEgressBlocked = [...new Set(fixture.outboundBlocked)];
} catch (error) {
  report.results.push({ status: 'falla', message: error.stack }); process.exitCode = 1;
} finally {
  await browser?.close(); await fixture?.stop();
  await rm(distDirectory, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  await writeFile(join(out, 'revision-pm.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
