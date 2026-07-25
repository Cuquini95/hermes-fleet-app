import { readSession, roleProfile } from '../_lib/session-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const claims = readSession(req);
  if (!claims) return res.status(401).json({ error: 'Sesión inválida' });
  return res.status(200).json(roleProfile(claims.role));
}
