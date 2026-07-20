import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { requireSession } from './_session.js';

const SECRET = 'test-session-secret-with-32-plus-chars';

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createToken(claims: Record<string, unknown>, secret = SECRET): Promise<string> {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'HMAC' },
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function request(token?: string): Request {
  return new Request('https://hermes.test/api/brain/chat', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

const validClaims = () => ({
  sub: 'gerencia',
  role: 'gerencia',
  user_name: 'Gerencia',
  exp: new Date(Date.now() + 60_000).toISOString(),
});

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'));
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

describe('requireSession', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await requireSession(request());

    expect(response?.status).toBe(401);
  });

  it('fails closed when the session secret is unavailable', async () => {
    const token = await createToken(validClaims());

    const response = await requireSession(request(token));

    expect(response?.status).toBe(503);
  });

  it('accepts a valid signed session', async () => {
    process.env.HERMES_AUTH_SESSION_SECRET = SECRET;
    const token = await createToken(validClaims());

    await expect(requireSession(request(token))).resolves.toBeNull();
  });

  it('rejects expired sessions before forwarding', async () => {
    process.env.HERMES_AUTH_SESSION_SECRET = SECRET;
    const token = await createToken({ ...validClaims(), exp: new Date(Date.now() - 60_000).toISOString() });

    const response = await requireSession(request(token));

    expect(response?.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    process.env.HERMES_AUTH_SESSION_SECRET = SECRET;
    const token = await createToken(validClaims(), 'different-secret-with-32-plus-chars');

    const response = await requireSession(request(token));

    expect(response?.status).toBe(401);
  });
});
