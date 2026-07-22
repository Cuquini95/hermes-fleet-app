import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

function mockResponse() {
  const state = { statusCode: 0, body: null, headers: {} };
  return {
    state,
    setHeader(name, value) {
      state.headers[name] = value;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
    end(body) {
      state.body = body;
      return this;
    },
  };
}

function signSession(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

const PROTECTED_ROUTES = [
  '../../api/intake/chat.js',
  '../../api/parts/import.js',
  '../../api/hermes-ai/diagnose.js',
  '../../api/hermes-ai/manual_lookup.js',
  '../../api/hermes-ai/photo_to_failure.js',
];

test('operational and AI Vercel routes reject anonymous POSTs before side effects', async () => {
  delete process.env.HERMES_AUTH_SESSION_SECRET;

  for (const route of PROTECTED_ROUTES) {
    const { default: handler } = await import(`${route}?route=${encodeURIComponent(route)}`);
    const response = mockResponse();
    await handler({ method: 'POST', headers: {}, body: {} }, response);

    assert.equal(response.state.statusCode, 401, route);
    assert.equal(response.state.body.detail, 'Authentication required.', route);
    assert.equal(response.state.headers['WWW-Authenticate'], 'Bearer', route);
  }
});

test('parts import preserves the admin role boundary after authentication', async () => {
  const secret = 'hermes-protected-route-test-secret-32chars';
  process.env.HERMES_AUTH_SESSION_SECRET = secret;
  const { default: handler } = await import('../../api/parts/import.js?role-boundary=1');
  const response = mockResponse();
  const token = signSession({
    sub: 'operator-1',
    role: 'operador',
    exp: '2099-01-01T00:00:00.000Z',
  }, secret);

  await handler({
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: { supplier: 'test', parts: [] },
  }, response);

  assert.equal(response.state.statusCode, 403);
  assert.equal(response.state.body.detail, 'This role is not authorized for this operation.');
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

test('intake rejects oversized parsed bodies before contacting OpsOS', async () => {
  const secret = 'hermes-intake-body-test-secret-32chars';
  process.env.HERMES_AUTH_SESSION_SECRET = secret;
  process.env.OPSOS_INTAKE_URL = 'https://opsos.example.test';
  process.env.OPSOS_INTAKE_SECRET = 'opsos-service-secret';
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('must not forward');
  };
  try {
    const { default: handler } = await import('../../api/intake/chat.js?body-limit=1');
    const response = mockResponse();
    const token = signSession({
      sub: 'operator-1',
      role: 'operador',
      exp: '2099-01-01T00:00:00.000Z',
    }, secret);

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { text: 'x'.repeat(8 * 1024 * 1024) },
    }, response);

    assert.equal(response.state.statusCode, 413);
    assert.match(response.state.body.error, /Request body is too large/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.HERMES_AUTH_SESSION_SECRET;
    delete process.env.OPSOS_INTAKE_URL;
    delete process.env.OPSOS_INTAKE_SECRET;
  }
});

test('intake rejects oversized streamed bodies before contacting OpsOS', async () => {
  const secret = 'hermes-intake-stream-test-secret-32chars';
  process.env.HERMES_AUTH_SESSION_SECRET = secret;
  process.env.OPSOS_INTAKE_URL = 'https://opsos.example.test';
  process.env.OPSOS_INTAKE_SECRET = 'opsos-service-secret';
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('must not forward');
  };
  try {
    const { default: handler } = await import('../../api/intake/chat.js?body-stream-limit=1');
    const response = mockResponse();
    const token = signSession({
      sub: 'operator-1',
      role: 'operador',
      exp: '2099-01-01T00:00:00.000Z',
    }, secret);
    const request = {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      on(event, callback) {
        if (event === 'data') callback('x'.repeat(8 * 1024 * 1024 + 1));
        if (event === 'end') callback();
      },
    };

    await handler(request, response);

    assert.equal(response.state.statusCode, 413);
    assert.match(response.state.body.error, /Request body is too large/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.HERMES_AUTH_SESSION_SECRET;
    delete process.env.OPSOS_INTAKE_URL;
    delete process.env.OPSOS_INTAKE_SECRET;
  }
});

test('intake returns 400 for malformed streamed JSON', async () => {
  const secret = 'hermes-intake-json-test-secret-32chars';
  process.env.HERMES_AUTH_SESSION_SECRET = secret;
  process.env.OPSOS_INTAKE_URL = 'https://opsos.example.test';
  process.env.OPSOS_INTAKE_SECRET = 'opsos-service-secret';
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('must not forward');
  };
  try {
    const { default: handler } = await import('../../api/intake/chat.js?body-json=1');
    const response = mockResponse();
    const token = signSession({
      sub: 'operator-1',
      role: 'operador',
      exp: '2099-01-01T00:00:00.000Z',
    }, secret);
    const request = {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      on(event, callback) {
        if (event === 'data') callback('{"text":"unterminated"');
        if (event === 'end') callback();
      },
    };

    await handler(request, response);

    assert.equal(response.state.statusCode, 400);
    assert.match(response.state.body.error, /Invalid JSON body/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.HERMES_AUTH_SESSION_SECRET;
    delete process.env.OPSOS_INTAKE_URL;
    delete process.env.OPSOS_INTAKE_SECRET;
  }
});

test('AI routes reject oversized parsed bodies before provider work', async () => {
  const secret = 'hermes-ai-body-test-secret-32chars';
  process.env.HERMES_AUTH_SESSION_SECRET = secret;
  process.env.HERMES_DIAGNOSE_PROVIDER = 'local';
  process.env.HERMES_PHOTO_ANALYSIS_PROVIDER = 'mock';
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('must not forward');
  };
  const routes = [
    '../../api/hermes-ai/diagnose.js',
    '../../api/hermes-ai/manual_lookup.js',
    '../../api/hermes-ai/photo_to_failure.js',
  ];
  try {
    for (const [index, route] of routes.entries()) {
      const { default: handler } = await import(`${route}?body-limit=${index}`);
      const response = mockResponse();
      const token = signSession({
        sub: 'operator-1',
        role: 'operador',
        exp: '2099-01-01T00:00:00.000Z',
      }, secret);

      await handler({
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { text: 'x'.repeat(8 * 1024 * 1024) },
      }, response);

      assert.equal(response.state.statusCode, 413, route);
      assert.match(response.state.body.error, /Request body is too large/, route);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.HERMES_AUTH_SESSION_SECRET;
    delete process.env.HERMES_DIAGNOSE_PROVIDER;
    delete process.env.HERMES_PHOTO_ANALYSIS_PROVIDER;
  }
});

test('AI routes return a stable client error for malformed streamed JSON', async () => {
  const secret = 'hermes-ai-json-test-secret-32chars';
  process.env.HERMES_AUTH_SESSION_SECRET = secret;
  const { default: handler } = await import('../../api/hermes-ai/manual_lookup.js?body-json=2');
  const response = mockResponse();
  const token = signSession({
    sub: 'operator-1',
    role: 'operador',
    exp: '2099-01-01T00:00:00.000Z',
  }, secret);
  const request = {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    on(event, callback) {
      if (event === 'data') callback('{"tema":"unterminated"');
      if (event === 'end') callback();
    },
  };

  try {
    await handler(request, response);
    assert.equal(response.state.statusCode, 400);
    assert.match(response.state.body.error, /Invalid JSON body/);
  } finally {
    delete process.env.HERMES_AUTH_SESSION_SECRET;
  }
});
