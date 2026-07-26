import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';

const SECRET = 'hermes-auth-prod-test-secret-32chars-min!!';
const PIN = '2468';
const PIN_SALT = 'release-qa-salt';

function mockRequest(method, body) {
  return { method, body, headers: {}, on() {} };
}

function mockResponse() {
  const state = { statusCode: 0, body: '', headers: {} };
  return {
    state,
    setHeader(key, value) {
      state.headers[key] = value;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = JSON.stringify(payload);
      return this;
    },
    end(payload) {
      state.body = payload;
    },
  };
}

beforeEach(() => {
  process.env.HERMES_AUTH_SECRET = SECRET;
  process.env.HERMES_PIN_HASH_OPERADOR = `${PIN_SALT}:${scryptSync(PIN, PIN_SALT, 64).toString('hex')}`;
});

afterEach(() => {
  delete process.env.HERMES_AUTH_SECRET;
  delete process.env.HERMES_PIN_HASH_OPERADOR;
});

test('rejects non-POST methods', async () => {
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now()}`);
  const res = mockResponse();
  await handler(mockRequest('GET'), res);
  assert.equal(res.state.statusCode, 405);
});

test('fails closed when role PIN configuration is missing', async () => {
  delete process.env.HERMES_PIN_HASH_OPERADOR;
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now() + 1}`);
  const res = mockResponse();
  await handler(mockRequest('POST', { role: 'operador', pin: PIN }), res);
  assert.equal(res.state.statusCode, 503);
});

test('rejects invalid credentials with 401', async () => {
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now() + 2}`);
  const res = mockResponse();
  await handler(mockRequest('POST', { role: 'operador', pin: '1111' }), res);
  assert.equal(res.state.statusCode, 401);
  assert.match(res.state.body, /inv/i);
});

test('issues an HttpOnly session cookie for valid credentials', async () => {
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now() + 3}`);
  const res = mockResponse();
  await handler(mockRequest('POST', { role: 'operador', pin: PIN }), res);
  assert.equal(res.state.statusCode, 200);
  const parsed = JSON.parse(res.state.body);
  assert.equal(parsed.role, 'operador');
  assert.match(String(res.state.headers['Set-Cookie']), /^hermes_session=/);
});
