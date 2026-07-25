/**
 * Fail-closed gate for Hermes sheet proxy traffic.
 * Requires a valid Authorization: Bearer session before forwarding to VPS.
 */
import crypto from 'node:crypto';
import { rejectIfRateLimited } from './_rate-limit.js';

const UPSTREAM = 'https://5-78-204-80.sslip.io';
const SESSION_COOKIE_NAME = 'hermes_session';
const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const SHEET_PATH_PREFIX = '/hermes-api/api/sheets/';
const SHEET_OPERATIONS = new Map([
  ['read', new Set(['GET', 'HEAD'])],
  ['append', new Set(['POST'])],
  ['update', new Set(['POST'])],
  ['upsert-row', new Set(['POST'])],
  ['delete-row', new Set(['POST'])],
]);
const ALL_ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const ADMIN_ROLES = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const MANAGEMENT_ROLES = new Set(['jefe_taller', 'coordinador', 'gerencia']);
const GERENCIA_ONLY = new Set(['gerencia']);
const FIELD_OPERATIONS_ROLES = new Set(['operador', 'coordinador', 'supervisor', 'gerencia']);

const SHEET_ROLE_RULES = [
  { pattern: /^(averias|ordenes_trabajo|ot_status_log|14 inspecciones|inspeccion_stickers|inspeccion_hallazgos|incidentes)$/, roles: ALL_ROLES },
  { pattern: /^(combustible|04b registro hor|reporte_fletes_|reporte_viajes_)/, roles: FIELD_OPERATIONS_ROLES },
  { pattern: /^(01 inventario|05 historial pm|ordenes mantenimiento|12 inventario rep|13 neum|turnos)/, roles: ADMIN_ROLES },
  { pattern: /^(cotizaciones_pendientes|workshop_schedule)/, roles: ADMIN_ROLES },
  { pattern: /^(02 gastos)/, roles: MANAGEMENT_ROLES },
  { pattern: /(proveedores|rdenes de compra|ordenes de compra|oc_lineas)/, roles: GERENCIA_ONLY },
];

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify(body));
}

function sessionSecret() {
  const secret = String(process.env.HERMES_AUTH_SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

function decodeBase64Url(value) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
}

function readSessionCookie(cookieHeader) {
  if (typeof cookieHeader !== 'string') return '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

export function verifyBearer(authHeader, cookieHeader) {
  let token = '';
  if (authHeader !== undefined && authHeader !== null) {
    if (typeof authHeader !== 'string') {
      return { ok: false, status: 401, detail: 'Authentication required.' };
    }
    const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader.trim());
    if (!match) return { ok: false, status: 401, detail: 'Authentication required.' };
    token = match[1];
  } else {
    token = readSessionCookie(cookieHeader);
  }
  if (!token) return { ok: false, status: 401, detail: 'Authentication required.' };
  const secret = sessionSecret();
  if (!secret) return { ok: false, status: 503, detail: 'Hermes auth session signing is not configured.' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, status: 401, detail: 'Invalid session.' };
  const [encodedPayload, encodedSignature] = parts;
  const payloadBuf = decodeBase64Url(encodedPayload);
  const sigBuf = decodeBase64Url(encodedSignature);
  if (!payloadBuf || !sigBuf) return { ok: false, status: 401, detail: 'Invalid session.' };

  const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  if (expected.length !== sigBuf.length || !crypto.timingSafeEqual(expected, sigBuf)) {
    return { ok: false, status: 401, detail: 'Invalid session.' };
  }

  let payload;
  try {
    payload = JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return { ok: false, status: 401, detail: 'Invalid session.' };
  }
  const expiresAt = typeof payload?.exp === 'string' ? Date.parse(payload.exp) : Number.NaN;
  if (
    !payload ||
    typeof payload.sub !== 'string' ||
    !payload.sub.trim() ||
    typeof payload.role !== 'string' ||
    !ROLES.has(payload.role) ||
    typeof payload.exp !== 'string' ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return { ok: false, status: 401, detail: 'Invalid or expired session.' };
  }
  return {
    ok: true,
    session: {
      sub: payload.sub.trim(),
      role: payload.role,
      user_name: typeof payload.user_name === 'string' ? payload.user_name : '',
      assigned_units: Array.isArray(payload.assigned_units)
        ? payload.assigned_units.filter((unit) => typeof unit === 'string').map((unit) => unit.trim()).filter(Boolean)
        : [],
    },
  };
}

export function resolveSheetOperation(rawPath, method) {
  if (typeof rawPath !== 'string' || !rawPath.startsWith(SHEET_PATH_PREFIX)) return null;
  const operation = rawPath.slice(SHEET_PATH_PREFIX.length);
  const allowedMethods = SHEET_OPERATIONS.get(operation);
  if (!allowedMethods || !allowedMethods.has(method)) return null;
  return { operation, path: `${SHEET_PATH_PREFIX}${operation}` };
}

function normalizeTabName(tab) {
  return String(tab || '').trim().toLocaleLowerCase('es-MX').replace(/\s+/g, ' ');
}

export function authorizeSheetTab(session, operation, tab) {
  if (!session || !ALL_ROLES.has(session.role)) return false;
  const normalized = normalizeTabName(tab);
  if (!normalized) return false;
  const rule = SHEET_ROLE_RULES.find(({ pattern }) => pattern.test(normalized));
  if (!rule) return false;
  return rule.roles.has(session.role);
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
      resolve(Buffer.from(JSON.stringify(req.body)));
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.alloc(0)));
  });
}

export default async function handler(req, res) {
  const auth = verifyBearer(
    req.headers.authorization || req.headers.Authorization,
    req.headers.cookie || req.headers.Cookie,
  );
  if (!auth.ok) {
    return sendJson(res, auth.status, { detail: auth.detail });
  }
  if (rejectIfRateLimited(req, res, { scope: 'sheets', limit: 120 }, auth.session.sub)) return;

  const requestedPath = typeof req.query?.upstreamPath === 'string'
    ? req.query.upstreamPath
    : `${SHEET_PATH_PREFIX}read`;
  const operation = resolveSheetOperation(requestedPath, req.method || 'GET');
  if (!operation) {
    return sendJson(res, 404, { detail: 'Sheets operation is not available through this gateway.' });
  }

  const correlationId = String(
    req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID(),
  ).slice(0, 120);
  res.setHeader('X-Correlation-ID', correlationId);

  // Preserve client query string (tab, range, etc.) excluding our rewrite param.
  const url = new URL(req.url || '/', 'http://localhost');
  const params = new URLSearchParams(url.search);
  params.delete('upstreamPath');
  const qs = params.toString();
  const upstreamUrl = `${UPSTREAM}${operation.path}${qs ? `?${qs}` : ''}`;

  const bodyBuf = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req);
  let body = null;
  if (bodyBuf && bodyBuf.length) {
    try {
      body = JSON.parse(bodyBuf.toString('utf8'));
    } catch {
      return sendJson(res, 400, { detail: 'Invalid JSON body.' });
    }
  }
  const tab = operation.operation === 'read' ? params.get('tab') : body?.tab;
  if (!tab) {
    return sendJson(res, 400, { detail: 'A sheet tab is required.' });
  }
  if (!authorizeSheetTab(auth.session, operation.operation, tab)) {
    return sendJson(res, 403, { detail: 'This role is not authorized for the requested sheet operation.' });
  }

  try {
    // After user session verification, call VPS with service token so direct origin
    // can stay fail-closed (user session secret does not need to live on VPS).
    const upstreamToken = String(
      process.env.HERMES_UPSTREAM_SHEETS_TOKEN || process.env.HERMES_SYNC_TOKEN || '',
    ).trim();
    if (!upstreamToken) {
      return sendJson(res, 503, { detail: 'Hermes upstream Sheets authentication is not configured.' });
    }

    const upstream = await fetch(upstreamUrl, {
      method: req.method || 'GET',
      headers: {
        Accept: req.headers.accept || 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
        Authorization: `Bearer ${upstreamToken}`,
        'X-Correlation-ID': correlationId,
        'X-Hermes-Actor': auth.session.sub,
        'X-Hermes-Role': auth.session.role,
        'X-Hermes-Assigned-Units': JSON.stringify(auth.session.assigned_units),
      },
      body: bodyBuf && bodyBuf.length ? bodyBuf : undefined,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
  } catch {
    return sendJson(res, 502, { detail: 'Upstream gateway unavailable.' });
  }
}
