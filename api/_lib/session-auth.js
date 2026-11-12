import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  identityConfig, insertIdentitySession, isIdentityUserId, resolveIdentitySession, revokeIdentitySession,
} from './hermes-identity.js';

const SESSION_SECONDS = 8 * 60 * 60;
const SESSION_ID = /^[\w-]{43}$/;

function signature(payload) {
  const secret = process.env.HERMES_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('HERMES_AUTH_SECRET is not configured');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signSession({ userId, sessionId, issuedAt = Math.floor(Date.now() / 1000) }) {
  if (!isIdentityUserId(userId) || !SESSION_ID.test(sessionId)) throw new Error('Invalid employee session');
  const claims = { v: 2, sub: userId.toLowerCase(), sid: sessionId, iat: issuedAt, exp: issuedAt + SESSION_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token) {
  if (typeof token !== 'string' || !token || token.length > 2048) return null;
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra !== undefined) return null;
  try {
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (claims.v !== 2 || !isIdentityUserId(claims.sub) || !SESSION_ID.test(claims.sid)
      || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > now + 30
      || claims.exp !== claims.iat + SESSION_SECONDS || claims.exp <= now) return null;
    return claims;
  } catch { return null; }
}

function sessionClaims(req) {
  const cookies = String(req.headers?.cookie || '').split(';').map((part) => part.trim());
  const value = cookies.find((part) => part.startsWith('hermes_session='))?.slice('hermes_session='.length);
  return verifySession(value);
}

export function sessionHash(sessionId) {
  return createHash('sha256').update(sessionId).digest('hex');
}

export async function issueSession(userId, config = identityConfig()) {
  const sessionId = randomBytes(32).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = signSession({ userId, sessionId, issuedAt });
  await insertIdentitySession(config, sessionHash(sessionId), userId, issuedAt + SESSION_SECONDS);
  return token;
}

export async function readSession(req) {
  const claims = sessionClaims(req);
  if (!claims) return null;
  return resolveIdentitySession(identityConfig(), sessionHash(claims.sid), claims.sub);
}

export async function requireSession(req, res, allowedRoles, { allowPanama = false } = {}) {
  let session;
  try { session = await readSession(req); }
  catch {
    res.status(503).json({ error: 'No se pudo verificar la sesión. Intenta de nuevo.' });
    return null;
  }
  if (!session) {
    res.status(401).json({ error: 'Sesión inválida' });
    return null;
  }
  if ((!allowPanama && session.project === 'tmf-panama') || (allowedRoles && !allowedRoles.includes(session.role))) {
    res.status(403).json({ error: 'Acción no autorizada para este rol' });
    return null;
  }
  return session;
}

export async function revokeSession(req) {
  const claims = sessionClaims(req);
  if (claims) await revokeIdentitySession(identityConfig(), sessionHash(claims.sid), claims.sub);
}

export function isSameOriginAuthRequest(req) {
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers?.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; }
  catch { return false; }
}

export function sessionCookie(token) {
  return `hermes_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export const clearSessionCookie = 'hermes_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
