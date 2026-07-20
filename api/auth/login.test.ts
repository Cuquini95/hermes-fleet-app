import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authHandler from './login';

const SESSION_SECRET = 'test-session-secret-with-32-plus-chars';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function configureUsers() {
  process.env.HERMES_AUTH_USERS_JSON = JSON.stringify([
    {
      username: 'gerencia',
      role: 'gerencia',
      user_name: 'Gerencia',
      assigned_units: ['CV101', 'CV102'],
      password_sha256: sha256('correct-password'),
    },
  ]);
}

function request(body: unknown, method = 'POST'): Request {
  return new Request('https://hermes.test/api/auth/login', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'));
  delete process.env.HERMES_AUTH_USERS_JSON;
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HERMES_AUTH_USERS_JSON;
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

describe('/api/auth/login', () => {
  it('rejects non-POST requests', async () => {
    const response = await authHandler.fetch(request({}, 'GET'));

    expect(response.status).toBe(405);
    expect(await readJson(response)).toMatchObject({ detail: 'Method not allowed.' });
  });

  it('returns 503 when no server-side auth users are configured', async () => {
    const response = await authHandler.fetch(
      request({ username: 'gerencia', role: 'gerencia', password: 'correct-password' }),
    );

    expect(response.status).toBe(503);
    expect(await readJson(response)).toMatchObject({ detail: 'Hermes auth is not configured.' });
  });

  it('fails closed when the server-side auth configuration is malformed', async () => {
    process.env.HERMES_AUTH_USERS_JSON = '{not-json';

    const response = await authHandler.fetch(
      request({ username: 'gerencia', role: 'gerencia', password: 'correct-password' }),
    );

    expect(response.status).toBe(503);
    expect(await readJson(response)).toMatchObject({ detail: 'Hermes auth is not configured.' });
  });

  it('returns 503 when the session signing secret is missing', async () => {
    configureUsers();

    const response = await authHandler.fetch(
      request({ username: 'gerencia', role: 'gerencia', password: 'correct-password' }),
    );

    expect(response.status).toBe(503);
    expect(await readJson(response)).toMatchObject({
      detail: 'Hermes auth session signing is not configured.',
    });
  });

  it('rejects invalid credentials without returning a token', async () => {
    configureUsers();
    process.env.HERMES_AUTH_SESSION_SECRET = SESSION_SECRET;

    const response = await authHandler.fetch(
      request({ username: 'gerencia', role: 'gerencia', password: 'wrong-password' }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ detail: 'Invalid credentials.' });
    expect(body.token).toBeUndefined();
  });

  it('returns an HMAC session for a configured user and matching password', async () => {
    configureUsers();
    process.env.HERMES_AUTH_SESSION_SECRET = SESSION_SECRET;

    const response = await authHandler.fetch(
      request({ username: 'Gerencia', role: 'gerencia', password: 'correct-password' }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      token_type: 'hmac-session',
      role: 'gerencia',
      user_name: 'Gerencia',
      assigned_units: ['CV101', 'CV102'],
    });
    expect(String(body.token)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(String(body.token)).not.toContain('correct-password');
  });
});
