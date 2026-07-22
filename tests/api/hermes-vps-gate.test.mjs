import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';

const SECRET = 'hermes-vps-gate-test-secret-32chars-min!';

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function token(role = 'operador', subject = `vps-qa-${Date.now()}`) {
  return `Bearer ${sign({
    sub: subject,
    role,
    exp: new Date(Date.now() + 60_000).toISOString(),
  })}`;
}

function response() {
  const state = { statusCode: 0, body: '', headers: {} };
  return {
    state,
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.statusCode = code; return this; },
    end(body) { state.body = body; },
  };
}

beforeEach(() => {
  process.env.HERMES_AUTH_SESSION_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.HERMES_AUTH_SESSION_SECRET;
  delete process.env.HERMES_UPSTREAM_VPS_TOKEN;
  delete process.env.HERMES_UPSTREAM_SHEETS_TOKEN;
  delete process.env.HERMES_SYNC_TOKEN;
});

test('VPS operation resolver only permits the explicit method/path allowlist', async () => {
  const { resolveVpsOperation } = await import(`../../api/hermes-vps-gate.js?resolver=${Date.now()}`);
  assert.equal(resolveVpsOperation('/hermes-api/api/ocr/receipt', 'POST')?.name, 'ocr-receipt');
  assert.equal(resolveVpsOperation('/hermes-api/parts', 'GET')?.name, 'parts-search');
  assert.equal(resolveVpsOperation('/hermes-api/api/push/send', 'GET'), null);
  assert.equal(resolveVpsOperation('/hermes-api/api/unknown', 'POST'), null);
  assert.equal(resolveVpsOperation('https://evil.example.test/hermes-api/api/push/send', 'POST'), null);
});

test('anonymous VPS proxy requests fail before contacting the upstream', async () => {
  const { default: handler } = await import(`../../api/hermes-vps-gate.js?anonymous=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not forward'); };
  try {
    const res = response();
    await handler({
      method: 'POST',
      headers: {},
      query: { upstreamPath: '/hermes-api/api/push/send' },
      body: { event: 'nueva_falla', data: {} },
    }, res);
    assert.equal(res.state.statusCode, 401);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown catch-all paths fail closed without contacting the upstream', async () => {
  const { default: handler } = await import(`../../api/hermes-vps-gate.js?unknown=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not forward'); };
  try {
    const res = response();
    await handler({
      method: 'POST',
      headers: { authorization: token() },
      query: { upstreamPath: '/hermes-api/api/secret' },
      body: {},
    }, res);
    assert.equal(res.state.statusCode, 404);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('push forwarding requires a valid event and uses the verified actor role', async () => {
  const { default: handler } = await import(`../../api/hermes-vps-gate.js?forward=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  process.env.HERMES_UPSTREAM_VPS_TOKEN = 'vps-service-token';
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return {
      status: 202,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ accepted: true }),
    };
  };
  try {
    const res = response();
    await handler({
      method: 'POST',
      headers: { authorization: token('supervisor', 'push-qa') },
      query: { upstreamPath: '/hermes-api/api/push/send' },
      url: '/api/hermes-vps-gate?upstreamPath=%2Fhermes-api%2Fapi%2Fpush%2Fsend',
      body: { event: 'nueva_falla', data: { unidad: 'CA20' } },
    }, res);
    assert.equal(res.state.statusCode, 202);
    assert.equal(captured.url, 'https://5-78-204-80.sslip.io/hermes-api/api/push/send');
    assert.equal(captured.init.headers.Authorization, 'Bearer vps-service-token');
    assert.equal(captured.init.headers['X-Hermes-Role'], 'supervisor');

    const invalid = response();
    await handler({
      method: 'POST',
      headers: { authorization: token('supervisor', 'push-invalid') },
      query: { upstreamPath: '/hermes-api/api/push/send' },
      body: { event: 'arbitrary', data: {} },
    }, invalid);
    assert.equal(invalid.state.statusCode, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('push subscription role is overwritten with the verified session role', async () => {
  const { default: handler } = await import(`../../api/hermes-vps-gate.js?subscribe=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  process.env.HERMES_UPSTREAM_VPS_TOKEN = 'vps-service-token';
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = init;
    return { status: 200, headers: { get: () => 'application/json' }, text: async () => '{}' };
  };
  try {
    const res = response();
    await handler({
      method: 'POST',
      headers: { authorization: token('operador', 'subscribe-qa') },
      query: { upstreamPath: '/hermes-api/api/push/subscribe' },
      body: { subscription: { endpoint: 'https://push.example.test' }, role: 'gerencia' },
    }, res);
    assert.equal(res.state.statusCode, 200);
    assert.equal(JSON.parse(captured.body).role, 'operador');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Sheets-only upstream credentials cannot authorize the broader VPS proxy', async () => {
  const { default: handler } = await import(`../../api/hermes-vps-gate.js?sheets-only=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  process.env.HERMES_UPSTREAM_SHEETS_TOKEN = 'sheets-only-token';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('must not forward with a Sheets-only token');
  };
  try {
    const res = response();
    await handler({
      method: 'POST',
      headers: { authorization: token('supervisor', 'sheets-only-qa') },
      query: { upstreamPath: '/hermes-api/api/push/send' },
      body: { event: 'nueva_falla', data: {} },
    }, res);
    assert.equal(res.state.statusCode, 503);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
