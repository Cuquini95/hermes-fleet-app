import { randomBytes } from 'node:crypto';
import { sessionHash, signSession } from '../../api/_lib/session-auth.js';

export function createHermesIdentityFixture({
  role = 'gerencia', project = 'tcm', projects = [project], assignedUnits = [], unitScope = 'all',
  canApprovePurchases = false, active = true, userId = '00000000-0000-4000-8000-000000000001',
  email = 'employee@example.test', userName = 'Usuario de prueba',
} = {}) {
  const env = {
    HERMES_AUTH_SECRET: 'fixture-only-session-signing-material-32bytes',
    HERMES_AUTH_SUPABASE_URL: 'https://identity.example.test',
    HERMES_AUTH_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable',
    HERMES_AUTH_SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
    HERMES_AUTH_PROJECT: project,
  };
  const membership = {
    user_id: userId, email, user_name: userName, role, projects, assigned_units: assignedUnits, unit_scope: unitScope,
    active, can_approve_purchases: canApprovePurchases,
  };
  const sessionId = randomBytes(32).toString('base64url');
  const hash = sessionHash(sessionId);
  const sessions = new Map([[hash, { user_id: userId, expires_at: new Date(Date.now() + 3600_000).toISOString() }]]);

  return {
    env, membership, sessions,
    get cookie() { return `hermes_session=${signSession({ userId, sessionId })}`; },
    fetchIdentity(input, init = {}) {
      const url = new URL(input);
      if (url.origin !== env.HERMES_AUTH_SUPABASE_URL) return null;
      const method = init.method || 'GET';
      if (url.pathname === '/auth/v1/token' && method === 'POST') {
        const body = JSON.parse(init.body);
        if (body.email !== email || body.password !== 'fixture-password') return Response.json({}, { status: 400 });
        return Response.json({ user: { id: userId, email, email_confirmed_at: '2026-11-01T00:00:00Z' } });
      }
      if (url.pathname === '/rest/v1/hermes_memberships' && method === 'GET') return Response.json([membership]);
      if (url.pathname === '/rest/v1/hermes_sessions') {
        const requestedHash = url.searchParams.get('session_hash')?.replace(/^eq\./, '');
        if (method === 'POST') {
          const row = JSON.parse(init.body);
          sessions.set(row.session_hash, row);
          return new Response(null, { status: 201 });
        }
        if (method === 'DELETE') {
          sessions.delete(requestedHash);
          return new Response(null, { status: 204 });
        }
        const row = sessions.get(requestedHash);
        return Response.json(row ? [{ ...row, hermes_memberships: membership }] : []);
      }
      throw new Error(`Unexpected isolated identity path: ${url.pathname}`);
    },
  };
}
