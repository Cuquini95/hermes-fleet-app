import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import brainHandler from './chat.js';

const SESSION_SECRET = 'test-session-secret-with-32-plus-chars';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function loginToken(): Promise<string> {
  process.env.HERMES_AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'gerencia',
      role: 'gerencia',
      user_name: 'Gerencia',
      password_sha256: sha256('correct-password'),
    },
  ]);
  process.env.HERMES_AUTH_SESSION_SECRET = SESSION_SECRET;

  const response = await (await import('../auth/login.js')).default.fetch(
    new Request('https://hermes.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'gerencia', role: 'gerencia', password: 'correct-password' }),
    }),
  );
  const body = (await response.json()) as { token: string };
  return body.token;
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'));
  vi.stubGlobal('fetch', vi.fn());
  delete process.env.HERMES_AUTH_USERS_JSON;
  delete process.env.HERMES_AUTH_SESSION_SECRET;
  delete process.env.GTP_BRAIN_URL;
  delete process.env.GTP_BRAIN_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HERMES_AUTH_USERS_JSON;
  delete process.env.HERMES_AUTH_SESSION_SECRET;
  delete process.env.GTP_BRAIN_URL;
  delete process.env.GTP_BRAIN_TOKEN;
});

describe('Brain proxy authentication', () => {
  it('rejects unauthenticated requests without calling the upstream', async () => {
    const response = await brainHandler.fetch(new Request('https://hermes.test/api/brain/chat', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards an authenticated request only through the server-side Brain token', async () => {
    const token = await loginToken();
    process.env.GTP_BRAIN_URL = 'https://brain.test';
    process.env.GTP_BRAIN_TOKEN = 'internal-brain-token';
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const response = await brainHandler.fetch(
      new Request('https://hermes.test/api/brain/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'status' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://brain.test/api/ai/chat',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer internal-brain-token' }),
      }),
    );
  });
});
