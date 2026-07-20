/**
 * Fail-closed gate for Hermes sheet proxy traffic.
 * Requires a valid Authorization: Bearer session before forwarding to VPS.
 */
import crypto from 'node:crypto';

const UPSTREAM = 'https://5-78-204-80.sslip.io';
const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

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

export function verifyBearer(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return { ok: false, status: 401, detail: 'Authentication required.' };
  }
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader.trim());
  if (!match) return { ok: false, status: 401, detail: 'Authentication required.' };
  const token = match[1];
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
  if (
    !payload ||
    typeof payload.role !== 'string' ||
    !ROLES.has(payload.role) ||
    typeof payload.exp !== 'string' ||
    Date.parse(payload.exp) <= Date.now()
  ) {
    return { ok: false, status: 401, detail: 'Invalid or expired session.' };
  }
  return { ok: true };
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
  const auth = verifyBearer(req.headers.authorization || req.headers.Authorization);
  if (!auth.ok) {
    return sendJson(res, auth.status, { detail: auth.detail });
  }

  const upstreamPath = typeof req.query?.upstreamPath === 'string' ? req.query.upstreamPath : '/hermes-api/api/sheets/read';
  // Preserve client query string (tab, range, etc.) excluding our rewrite param.
  const url = new URL(req.url || '/', 'http://localhost');
  const params = new URLSearchParams(url.search);
  params.delete('upstreamPath');
  const qs = params.toString();
  const upstreamUrl = `${UPSTREAM}${upstreamPath}${qs ? `?${qs}` : ''}`;

  const bodyBuf = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method || 'GET',
      headers: {
        Accept: req.headers.accept || 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
        Authorization: req.headers.authorization,
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
