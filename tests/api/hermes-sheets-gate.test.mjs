import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';

const SECRET = 'hermes-sheets-gate-test-secret-32chars-min!';

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

beforeEach(() => {
  process.env.HERMES_AUTH_SESSION_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.HERMES_AUTH_SESSION_SECRET;
  delete process.env.HERMES_UPSTREAM_SHEETS_TOKEN;
  delete process.env.HERMES_SYNC_TOKEN;
});

test('verifyBearer rejects missing authorization', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now()}`);
  const result = verifyBearer(undefined);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('verifyBearer rejects invalid signature', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 1}`);
  const result = verifyBearer('Bearer not-a-valid-token');
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('verifyBearer accepts valid unexpired session', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 2}`);
  const token = sign({
    sub: 'score_qa',
    role: 'operador',
    exp: new Date(Date.now() + 60_000).toISOString(),
  });
  const result = verifyBearer(`Bearer ${token}`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.session, {
    sub: 'score_qa',
    role: 'operador',
    user_name: '',
    assigned_units: [],
  });
});

test('verifyBearer accepts a valid HttpOnly session cookie when Bearer is absent', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 20}`);
  const token = sign({
    sub: 'score_qa',
    role: 'gerencia',
    exp: new Date(Date.now() + 60_000).toISOString(),
  });
  const result = verifyBearer(undefined, `hermes_session=${encodeURIComponent(token)}`);
  assert.equal(result.ok, true);
  assert.equal(result.session.role, 'gerencia');
});

test('verifyBearer rejects expired session', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 3}`);
  const token = sign({
    sub: 'score_qa',
    role: 'operador',
    exp: new Date(Date.now() - 60_000).toISOString(),
  });
  const result = verifyBearer(`Bearer ${token}`);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('verifyBearer rejects a signed session with a malformed expiration', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 30}`);
  const token = sign({
    sub: 'score_qa',
    role: 'operador',
    exp: 'not-a-date',
  });
  const result = verifyBearer(`Bearer ${token}`);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('verifyBearer rejects a signed session without an actor subject', async () => {
  const { verifyBearer } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 4}`);
  const token = sign({
    role: 'operador',
    exp: new Date(Date.now() + 60_000).toISOString(),
  });
  const result = verifyBearer(`Bearer ${token}`);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('resolveSheetOperation allowlists the read and write operations with their methods', async () => {
  const { resolveSheetOperation } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 5}`);
  assert.equal(resolveSheetOperation('/hermes-api/api/sheets/read', 'GET')?.operation, 'read');
  assert.equal(resolveSheetOperation('/hermes-api/api/sheets/append', 'POST')?.operation, 'append');
  assert.equal(resolveSheetOperation('/hermes-api/api/sheets/read', 'POST'), null);
  assert.equal(resolveSheetOperation('/hermes-api/api/sheets/secret', 'GET'), null);
  assert.equal(resolveSheetOperation('https://evil.example.test/read', 'GET'), null);
});

test('authorizeSheetTab applies the role boundary to sensitive sheet tabs', async () => {
  const { authorizeSheetTab } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 8}`);
  const operator = { role: 'operador' };
  const manager = { role: 'gerencia' };
  assert.equal(authorizeSheetTab(operator, 'read', 'Averias'), true);
  assert.equal(authorizeSheetTab(operator, 'write', '02 Gastos'), false);
  assert.equal(authorizeSheetTab(manager, 'write', '02 Gastos'), true);
  assert.equal(authorizeSheetTab(manager, 'write', 'Ã“rdenes de Compra'), true);
  assert.equal(authorizeSheetTab({ role: 'mecanico' }, 'write', 'ORDENES_TRABAJO'), true);
  assert.equal(authorizeSheetTab({ role: 'viewer' }, 'read', 'Averias'), false);
  assert.equal(authorizeSheetTab(operator, 'read', 'Payroll_Secrets'), false);
});

test('sheet gateway rejects unknown operations before contacting the VPS', async () => {
  const { default: handler } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 6}`);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('must not forward');
  };
  try {
    const res = mockResponse();
    await handler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${sign({ sub: 'score_qa', role: 'operador', exp: new Date(Date.now() + 60_000).toISOString() })}` },
        query: { upstreamPath: '/hermes-api/api/sheets/not-a-real-operation' },
        url: '/api/hermes-sheets-gate?upstreamPath=%2Fhermes-api%2Fapi%2Fsheets%2Fnot-a-real-operation',
      },
      res,
    );
    assert.equal(res.state.statusCode, 404);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sheet gateway fails closed when the VPS service token is missing', async () => {
  const { default: handler } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 9}`);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('must not forward');
  };
  try {
    const res = mockResponse();
    await handler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${sign({ sub: 'score_qa', role: 'operador', exp: new Date(Date.now() + 60_000).toISOString() })}` },
        query: { upstreamPath: '/hermes-api/api/sheets/read' },
        url: '/api/hermes-sheets-gate?upstreamPath=%2Fhermes-api%2Fapi%2Fsheets%2Fread&tab=Averias',
      },
      res,
    );
    assert.equal(res.state.statusCode, 503);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sheet gateway forwards verified actor claims and correlation ID', async () => {
  const { default: handler } = await import(`../../api/hermes-sheets-gate.js?t=${Date.now() + 7}`);
  const originalFetch = globalThis.fetch;
  let captured;
  process.env.HERMES_UPSTREAM_SHEETS_TOKEN = 'vps-service-token';
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return {
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ data: [] }),
    };
  };
  try {
    const token = sign({
      sub: 'score_qa',
      user_name: 'Score QA',
      role: 'operador',
      assigned_units: ['CA25'],
      exp: new Date(Date.now() + 60_000).toISOString(),
    });
    const res = mockResponse();
    await handler(
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          'x-correlation-id': 'qa-correlation-001',
        },
        query: { upstreamPath: '/hermes-api/api/sheets/read' },
        url: '/api/hermes-sheets-gate?upstreamPath=%2Fhermes-api%2Fapi%2Fsheets%2Fread&tab=Averias',
      },
      res,
    );
    assert.equal(res.state.statusCode, 200);
    assert.equal(res.state.headers['X-Correlation-ID'], 'qa-correlation-001');
    assert.equal(captured.url, 'https://5-78-204-80.sslip.io/hermes-api/api/sheets/read?tab=Averias');
    assert.equal(captured.init.headers['X-Hermes-Actor'], 'score_qa');
    assert.equal(captured.init.headers['X-Hermes-Role'], 'operador');
    assert.equal(captured.init.headers['X-Hermes-Assigned-Units'], '["CA25"]');
    assert.equal(captured.init.headers['X-Correlation-ID'], 'qa-correlation-001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function mockResponse() {
  const state = { statusCode: 0, body: '', headers: {} };
  return {
    state,
    setHeader(name, value) {
      state.headers[name] = value;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    end(body) {
      state.body = body;
    },
  };
}

