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

