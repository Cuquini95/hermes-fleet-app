/**
 * Authenticated allowlist proxy for non-Sheets Hermes VPS operations.
 *
 * The Vercel project must never use the catch-all rewrite as an unauthenticated
 * path to the VPS. Keep this list explicit so a new upstream route cannot be
 * exposed accidentally by a frontend rewrite.
 */
import crypto from 'node:crypto';
import { verifyBearer } from './hermes-sheets-gate.js';
import { rejectIfRateLimited } from './rate-limit.js';

const UPSTREAM = 'https://5-78-204-80.sslip.io';
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const PUSH_EVENTS = new Set(['nueva_falla', 'dvir_deficiente', 'nueva_ot']);

const OPERATIONS = new Map([
  ['/hermes-api/api/ocr/boleta', { name: 'ocr-boleta', methods: new Set(['POST']), limit: 10 }],
  ['/hermes-api/api/ocr/receipt', { name: 'ocr-receipt', methods: new Set(['POST']), limit: 10 }],
  ['/hermes-api/api/ocr/fuel-dispatch', { name: 'ocr-fuel-dispatch', methods: new Set(['POST']), limit: 10 }],
  ['/hermes-api/api/push/subscribe', { name: 'push-subscribe', methods: new Set(['POST']), limit: 20 }],
  ['/hermes-api/api/push/send', { name: 'push-send', methods: new Set(['POST']), limit: 30 }],
  ['/hermes-api/ai/fault_code_pages', { name: 'ai-fault-code', methods: new Set(['GET']), limit: 30 }],
  ['/hermes-api/parts', { name: 'parts-search', methods: new Set(['GET']), limit: 60 }],
]);

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') {
      const raw = Buffer.from(JSON.stringify(req.body));
      return Promise.resolve({ body: req.body, raw, tooLarge: raw.length > MAX_BODY_BYTES });
    }
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return Promise.resolve({ body: {}, raw: Buffer.alloc(0), tooLarge: false });
      try {
        const raw = Buffer.from(req.body);
        return Promise.resolve({ body: JSON.parse(req.body), raw, tooLarge: raw.length > MAX_BODY_BYTES });
      } catch {
        return Promise.resolve({ invalid: true });
      }
    }
  }

  if (typeof req.on !== 'function') {
    return Promise.resolve({ body: {}, raw: Buffer.alloc(0), tooLarge: false });
  }

  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size <= MAX_BODY_BYTES) chunks.push(buffer);
      else tooLarge = true;
    });
    req.on('end', () => {
      if (tooLarge) {
        resolve({ tooLarge: true });
        return;
      }
      const raw = Buffer.concat(chunks);
      if (!raw.length) {
        resolve({ body: {}, raw, tooLarge: false });
        return;
      }
      try {
        resolve({ body: JSON.parse(raw.toString('utf8')), raw, tooLarge: false });
      } catch {
        resolve({ invalid: true });
      }
    });
    req.on('error', () => resolve({ invalid: true }));
  });
}

export function resolveVpsOperation(rawPath, method) {
  if (typeof rawPath !== 'string') return null;
  const operation = OPERATIONS.get(rawPath);
  if (!operation || !operation.methods.has(method)) return null;
  return { path: rawPath, ...operation };
}

function upstreamToken() {
  return String(
    process.env.HERMES_UPSTREAM_VPS_TOKEN ||
    process.env.HERMES_SYNC_TOKEN ||
    '',
  ).trim();
}

function bodyForOperation(operation, body, session) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'A JSON object body is required.' };
  }

  if (operation.name.startsWith('ocr-')) {
    if (typeof body.image_base64 !== 'string' || !body.image_base64.trim()) {
      return { error: 'image_base64 is required.' };
    }
    return { body };
  }

  if (operation.name === 'push-subscribe') {
    if (!body.subscription || typeof body.subscription !== 'object' || Array.isArray(body.subscription)) {
      return { error: 'A push subscription is required.' };
    }
    return { body: { ...body, role: session.role } };
  }

  if (operation.name === 'push-send') {
    if (!PUSH_EVENTS.has(body.event)) return { error: 'Unsupported push event.' };
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return { error: 'Push event data is required.' };
    }
    return { body };
  }

  return { body };
}

export default async function handler(req, res) {
  const auth = verifyBearer(
    req.headers?.authorization || req.headers?.Authorization,
    req.headers?.cookie || req.headers?.Cookie,
  );
  if (!auth.ok) return sendJson(res, auth.status, { detail: auth.detail });

  const requestedPath = typeof req.query?.upstreamPath === 'string'
    ? req.query.upstreamPath
    : null;
  const operation = resolveVpsOperation(requestedPath, req.method || 'GET');
  if (!operation) return sendJson(res, 404, { detail: 'Hermes VPS operation is not available through this gateway.' });
  if (!ROLES.has(auth.session.role)) return sendJson(res, 403, { detail: 'This role is not authorized for this operation.' });
  if (rejectIfRateLimited(req, res, { scope: operation.name, limit: operation.limit }, auth.session.sub)) return;

  const bodyResult = operation.methods.has('POST') ? await readBody(req) : { body: {}, raw: Buffer.alloc(0), tooLarge: false };
  if (bodyResult.tooLarge) return sendJson(res, 413, { detail: 'Request body is too large.' });
  if (bodyResult.invalid) return sendJson(res, 400, { detail: 'Invalid JSON body.' });

  const normalized = operation.methods.has('POST')
    ? bodyForOperation(operation, bodyResult.body, auth.session)
    : { body: {} };
  if (normalized.error) return sendJson(res, 400, { detail: normalized.error });

  const token = upstreamToken();
  if (!token) return sendJson(res, 503, { detail: 'Hermes VPS authentication is not configured.' });

  const correlationId = String(
    req.headers?.['x-correlation-id'] || req.headers?.['x-request-id'] || crypto.randomUUID(),
  ).slice(0, 120);
  const url = new URL(req.url || '/', 'http://localhost');
  const params = new URLSearchParams(url.search);
  params.delete('upstreamPath');
  const qs = params.toString();
  const upstreamUrl = `${UPSTREAM}${operation.path}${qs ? `?${qs}` : ''}`;
  const rawBody = operation.methods.has('POST')
    ? Buffer.from(JSON.stringify(normalized.body))
    : undefined;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method || 'GET',
      headers: {
        Accept: req.headers?.accept || 'application/json',
        'Content-Type': req.headers?.['content-type'] || 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Correlation-ID': correlationId,
        'X-Hermes-Actor': auth.session.sub,
        'X-Hermes-Role': auth.session.role,
        'X-Hermes-Assigned-Units': JSON.stringify(auth.session.assigned_units),
      },
      body: rawBody,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Correlation-ID', correlationId);
    res.end(text);
  } catch {
    return sendJson(res, 502, { detail: 'Hermes VPS unavailable.' });
  }
}
