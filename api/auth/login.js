import { roleProfile, sessionCookie, signSession, verifyRolePin } from '../_lib/session-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { role, pin } = req.body || {};
    if (!verifyRolePin(role, pin)) return res.status(401).json({ error: 'Credenciales inválidas' });
    res.setHeader('Set-Cookie', sessionCookie(signSession(role)));
    return res.status(200).json(roleProfile(role));
  } catch {
    return res.status(503).json({ error: 'Autenticación no configurada' });
  }
}
