// Acceptance runs only on a loopback replica with fictitious identities, stops and histories.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { startFixture, firstAccount, fixturePassword, tabs } from './fixture.mjs';

const exec = promisify(execFile);
const repoDirectory = resolve(process.env.HERMES_QA_REPO ?? new URL('../../', import.meta.url).pathname);
const out = resolve(process.env.HERMES_QA_EVIDENCE ?? join(tmpdir(), 'hermes-maintenance-metrics-' + Date.now()));
const distDirectory = await mkdtemp(join(tmpdir(), 'hermes-maintenance-metrics-build-'));
const report = { environment: 'HTTPS loopback; personas, fallas y retornos ficticios', startedAt: new Date().toISOString(), results: [] };
await mkdir(out, { recursive: true });
let fixture; let browser;
try {
  report.commit = (await exec('git', ['rev-parse', 'HEAD'], { cwd: repoDirectory })).stdout.trim();
  report.dirtyTree = Boolean((await exec('git', ['status', '--short'], { cwd: repoDirectory })).stdout.trim());
  fixture = await startFixture({ repoDirectory, distDirectory, withGateway: true });
  const formatDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = formatDate.format(new Date()), day = formatDate.format(new Date(Date.now() - 86400000));
  const at = time => `${day}T${time}:00.000Z`;
  function stop(id, unit, start) {
    const failure = Array(17).fill('');
    Object.assign(failure, { 0: day.split('-').reverse().join('/'), 2: unit, 3: 'Prueba ficticia', 13: id, 15: 'qa-operator',
      16: JSON.stringify({ stopped: true, startedAt: start ? at(start) : null }) });
    const order = Array(26).fill('');
    Object.assign(order, { 1: id, 3: unit, 4: 'Hidráulica', 9: start ? 'Completado' : 'Abierta', 25: id });
    if (start) {
      order[20] = JSON.stringify({ userId: 'qa-mechanic', functionalTest: 'Prueba ficticia de funcionamiento' });
      order[21] = JSON.stringify({ userId: 'qa-workshop', acceptedAt: at('17:30') });
      order[22] = JSON.stringify({ decision: 'accepted', userId: 'qa-operations', returnedAt: at('18:00'), recordedAt: at('18:00') });
    }
    return { failure, order };
  }
  const rows = [stop('OT-0131', 'DZ203', '12:00'), stop('OT-0132', 'EX401', '14:00'), stop('OT-0133', 'DZ205', null)];
  fixture.sheet.seed(tabs.failure, [fixture.sheet.read(tabs.failure)[0], ...rows.map(row => row.failure)]);
  fixture.sheet.seed(tabs.orders, [fixture.sheet.read(tabs.orders)[0], ...rows.map(row => row.order)]);
  fixture.sheet.seed(tabs.history, [fixture.sheet.read(tabs.history)[0], ...[
    ['12:00', '', 'Abierta'], ['13:00', 'Abierta', 'En Reparación'], ['14:00', 'En Reparación', 'Esperando Pieza'],
    ['16:00', 'Esperando Pieza', 'En Reparación'], ['17:00', 'En Reparación', 'Resuelta'], ['17:30', 'Resuelta', 'Completado'],
  ].map(([time, before, after]) => [at(time), 'OT-0131', 'estado', before, after, 'Persona QA', 'jefe_taller', 'qa-workshop'])]);
  const before = JSON.stringify(fixture.sheet.checkpoint());
  await exec(process.execPath, [join(repoDirectory, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'rollout-qa', '--outDir', distDirectory], {
    cwd: repoDirectory, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...fixture.buildEnv }, timeout: 90000,
  });
  browser = await chromium.launch({ executablePath: process.env.HERMES_QA_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-quic', '--proxy-server=http://127.0.0.1:1', '--proxy-bypass-list=127.0.0.1'] });
  for (const width of [320, 360, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true,
      serviceWorkers: 'block', ignoreHTTPSErrors: true, acceptDownloads: true, timezoneId: 'America/Panama', locale: 'es-PA' });
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      const writes = []; page.on('request', request => {
        if (!['GET', 'HEAD'].includes(request.method()) && !new URL(request.url()).pathname.startsWith('/api/auth/')) writes.push(request.url());
      });
      await page.goto(fixture.origin + '/login');
      await page.getByLabel('Correo de trabajo').fill(firstAccount('gerencia').user.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(fixturePassword);
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); await page.waitForURL(url => url.pathname !== '/login');
      await page.goto(fixture.origin + '/panama/tiempo-caido');
      await page.getByRole('heading', { name: 'Tiempos de mantenimiento', exact: true }).waitFor();
      const notice = page.getByRole('button', { name: 'Cerrar aviso temporalmente', exact: true });
      await notice.click();
      const summary = page.getByRole('region', { name: 'Resumen de tiempo caído', exact: true });
      const phase = page.getByRole('region', { name: 'Tiempo por estado', exact: true });
      const mttr = page.getByRole('region', { name: 'MTTR registrado', exact: true });
      await summary.getByText('10 h 0 min', { exact: true }).waitFor();
      assert.equal(await phase.locator('dt').filter({ hasText: /^Esperando repuesto$/ }).locator('..').locator('dd').innerText(), '2 h 0 min');
      await phase.getByText('Estados verificados: 60% del tiempo medido.', { exact: true }).waitFor();
      await mttr.getByText('5 h 0 min', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Hoy', exact: true }).click();
      await summary.getByText('Sin intervalos verificados', { exact: true }).waitFor();
      await mttr.getByText('Sin retornos elegibles', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Desde', { exact: true }).inputValue(), today);
      for (const days of [7, 15]) {
        await page.getByRole('button', { name: `${days} días`, exact: true }).click();
        await summary.getByText('10 h 0 min', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Desde', { exact: true }).inputValue(), formatDate.format(new Date(Date.now() - (days - 1) * 86400000)));
      }
      await page.getByLabel('Desde', { exact: true }).fill(day); await page.getByLabel('Hasta', { exact: true }).fill(day);
      await page.getByRole('button', { name: 'Consultar', exact: true }).click(); await summary.getByText('10 h 0 min', { exact: true }).waitFor();
      async function dimensions() {
        const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: getComputedStyle(document.documentElement).overflowX }));
        assert.equal(result.width, width); assert(result.scrollWidth <= width + 1, JSON.stringify(result)); assert(!['hidden', 'clip'].includes(result.overflow)); return result;
      }
      const normal = await dimensions(); await page.screenshot({ path: join(out, `tiempos-${width}.png`), fullPage: true });
      const downloads = [];
      if (width === 320) {
        await mttr.getByText('Ver cálculo y exclusiones', { exact: true }).click();
        await mttr.getByText('Duración acumulada completa: 10 h 0 min. Dividida entre 2 paradas elegibles.', { exact: true }).waitFor();
        await page.getByText('Historial por revisar (1)', { exact: true }).click();
        await page.getByText('Falta el historial horario de estados.', { exact: true }).waitFor();
        for (let repeat = 1; repeat <= 3; repeat++) {
          const [download] = await Promise.all([page.waitForEvent('download'), summary.getByRole('button', { name: 'Descargar detalle CSV', exact: true }).click()]);
          const file = `tiempos-mantenimiento-${repeat}.csv`; await download.saveAs(join(out, file)); const csv = await readFile(join(out, file), 'utf8');
          assert(csv.includes('"Esperando repuesto","7200"')); assert(csv.includes('"Numerador: duración completa acumulada","36000"'));
          assert(csv.includes('"Cohorte MTTR","EX401"')); assert(csv.includes('"Pendiente de confirmar","DZ205"'));
          downloads.push({ file, bytes: Buffer.byteLength(csv) });
        }
      }
      await page.route(/\/api\/workshop\/downtime\?/, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Tiempos QA no disponibles.' }) }));
      await page.getByRole('button', { name: 'Consultar', exact: true }).click();
      await page.getByText('Tiempos QA no disponibles.', { exact: true }).waitFor();
      assert.equal(await summary.count(), 0); assert.equal(await phase.count(), 0); assert.equal(await mttr.count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Descargar detalle CSV', exact: true }).count(), 0);
      await page.unroute(/\/api\/workshop\/downtime\?/);
      await page.getByRole('button', { name: 'Reintentar consulta', exact: true }).click(); await summary.getByText('10 h 0 min', { exact: true }).waitFor();
      await page.getByLabel('Unidad', { exact: true }).fill('ex401');
      await page.getByRole('button', { name: 'Consultar', exact: true }).click(); await summary.getByText('4 h 0 min', { exact: true }).waitFor();
      await phase.getByText('Estados verificados: 0% del tiempo medido.', { exact: true }).waitFor();
      await mttr.getByText('4 h 0 min', { exact: true }).waitFor();
      assert.equal(await page.getByRole('article').getByRole('heading', { name: 'DZ203', exact: true }).count(), 0);
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); const enlarged = await dimensions();
      if (width === 320) await page.screenshot({ path: join(out, 'tiempos-texto-200.png'), fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.setViewportSize({ width, height: 320 }); await page.getByLabel('Unidad', { exact: true }).focus();
      await dimensions(); const action = summary.getByRole('button', { name: 'Descargar detalle CSV', exact: true }); await action.scrollIntoViewIfNeeded();
      const bounds = await action.boundingBox(); assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 321 && bounds.height >= 44);
      assert.equal(writes.length, 0);
      report.results.push({ width, status: 'pasa', normal, enlarged, keyboardViewport: 320, measuredHours: 10, partsHours: 2,
        classifiedPercent: 60, mttrHours: 5, mttrDenominator: 2, nullForNoVerifiedIntervals: true,
        unitFilter: true, unavailableClearsPriorData: true, businessWrites: writes.length, downloads });
    } finally { await context.close(); }
  }
  assert.equal(JSON.stringify(fixture.sheet.checkpoint()), before, 'La consulta alteró un registro de negocio');
  assert.equal(fixture.errors.length, 0, JSON.stringify(fixture.errors));
  report.serverEgressBlocked = [...new Set(fixture.outboundBlocked)];
} catch (error) { report.results.push({ status: 'falla', message: error.stack }); process.exitCode = 1; }
finally {
  await browser?.close(); await fixture?.stop(); await rm(distDirectory, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString(); await writeFile(join(out, 'tiempos-mantenimiento.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
