import { clearSessionCookie, isSameOriginAuthRequest, revokeSession } from '../_lib/session-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSameOriginAuthRequest(req)) return res.status(403).json({ error: 'Solicitud no autorizada' });
  try { await revokeSession(req); }
  catch { return res.status(503).json({ error: 'No se pudo cerrar la sesión. Intenta de nuevo.' }); }
  res.setHeader('Set-Cookie', clearSessionCookie);
  return res.status(204).end();
}
