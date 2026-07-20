const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json',
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

type AuthUser = {
  username: string;
  role: string;
  user_name: string;
  assigned_units?: string[];
  password_sha256: string;
};

type LoginRequest = {
  username?: unknown;
  role?: unknown;
  password?: unknown;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status });
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(digest);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function configuredUsers(): AuthUser[] {
  const raw = (process.env.HERMES_AUTH_USERS_JSON || '').trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is AuthUser => {
    if (!item || typeof item !== 'object') return false;
    const user = item as Partial<AuthUser>;
    return (
      typeof user.username === 'string' &&
      typeof user.role === 'string' &&
      ROLES.has(user.role) &&
      typeof user.user_name === 'string' &&
      typeof user.password_sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(user.password_sha256) &&
      (user.assigned_units === undefined || Array.isArray(user.assigned_units))
    );
  });
}

function configuredSessionSecret(): string | null {
  const secret = (process.env.HERMES_AUTH_SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

async function signSession(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64Url(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return json({ detail: 'Method not allowed.' }, 405);
    }

    const users = configuredUsers();
    if (users.length === 0) {
      return json({ detail: 'Hermes auth is not configured.' }, 503);
    }
    const sessionSecret = configuredSessionSecret();
    if (!sessionSecret) {
      return json({ detail: 'Hermes auth session signing is not configured.' }, 503);
    }

    const body = (await request.json().catch(() => ({}))) as LoginRequest;
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !role || !ROLES.has(role) || !password) {
      return json({ detail: 'Invalid credentials.' }, 401);
    }

    const user = users.find((candidate) => candidate.username.toLowerCase() === username && candidate.role === role);
    if (!user) {
      return json({ detail: 'Invalid credentials.' }, 401);
    }

    const passwordHash = await sha256Hex(password);
    if (!safeEqual(passwordHash.toLowerCase(), user.password_sha256.toLowerCase())) {
      return json({ detail: 'Invalid credentials.' }, 401);
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const token = await signSession(
      {
        sub: user.username,
        role: user.role,
        user_name: user.user_name,
        assigned_units: user.assigned_units ?? [],
        exp: expiresAt,
      },
      sessionSecret,
    );

    return json({
      token,
      token_type: 'hmac-session',
      expires_at: expiresAt,
      role: user.role,
      user_name: user.user_name,
      assigned_units: user.assigned_units ?? [],
    });
  },
};
