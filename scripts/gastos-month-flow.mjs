import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'codex/hermes-integration-recovery') process.exit(0);
const require = createRequire(resolve('package.json'));
const { chromium } = require('playwright');
const repoImport = async (file) => (await import(pathToFileURL(resolve(file)))).default;
const [login, session, gateway] = await Promise.all([
  repoImport('api/auth/login.js'), repoImport('api/auth/session.js'), repoImport('api/hermes/[...path].js'),
]);
const gatewaySecret = randomBytes(24).toString('hex');
process.env.HERMES_AUTH_SECRET = randomBytes(32).toString('hex');
process.env.HERMES_UPSTREAM_TOKEN = gatewaySecret;
function expense(id, date, supplier, total, status = 'Aprobado') {
  return [id, date, '', 'Refaccion', supplier, '', '', '', '', total, 'FLOTA', '', '', '', '', '', status];
}
const expenses = [
  ['Gasto_ID', 'Fecha'],
  expense('GST-APR-1', '12/04/2026', 'Proveedor histórico A', '100'),
  expense('GST-APR-2', '24/4/2026', 'Proveedor histórico B', '200'),
  expense('GST-APR-3', '24/04/2026', 'Proveedor histórico C', '300'),
  expense('TEST-GST-APR', '24/04/2026', 'TEST_PIPELINE', '900'),
  expense('[SWARM-TEST] APR', 'TEST-D65', 'Registro desalineado', '0'),
  expense('GST-DELETED', '24/04/2026', 'Gasto eliminado', '900', 'Eliminado'),
];
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const dist = resolve('dist');
const server = createServer(async (req, res) => {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (value) => { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(value)); };
  res.send = (value) => res.end(value);
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    req.query = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    }
    if (url.pathname === '/api/auth/login') return login(req, res);
    if (url.pathname === '/api/auth/session') return session(req, res);
    if (url.pathname.startsWith('/hermes-api/')) {
      req.query.path = url.pathname.slice('/hermes-api/'.length);
      return await gateway(req, res);
    }
    if (url.pathname.startsWith('/isolated-data/')) {
      assert.ok(req.headers['x-hermes-gateway-token'] === gatewaySecret, 'Expected authenticated gateway');
      const data = req.query.tab === '02 Gastos' ? expenses : [];
      return res.json({ success: true, data });
    }
    const resource = extname(url.pathname) ? url.pathname.slice(1) : 'index.html';
    const file = resolve(dist, resource);
    if (!file.startsWith(dist + sep)) return res.status(404).end();
    const content = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    return res.end(content);
  } catch (error) {
    console.error('hermes_gastos_fixture_error', error.name);
    res.status(500).json({ error: 'Isolated verification failed' });
  }
});


let browser;
try {
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const origin = 'http://127.0.0.1:' + server.address().port;
  process.env.HERMES_UPSTREAM_URL = origin + '/isolated-data';
  const serverless = (await import(pathToFileURL(require.resolve('@sparticuz/chromium', { paths: ['/tmp/hermes-browser'] })))).default;
  browser = await chromium.launch({ executablePath: await serverless.executablePath(), headless: true, args: serverless.args });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(12000);
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.clock.setFixedTime(new Date('2026-11-11T19:00:00Z'));
  await page.goto(origin + '/login');
  await page.getByRole('button', { name: 'Gerencia', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login');
  const data = page.waitForResponse((r) => r.url().includes('/api/sheets/read?tab=02+Gastos'));
  await page.goto(origin + '/gastos');
  assert.equal((await data).status(), 200);
  await page.getByRole('heading', { name: 'Gastos', exact: true }).waitFor();
  const consent = page.getByRole('button', { name: 'Cerrar aviso temporalmente' });
  if (await consent.isVisible()) await consent.click();
  await page.getByText('Noviembre 2026', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Detalle', exact: true }).click();
  await page.getByText('Total del mes · 0 registros', { exact: true }).waitFor();
  await page.getByText('Sin gastos este mes', { exact: true }).waitFor();
  assert.equal(await page.getByText(/Proveedor histórico|TEST_PIPELINE|TEST-D65/).count(), 0);
  for (let index = 0; index < 7; index++) await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.getByText('Abril 2026', { exact: true }).waitFor();
  await page.getByText('Total del mes · 3 registros', { exact: true }).waitFor();
  for (const name of ['Proveedor histórico A', 'Proveedor histórico B', 'Proveedor histórico C']) {
    await page.getByText(name, { exact: true }).waitFor();
  }
  assert.equal(await page.getByText(/TEST_PIPELINE|TEST-D65|Gasto eliminado/).count(), 0);
  assert.ok(await page.getByText('$600', { exact: true }).isVisible());
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await page.getByText('Total del mes · 3 registros', { exact: true }).waitFor();
  assert.ok((await page.getByText('$600', { exact: true }).count()) > 0);
  console.log('hermes_gastos_nov_empty_apr_three_total_600_passed');
  console.log('hermes_gastos_test_and_deleted_rows_excluded');
} finally {
  await browser?.close();
  server.close();
}
