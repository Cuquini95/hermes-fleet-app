import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, scryptSync } from 'node:crypto';
import { readSession, signSession, verifyRolePin, verifySession } from './session-auth.js';

beforeEach(() => {
  process.env.HERMES_AUTH_SECRET = 'test-only-secret-with-more-than-32-characters';
});

afterEach(() => {
  delete process.env.HERMES_AUTH_SECRET;
  delete process.env.HERMES_PIN_HASH_OPERADOR;
});

describe('Hermes server session security', () => {
  it('signs and verifies an expiring role session', () => {
    const token = signSession('operador');
    expect(verifySession(token)).toMatchObject({ role: 'operador', v: 1 });
  });

  it('rejects a modified token', () => {
    const token = signSession('operador');
    expect(verifySession(`${token}x`)).toBeNull();
  });

  it('reads only the HttpOnly session cookie value supplied by the request', () => {
    const token = signSession('mecanico');
    expect(readSession({ headers: { cookie: `other=1; hermes_session=${token}` } })).toMatchObject({ role: 'mecanico' });
  });

  it('compares configured role PIN hashes without storing plaintext PINs', () => {
    const salt = randomBytes(16).toString('hex');
    process.env.HERMES_PIN_HASH_OPERADOR = `${salt}:${scryptSync('4567', salt, 64).toString('hex')}`;
    expect(verifyRolePin('operador', '4567')).toBe(true);
    expect(verifyRolePin('operador', '7654')).toBe(false);
  });

  it('fails closed when a role PIN hash is not configured', () => {
    expect(() => verifyRolePin('operador', '4567')).toThrow(/not configured/);
  });
});
