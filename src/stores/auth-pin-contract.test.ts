/**
 * Contract: client MOCK_USERS is the offline-only multi-role QA fallback.
 * Production online authentication is verified by /api/auth/login instead.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from './auth-store';

const EXPECTED_PINS: Record<string, string> = {
  operador: '2026',
  mecanico: '2015',
  jefe_taller: '1995',
  coordinador: '2001',
  supervisor: '2008',
  gerencia: '1963',
};

describe('auth PIN contract (shipped MOCK_USERS)', () => {
  it('exposes all six production roles', () => {
    expect(Object.keys(MOCK_USERS).sort()).toEqual(Object.keys(EXPECTED_PINS).sort());
  });

  it('matches vault/e2e PIN map for every role', () => {
    for (const [role, pin] of Object.entries(EXPECTED_PINS)) {
      expect(MOCK_USERS[role as keyof typeof MOCK_USERS].pin).toBe(pin);
      expect(pin).toHaveLength(4);
    }
  });

  it('produces stable sha256 digests for offline QA documentation', () => {
    const digests: Record<string, string> = {};
    for (const [role, pin] of Object.entries(EXPECTED_PINS)) {
      digests[role] = createHash('sha256').update(pin, 'utf8').digest('hex');
      expect(digests[role]).toMatch(/^[a-f0-9]{64}$/);
    }
    // Spot-check non-empty uniqueness
    expect(new Set(Object.values(digests)).size).toBe(6);
  });
});
