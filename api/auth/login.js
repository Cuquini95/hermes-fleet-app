/**
 * Hermes production login — fail-closed when auth env is missing/malformed.
 * Env: HERMES_AUTH_USERS_JSON, HERMES_AUTH_SESSION_SECRET (>=32 chars)
 */
import crypto from 'node:crypto';
import { rejectIfRateLimited } from '../_rate-limit.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = 'hermes_session';
const MAX_LOGIN_BODY_BYTES = 16 * 1024;
const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json');
  response.status(status).end(JSON.stringify(body));
}

function base64Url(bufferOrString) {
  const buf = Buffer.isBuffer(bufferOrString)
    ? bufferOrString
    : Buffer.from(String(bufferOrString), 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function configuredUsers() {
  const raw = String(process.env.HERMES_AUTH_USERS_JSON || '').trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    return (
      typeof item.username === 'string' &&
      typeof item.role === 'string' &&
      ROLES.has(item.role) &&
      typeof item.user_name === 'string' &&
      typeof item.password_sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(item.password_sha256) &&
      (item.assigned_units === undefined || Array.isArray(item.assigned_units))
    );
  });
}

function configuredSessionSecret() {
  const secret = String(process.env.HERMES_AUTH_SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

function signSession(payload, secret) {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64Url(signature)}`;
}

function readBody(request) {
  return new Promise((resolve) => {
    const declaredLength = Number(request.headers?.['content-length'] || request.headers?.['Content-Length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGIN_BODY_BYTES) {
      resolve({ tooLarge: true });
      return;
    }

    if (request.body !== undefined && request.body !== null && typeof request.body === 'object') {
      if (Buffer.byteLength(JSON.stringify(request.body), 'utf8') > MAX_LOGIN_BODY_BYTES) {
        resolve({ tooLarge: true });
        return;
      }
      resolve({ body: request.body });
      return;
    }
    if (typeof request.body === 'string') {
      if (Buffer.byteLength(request.body, 'utf8') > MAX_LOGIN_BODY_BYTES) {
        resolve({ tooLarge: true });
        return;
      }
      try {
        resolve({ body: request.body.trim() ? JSON.parse(request.body) : {} });
      } catch {
        resolve({ invalid: true });
      }
      return;
    }

    let raw = '';
    let size = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      const text = String(chunk);
      size += Buffer.byteLength(text, 'utf8');
      if (size <= MAX_LOGIN_BODY_BYTES) raw += text;
      else tooLarge = true;
    });
    request.on('end', () => {
      if (tooLarge) {
        resolve({ tooLarge: true });
        return;
      }
      if (!raw) {
        resolve({ body: {} });
        return;
      }
      try {
        resolve({ body: JSON.parse(raw) });
      } catch {
        resolve({ invalid: true });
      }
    });
    request.on('error', () => resolve({ invalid: true }));
  });
}

function sessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { detail: 'Method not allowed.' });
  }

  if (rejectIfRateLimited(request, response, { scope: 'login', limit: 10 })) return;

  const users = configuredUsers();
  if (users.length === 0) {
    return sendJson(response, 503, { detail: 'Hermes auth is not configured.' });
  }
  const sessionSecret = configuredSessionSecret();
  if (!sessionSecret) {
    return sendJson(response, 503, { detail: 'Hermes auth session signing is not configured.' });
  }

  const bodyResult = await readBody(request);
  if (bodyResult.tooLarge) {
    return sendJson(response, 413, { detail: 'Request body is too large.' });
  }
  if (bodyResult.invalid) {
    return sendJson(response, 400, { detail: 'Invalid JSON body.' });
  }
  const body = bodyResult.body || {};
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !role || !ROLES.has(role) || !password) {
    return sendJson(response, 401, { detail: 'Invalid credentials.' });
  }

  const user = users.find(
    (candidate) => candidate.username.toLowerCase() === username && candidate.role === role,
  );
  if (!user) {
    return sendJson(response, 401, { detail: 'Invalid credentials.' });
  }

  const passwordHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
  if (!safeEqual(passwordHash.toLowerCase(), String(user.password_sha256).toLowerCase())) {
    return sendJson(response, 401, { detail: 'Invalid credentials.' });
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const token = signSession(
    {
      sub: user.username,
      role: user.role,
      user_name: user.user_name,
      assigned_units: user.assigned_units ?? [],
      exp: expiresAt,
    },
    sessionSecret,
  );

  response.setHeader('Set-Cookie', sessionCookie(token));
  return sendJson(response, 200, {
    token,
    token_type: 'hmac-session',
    expires_at: expiresAt,
    role: user.role,
    user_name: user.user_name,
    assigned_units: user.assigned_units ?? [],
  });
}
