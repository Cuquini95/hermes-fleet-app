import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryHandler } from '../../api/auth/recovery.js';

const email = 'recovery@example.invalid';
const userId = 'c2d43dc8-46f9-4b9e-a4c9-0c6532d2da8d';
const profile = { userId, project: 'tmf-panama', role: 'operador' };
const config = { project: 'tmf-panama' };
const ok = (data = {}) => Response.json(data);
function response() {
  return { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
async function invoke(handler, body) {
  const res = response();
  await handler({ method: 'POST', headers: { host: 'test.invalid', origin: 'https://test.invalid' }, body }, res);
  return res;
}

test('recovery delivers only to a scoped member and gives the same response for an unknown address', async () => {
  const calls = [];
  const handler = createRecoveryHandler({
    configured: () => true, config: () => config, findProfile: async (_, address) => address === email ? profile : null,
    request: async (_, path, options) => { calls.push([path,options]); return ok(); },
  });
  const member = await invoke(handler, { action: 'request', email });
  const unknown = await invoke(handler, { action: 'request', email: 'unknown@example.invalid' });
  assert.equal(member.code, 202);
  assert.deepEqual(member.body, unknown.body);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['/auth/v1/recover', { method: 'POST', body: { email }, auth: 'public' }]);
});

test('verified recovery changes the password through the identity provider and revokes Hermes sessions', async () => {
  const calls = [];
  const handler = createRecoveryHandler({
    configured: () => true, config: () => config, findProfile: async () => profile,
    request: async (_, path, options) => {
      calls.push([path, options]);
      return path.endsWith('/verify') ? ok({ user: { id: userId }, access_token: 'synthetic-recovery-session' }) : ok();
    },
  });
  const result = await invoke(handler, { action: 'complete', email, code: '123456', password: 'SyntheticLongPass123!' });
  assert.equal(result.code, 200);
  assert.deepEqual(calls.map(([p]) => p), ['/auth/v1/verify', '/rest/v1/hermes_sessions', '/auth/v1/user', '/auth/v1/logout']);
  assert.equal(calls[2][1].accessToken, 'synthetic-recovery-session');
  assert.equal(calls[1][1].query.user_id, 'eq.' + userId);
  assert.equal(calls[0][1].body.type, 'recovery');
  assert.equal(JSON.stringify(result.body).includes('synthetic'), false);
});

test('recovery skips account changes when provider proof is invalid', async () => {
  const calls = [];
  const handler = createRecoveryHandler({
    configured: () => true, config: () => config, findProfile: async () => profile,
    request: async (_, path) => { calls.push(path); return Response.json({}, { status: 403 }); },
  });
  const result = await invoke(handler, { action: 'complete', email, code: '123456', password: 'SyntheticLongPass123!' });
  assert.equal(result.code, 400);
  assert.deepEqual(calls, ['/auth/v1/verify']);
});
