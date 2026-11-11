import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const local = process.env.HERMES_TEST_LOCAL === '1' && !process.env.VERCEL;
const preview = process.env.VERCEL_ENV === 'preview'
  && process.env.VERCEL_GIT_COMMIT_REF === 'codex/hermes-integration-recovery';
if (!local && (!preview || Date.now() > 1794442331704)) process.exit(0);

const require = createRequire(resolve('package.json'));
const { chromium } = require('playwright');
const { GoogleAuth } = require('google-auth-library');
const repoImport = async (file) => (await import(pathToFileURL(resolve(file)))).default;
const [login, session, gateway, parts] = await Promise.all([
  repoImport('api/auth/login.js'),
  repoImport('api/auth/session.js'),
  repoImport('api/hermes/[...path].js'),
  repoImport('api/parts/import.js'),
]);
const expectedCode = 'HERMES-QA-GASTO-01';
const supplier = 'Proveedor simulado · prueba Hermes';
const description = 'PRUEBA AUTOMÁTICA HERMES (sin compra real)';
const history = ['GAS-HIST-001', '2026-11-10', '', 'Refaccion', supplier];
history[14] = '[' + expectedCode + '] Filtro simulado x1 $100.00';
history[16] = 'Aprobado';
const expenses = [history];
const trace = [];
const outgoing = [];
const networkFetch = globalThis.fetch;
const testConfig = {
  HERMES_AUTH_SECRET: !!process.env.HERMES_AUTH_SECRET,
  HERMES_UPSTREAM_URL: !!process.env.HERMES_UPSTREAM_URL,
  HERMES_UPSTREAM_TOKEN: !!process.env.HERMES_UPSTREAM_TOKEN,
  HERMES_GOOGLE_SHEETS_ID: !!process.env.HERMES_GOOGLE_SHEETS_ID,
  HERMES_GOOGLE_SERVICE_ACCOUNT_JSON: !!process.env.HERMES_GOOGLE_SERVICE_ACCOUNT_JSON,
  HERMES_EXPENSE_PRICE_CURRENCY: process.env.HERMES_EXPENSE_PRICE_CURRENCY === 'MXN',
};
if (!local) console.log('hermes_gasto_preview_config ' + JSON.stringify(testConfig));
const token = local ? 'local-test-token' : process.env.TELEGRAM_BOT_TOKEN;
const chatId = local ? '1000000001' : process.env.TELEGRAM_PRICE_ALERT_CHAT_ID;
assert.ok(token && /^\d+$/.test(chatId ?? ''), 'Telegram configuration missing');

async function telegramRequest(method, body) {
  const response = await networkFetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  assert.ok(response.ok, 'Telegram identity or destination verification failed');
  const payload = await response.json();
  assert.ok(payload.ok, 'Telegram request rejected');
  return payload.result;
}

if (!local) {
  const bot = await telegramRequest('getMe', {});
  assert.ok(bot.is_bot && bot.username?.toLowerCase() === 'danielgtpbot', 'Unexpected bot');
  const chat = await telegramRequest('getChat', { chat_id: chatId });
  assert.ok(chat.type === 'private' && String(chat.id) === chatId, 'Unexpected destination');
}

const gatewaySecret = randomBytes(24).toString('hex');
Object.assign(process.env, {
  HERMES_AUTH_SECRET: randomBytes(32).toString('hex'),
  HERMES_UPSTREAM_TOKEN: gatewaySecret,
  HERMES_GOOGLE_SHEETS_ID: 'hermes-isolated-fixture',
  HERMES_GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
  HERMES_EXPENSE_PRICE_CURRENCY: 'MXN',
  TELEGRAM_BOT_TOKEN: token,
  TELEGRAM_PRICE_ALERT_CHAT_ID: chatId,
});

GoogleAuth.prototype.request = async ({ url }) => {
  const target = new URL(url);
  assert.equal(target.hostname, 'sheets.googleapis.com');
  assert.ok(decodeURIComponent(target.pathname).endsWith("/hermes-isolated-fixture/values/'02 Gastos'!A2:Q"));
  trace.push('history');
  return { data: { values: expenses } };
};

globalThis.fetch = async (url, options) => {
  const target = new URL(url);
  if (target.hostname === '127.0.0.1') return networkFetch(url, options);
  assert.equal(target.hostname, 'api.telegram.org');
  assert.ok(target.pathname.endsWith('/sendMessage'), 'Unexpected Telegram operation');
  const body = JSON.parse(options.body);
  assert.ok(String(body.chat_id) === chatId, 'Unexpected alert destination');
  assert.ok(outgoing.length === 0, 'Duplicate alert blocked');
  assert.ok(body.text.includes(expectedCode) && body.text.includes(description)
    && body.text.includes('$100.00') && body.text.includes('$125.00')
    && body.text.includes('(+25.0%)'), 'Alert must contain the isolated price change');
  trace.push('telegram');
  outgoing.push(body.text);
  console.log('hermes_gasto_telegram_send_started');
  if (local) return Response.json({ ok: true, result: { message_id: 1 } });
  const response = await networkFetch(url, options);
  const payload = await response.clone().json();
  assert.ok(response.ok && payload.ok && payload.result.chat.type === 'private'
    && String(payload.result.chat.id) === chatId
    && Number.isSafeInteger(payload.result.message_id), 'Telegram delivery not confirmed');
  console.log('hermes_gasto_telegram_api_accepted');
  return response;
};

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
    if (url.pathname === '/api/parts/import') {
      assert.deepEqual(trace, ['save'], 'Save must precede the comparison');
      assert.equal(req.body.notify, true);
      assert.deepEqual(req.body.expense_ids, [expenses[1][0]]);
      trace.push('compare');
      return await parts(req, res);
    }
    if (url.pathname.startsWith('/hermes-api/')) {
      req.query.path = url.pathname.slice('/hermes-api/'.length);
      return await gateway(req, res);
    }
    if (url.pathname.startsWith('/isolated-data/')) {
      assert.ok(req.headers['x-hermes-gateway-token'] === gatewaySecret, 'Expected authenticated gateway');
      if (url.pathname.endsWith('/api/sheets/read')) {
        const data = req.query.tab === '01 Inventario'
          ? [[], [], [], ['1', 'PRUEBA-01', 'Equipo de prueba', '', '', '', '', '', 'Operativo']]
          : req.query.tab === '02 Gastos' ? expenses : [];
        return res.json({ success: true, data });
      }
      if (url.pathname.endsWith('/api/sheets/append') && req.method === 'POST') {
        assert.equal(req.headers['x-hermes-role'], 'gerencia');
        const { tab, values } = req.body;
        assert.equal(tab, '02 Gastos');
        assert.equal(expenses.length, 1);
        assert.equal(values[4], supplier);
        assert.equal(values[7], '125.00');
        assert.equal(values[10], 'PRUEBA-01');
        assert.ok(values[14].includes(expectedCode), 'Expected isolated part');
        expenses.push(values);
        trace.push('save');
        return res.json({ success: true });
      }
      return res.status(404).json({ error: 'No fixture for this endpoint' });
    }
    const resource = extname(url.pathname) ? url.pathname.slice(1) : 'index.html';
    const file = resolve(dist, resource);
    if (!file.startsWith(dist + sep)) return res.status(404).end();
    const content = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    return res.end(content);
  } catch (error) {
    if (local) console.error(error.message);
    else console.error('hermes_gasto_isolated_request_error');
    res.status(500).json({ error: 'Isolated verification failed' });
  }
});

let browser;
let stage = 'server';
try {
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const origin = 'http://127.0.0.1:' + server.address().port;
  process.env.HERMES_UPSTREAM_URL = origin + '/isolated-data';

  stage = 'browser';
  const serverlessChromium = local ? null
    : (await import(pathToFileURL(require.resolve('@sparticuz/chromium', { paths: ['/tmp/hermes-browser'] })))).default;
  browser = await chromium.launch({
    executablePath: local ? '/usr/bin/chromium' : await serverlessChromium.executablePath(),
    headless: true,
    args: local ? ['--no-sandbox'] : serverlessChromium.args,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true,
    deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
  page.setDefaultTimeout(12000);
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());

  stage = 'login';
  await page.goto(origin + '/login');
  const loginResult = page.waitForResponse((response) => response.url() === origin + '/api/auth/login');
  await page.getByRole('button', { name: 'Gerencia', exact: true }).click();
  assert.equal((await loginResult).status(), 200);
  await page.waitForURL((url) => url.pathname !== '/login');

  stage = 'expense_form';
  await page.goto(origin + '/gastos/nuevo');
  await page.getByRole('heading', { name: 'Nuevo Gasto' }).waitFor();
  const consent = page.getByRole('button', { name: 'Cerrar aviso temporalmente' });
  if (await consent.isVisible()) await consent.click();
  await page.getByPlaceholder('Nombre del proveedor').fill(supplier);
  await page.locator('select').filter({ has: page.locator('option[value="PRUEBA-01"]') }).selectOption('PRUEBA-01');
  await page.getByPlaceholder('0.00').first().fill('125');
  await page.getByPlaceholder('Número de parte (opcional)').fill(expectedCode);
  await page.getByPlaceholder('Descripción *').fill(description);
  await page.locator('input[type="number"]').last().fill('125');
  assert.equal(outgoing.length, 0);

  stage = 'form_validation';
  assert.ok(await page.locator('form').evaluate((form) => form.checkValidity()), 'Synthetic expense form is invalid');
  stage = 'submit_click';
  const submit = page.getByRole('button', { name: 'Registrar Gasto', exact: true });
  await submit.click({ trial: true });
  console.log('hermes_gasto_submit_actionable');
  stage = 'save_and_compare';
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url() === origin + '/api/parts/import'),
    submit.click(),
  ]);
  console.log('hermes_gasto_compare_status ' + response.status());
  stage = 'response_and_ui';
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.equal(result.telegram_sent, true);
  assert.equal(result.price_changes.length, 1);
  assert.equal(result.price_changes[0].old_price, 100);
  assert.equal(result.price_changes[0].new_price, 125);
  assert.equal(result.price_changes[0].pct_change, 25);
  assert.deepEqual(trace, ['save', 'compare', 'history', 'telegram']);
  assert.equal(expenses.length, 2);
  assert.equal(outgoing.length, 1);
  await page.getByText('Gasto registrado', { exact: true }).waitFor();
  await page.getByText('Alerta enviada por Telegram.', { exact: true }).waitFor();
  if (local && process.env.HERMES_UI_SCREENSHOT) await page.screenshot({ path: process.env.HERMES_UI_SCREENSHOT });

  console.log('hermes_gasto_ui_verified');
  console.log('hermes_gasto_saved_isolated_once');
  console.log('hermes_gasto_price_100_125_25pct');
  console.log(local ? 'hermes_gasto_telegram_simulated_once' : 'hermes_gasto_telegram_delivered_once');
} catch (error) {
  console.error('hermes_gasto_failed_stage ' + stage);
  if (local) console.error(error);
  else console.error('hermes_gasto_diagnostics ' + JSON.stringify({ trace, outgoing: outgoing.length, errorType: error.name }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.close();
}
