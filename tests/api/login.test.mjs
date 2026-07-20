import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';

const SECRET = 'hermes-auth-prod-test-secret-32chars-min!!';
const PASSWORD = 'ReleaseQaProbe2026!';
const PASSWORD_HASH = createHash('sha256').update(PASSWORD, 'utf8').digest('hex');

function mockRequest(method, body) {
  return {
    method,
    body,
    on() {},
  };
}

function mockResponse() {
  const state = { statusCode: 0, body: '', headers: {} };
  return {
    state,
    setHeader(k, v) {
      state.headers[k] = v;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    end(payload) {
      state.body = payload;
    },
  };
}

beforeEach(() => {
  process.env.HERMES_AUTH_SESSION_SECRET = SECRET;
  process.env.HERMES_AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'release_qa',
      role: 'operador',
      user_name: 'Release QA',
      assigned_units: [],
      password_sha256: PASSWORD_HASH,
    },
  ]);
});

afterEach(() => {
  delete process.env.HERMES_AUTH_SESSION_SECRET;
  delete process.env.HERMES_AUTH_USERS_JSON;
});

test('rejects non-POST methods', async () => {
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now()}`);
  const res = mockResponse();
  await handler(mockRequest('GET'), res);
  assert.equal(res.state.statusCode, 405);
});

test('fails closed when users env missing', async () => {
  delete process.env.HERMES_AUTH_USERS_JSON;
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now() + 1}`);
  const res = mockResponse();
  await handler(mockRequest('POST', { username: 'x', role: 'operador', password: 'y' }), res);
  assert.equal(res.state.statusCode, 503);
});

test('rejects invalid credentials with 401', async () => {
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now() + 2}`);
  const res = mockResponse();
  await handler(
    mockRequest('POST', { username: 'release_qa', role: 'operador', password: 'wrong-password' }),
    res,
  );
  assert.equal(res.state.statusCode, 401);
  assert.match(res.state.body, /Invalid credentials/);
});

test('issues session for valid credentials', async () => {
  const { default: handler } = await import(`../../api/auth/login.js?t=${Date.now() + 3}`);
  const res = mockResponse();
  await handler(
    mockRequest('POST', { username: 'release_qa', role: 'operador', password: PASSWORD }),
    res,
  );
  assert.equal(res.state.statusCode, 200);
  const parsed = JSON.parse(res.state.body);
  assert.equal(typeof parsed.token, 'string');
  assert.ok(parsed.token.includes('.'));
  assert.equal(parsed.role, 'operador');
});


