import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const SESSION_SECONDS = 8 * 60 * 60;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function secret() {
  const value = process.env.HERMES_AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('HERMES_AUTH_SECRET is not configured');
  return value;
}

function signature(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function signSession(role) {
  if (!ROLES.has(role)) throw new Error('Invalid role');
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ v: 1, role, iat: now, exp: now + SESSION_SECONDS }));
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, supplied] = token.split('.');
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (claims.v !== 1 || !ROLES.has(claims.role) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export function readSession(req) {
  const cookies = String(req.headers.cookie || '').split(';').map((part) => part.trim());
  const value = cookies.find((part) => part.startsWith('hermes_session='))?.slice('hermes_session='.length);
  try {
    return verifySession(value);
  } catch {
    return null;
  }
}

export function requireSession(req, res, allowedRoles) {
  const claims = readSession(req);
  if (!claims) {
    res.status(401).json({ error: 'Sesión inválida' });
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(claims.role)) {
    res.status(403).json({ error: 'Acción no autorizada para este rol' });
    return null;
  }
  return claims;
}

export function verifyRolePin(role, pin) {
  if (!ROLES.has(role) || !/^\d{4,8}$/.test(pin || '')) return false;
  const key = `HERMES_PIN_HASH_${role.toUpperCase()}`;
  const configured = process.env[key];
  if (!configured) throw new Error(`${key} is not configured`);
  const [salt, expectedHex] = configured.split(':');
  if (!salt || !expectedHex) throw new Error(`${key} has an invalid format`);
  const actual = scryptSync(pin, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sessionCookie(token) {
  return `hermes_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export const clearSessionCookie = 'hermes_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';

export function roleProfile(role) {
  const labels = {
    operador: 'Operador', mecanico: 'Mecánico', jefe_taller: 'Jefe de Taller',
    coordinador: 'Coordinador', supervisor: 'Supervisor', gerencia: 'Gerencia',
  };
  const units = String(process.env[`HERMES_ASSIGNED_UNITS_${role.toUpperCase()}`] || '')
    .split(',').map((unit) => unit.trim()).filter(Boolean);
  return { role, userName: labels[role], assignedUnits: units };
}
