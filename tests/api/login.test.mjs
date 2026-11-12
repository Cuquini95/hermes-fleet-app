import assert from 'node:assert/strict';
import { test } from 'node:test';
import login from '../../api/auth/login.js';

test('a confirmed employee receives the authorized roster profile and a private session', async (t) => {
  const email = 'mechanic@example.test';
  const userId = '00000000-0000-4000-8000-000000000001';
  for (const [key, value] of Object.entries({
    HERMES_AUTH_SECRET: 'fixture-only-session-signing-material-32bytes',
    HERMES_AUTH_SUPABASE_URL: 'http://127.0.0.1:58888',
    HERMES_AUTH_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable',
    HERMES_AUTH_SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
    HERMES_AUTH_PROJECT: 'tcm',
  })) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }

  t.mock.method(globalThis, 'fetch', async (url) => {
    switch (new URL(url).pathname) {
      case '/auth/v1/token': return Response.json({ user: { id: userId, email, email_confirmed_at: '2026-11-01T00:00:00Z' } });
      case '/rest/v1/hermes_memberships': return Response.json([{
        user_id: userId, email, user_name: 'Mecánico de prueba', role: 'mecanico', projects: ['tcm'],
        assigned_units: ['CA20'], unit_scope: 'assigned', active: true, can_approve_purchases: false,
      }]);
      case '/rest/v1/hermes_sessions': return new Response(null, { status: 201 });
      default: throw new Error('Unexpected fixture request');
    }
  });
  const headers = new Map();
  const result = {};
  const res = {
    setHeader(name, value) { headers.set(name, value); },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await login({ method: 'POST', body: { email, password: 'fixture-password' }, headers: {} }, res);
  assert.equal(result.status, 200);
  assert.equal(result.body.userId, userId);
  assert.equal(result.body.role, 'mecanico');
  assert.match(headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Strict/);
});
