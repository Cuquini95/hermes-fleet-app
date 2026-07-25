import { readSession } from '../_lib/session-auth.js';

const MANAGEMENT = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

function normalizedPath(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split('/');
  const path = parts.filter(Boolean).join('/');
  if (!path || path.includes('..')) return null;
  return path;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const claims = readSession(req);
  if (!claims) return res.status(401).json({ error: 'Sesión inválida' });

  const path = normalizedPath(req.query.path);
  if (!path) return res.status(400).json({ error: 'Ruta inválida' });
  if ((path === 'api/sheets/delete-row' || path === 'api/push/send') && !MANAGEMENT.has(claims.role)) {
    return res.status(403).json({ error: 'Acción no autorizada para este rol' });
  }

  const upstreamBase = process.env.HERMES_UPSTREAM_URL;
  const upstreamToken = process.env.HERMES_UPSTREAM_TOKEN;
  if (!upstreamBase || !upstreamToken) return res.status(503).json({ error: 'Gateway no configurado' });

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, String(item));
  }
  const url = `${upstreamBase.replace(/\/$/, '')}/${path}${query.size ? `?${query}` : ''}`;
  const headers = {
    'Accept': req.headers.accept || 'application/json',
    'X-Hermes-Gateway-Token': upstreamToken,
    'X-Hermes-Role': claims.role,
  };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.arrayBuffer();
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    return res.send(Buffer.from(body));
  } catch {
    return res.status(502).json({ error: 'Gateway Hermes no disponible' });
  }
}
