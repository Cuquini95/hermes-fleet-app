import { createHash } from 'node:crypto';
import { authenticateHermesEmployee, identityConfig, normalizedEmail } from '../_lib/hermes-identity.js';
import { isSameOriginAuthRequest, issueSession, sessionCookie } from '../_lib/session-auth.js';
import { rejectIfRateLimited } from '../_lib/rate-limit.js';
import recoverAccount from '../_lib/hermes-account-recovery.js';

export default async function handler(req, res) {
  if (req.query?.flow === 'recovery') return recoverAccount(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSameOriginAuthRequest(req)) return res.status(403).json({ error: 'Solicitud no autorizada' });
  const { password } = req.body || {};
  const email = normalizedEmail(req.body?.email);
  if (!email || typeof password !== 'string' || !password || password.length > 1024) {
    return res.status(400).json({ error: 'Ingresa tu correo de trabajo y contraseña' });
  }
  const account = createHash('sha256').update(email).digest('hex');
  if (rejectIfRateLimited(req, res, { scope: 'hermes-login-account', limit: 8 }, account)) return;
  try {
    const config = identityConfig();
    const profile = await authenticateHermesEmployee(email, password, config);
    if (!profile) return res.status(401).json({ error: 'Credenciales inválidas o acceso pendiente de habilitar' });
    const token = await issueSession(profile.userId, config);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return res.status(200).json(profile);
  } catch {
    return res.status(503).json({ error: 'El servicio de acceso no está disponible. Intenta de nuevo.' });
  }
}
