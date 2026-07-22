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
