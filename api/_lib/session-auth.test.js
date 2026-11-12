import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueSession, readSession, requireSession, revokeSession, verifySession } from './session-auth.js';
import { createHermesIdentityFixture } from '../../tests/helpers/hermes-auth-fixture.js';

function useFixture(options) {
  const fixture = createHermesIdentityFixture(options);
  for (const [key, value] of Object.entries(fixture.env)) vi.stubEnv(key, value);
  vi.stubGlobal('fetch', vi.fn(fixture.fetchIdentity));
  return fixture;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('employee session', () => {
  it('keeps only the employee identity and session ID in the cookie', async () => {
    const fixture = useFixture({ role: 'operador', unitScope: 'assigned', assignedUnits: ['CA20'] });
    const token = await issueSession(fixture.membership.user_id);
    const claims = verifySession(token);
    expect(claims).toMatchObject({ v: 2, sub: fixture.membership.user_id });
    expect(claims).not.toHaveProperty('role');
    expect([...fixture.sessions.keys()].every((value) => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    const req = { headers: { cookie: `hermes_session=${token}` } };
    expect(await readSession(req)).toMatchObject({ role: 'operador', unitScope: 'assigned', assignedUnits: ['CA20'] });
  });

  it('checks the current roster for a role change and revocation', async () => {
    const fixture = useFixture({ role: 'mecanico' });
    const req = { headers: { cookie: fixture.cookie } };
    expect((await readSession(req)).role).toBe('mecanico');
    fixture.membership.role = 'supervisor';
    expect((await readSession(req)).role).toBe('supervisor');
    fixture.membership.active = false;
    expect(await readSession(req)).toBeNull();
    fixture.membership.active = true;
    await revokeSession(req);
    expect(await readSession(req)).toBeNull();
  });

  it('rejects a current session assigned to a different project', async () => {
    const fixture = useFixture({ projects: ['otro'] });
    expect(await readSession({ headers: { cookie: fixture.cookie } })).toBeNull();
  });

  it('rejects a protected action for a role without permission', async () => {
    const fixture = useFixture({ role: 'operador' });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    expect(await requireSession({ headers: { cookie: fixture.cookie } }, res, ['gerencia'])).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('does not infer buying approval from the Gerencia role', async () => {
    const fixture = useFixture({ role: 'gerencia' });
    const req = { headers: { cookie: fixture.cookie } };
    expect((await readSession(req)).canApprovePurchases).toBe(false);
    fixture.membership.can_approve_purchases = true;
    expect((await readSession(req)).canApprovePurchases).toBe(true);
  });

  it('resolves Panama warehouse receiving from the current membership and revokes it independently', async () => {
    const fixture = useFixture({ project: 'tmf-panama', role: 'jefe_taller', assignedUnits: ['DZ203'], unitScope: 'assigned' });
    const req = { headers: { cookie: fixture.cookie } };
    expect(await readSession(req, { allowPanama: true })).toMatchObject({
      canReceivePurchases: false, canApprovePurchases: false, assignedUnits: ['DZ203'],
    });
    fixture.membership.can_receive_purchases = true;
    expect((await readSession(req, { allowPanama: true })).canReceivePurchases).toBe(true);
    fixture.membership.can_receive_purchases = false;
    expect((await readSession(req, { allowPanama: true })).canReceivePurchases).toBe(false);
  });

  it('requires a separate Panama HSE review grant for the current reviewer', async () => {
    const fixture = useFixture({ project: 'tmf-panama', role: 'supervisor' });
    const req = { headers: { cookie: fixture.cookie } };
    expect((await readSession(req, { allowPanama: true })).canReviewPanamaHse).toBe(false);
    fixture.membership.can_review_panama_hse = true;
    expect((await readSession(req, { allowPanama: true })).canReviewPanamaHse).toBe(true);
    fixture.membership.role = 'operador';
    expect((await readSession(req, { allowPanama: true })).canReviewPanamaHse).toBe(false);
  });
});
