import { isRole, roleProfile, sessionCookie, signSession } from '../_lib/session-auth.js';

// PIN-less login: selecting a valid role is enough to open a session.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { role } = req.body || {};
    if (!isRole(role)) return res.status(401).json({ error: 'Rol inválido' });
    res.setHeader('Set-Cookie', sessionCookie(signSession(role)));
    return res.status(200).json(roleProfile(role));
  } catch {
    return res.status(503).json({ error: 'Autenticación no configurada' });
  }
}
