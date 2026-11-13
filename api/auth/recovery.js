import { createHash } from 'node:crypto';
import { identityConfig, identityRequest, normalizedEmail, normalizeRosterProfile } from '../_lib/hermes-identity.js';
import { isSameOriginAuthRequest } from '../_lib/session-auth.js';
import { rejectIfRateLimited } from '../_lib/rate-limit.js';

const accepted = { message: 'Si tu cuenta está habilitada, recibirás un código en tu correo de trabajo.' };
const invalidCode = { error: 'El código no es válido o venció. Solicita uno nuevo.' };
const unavailable = { error: 'La recuperación por correo no está disponible. Contacta a TI.' };

async function findProfile(config, email) {
  const response = await identityRequest(config, '/rest/v1/hermes_memberships', {
    query: { email: 'eq.' + email, active: 'eq.true', select: '*', limit: '1' },
  });
  if (!response.ok) throw new Error('Recovery membership unavailable');
  const [row] = await response.json();
  if (normalizedEmail(row?.email) !== email) return null;
  return normalizeRosterProfile(row, config.project);
}

export function createRecoveryHandler({
  configured = () => process.env.HERMES_RECOVERY_ENABLED === 'true',
  config = identityConfig,
  findProfile: profileForEmail = findProfile,
  request = identityRequest,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
    if (!isSameOriginAuthRequest(req)) return res.status(403).json({ error: 'Solicitud no autorizada.' });
    if (!configured()) return res.status(503).json(unavailable);
    const { action, code, password } = req.body ?? {};
    const email = normalizedEmail(req.body?.email);
    if (!email || !['request', 'complete'].includes(action)) {
      return res.status(400).json({ error: 'Ingresa tu correo de trabajo.' });
    }
    if (action === 'complete' && (typeof code !== 'string' || !/^\d{6,8}$/.test(code)
      || typeof password !== 'string' || password.length < 12 || password.length > 72
      || Buffer.byteLength(password) > 72)) {
      return res.status(400).json({ error: 'Ingresa el código y una contraseña nueva de al menos 12 caracteres y hasta 72 bytes.' });
    }
    const account = createHash('sha256').update(email).digest('hex');
    if (rejectIfRateLimited(req, res, { scope: 'hermes-recovery-ip', limit: 20 })
      || rejectIfRateLimited(req, res, { scope: 'hermes-recovery-' + action, limit: action === 'request' ? 3 : 6 }, account)) return;
    try {
      const provider = config();
      if (provider.project !== 'tmf-panama') return res.status(503).json(unavailable);
      const profile = await profileForEmail(provider, email);
      if (action === 'request') {
        if (profile) {
          // Keep the response uniform for unknown, inactive and active addresses.
          await request(provider, '/auth/v1/recover', { method: 'POST', body: { email }, auth: 'public' }).catch(() => {});
        }
        return res.status(202).json(accepted);
      }
      if (!profile) return res.status(400).json(invalidCode);
      const proof = await request(provider, '/auth/v1/verify', {
        method: 'POST', body: { email, token: code, type: 'recovery' }, auth: 'public',
      });
      if (!proof.ok) return res.status(proof.status >= 500 ? 503 : 400).json(proof.status >= 500 ? unavailable : invalidCode);
      const verified = await proof.json();
      if (verified.user?.id !== profile.userId || typeof verified.access_token !== 'string') {
        return res.status(400).json(invalidCode);
      }
      const auth = { auth: 'public', accessToken: verified.access_token };
      try {
        const revoked = await request(provider, '/rest/v1/hermes_sessions', {
          method: 'DELETE', query: { user_id: 'eq.' + profile.userId }, prefer: 'return=minimal',
        });
        if (!revoked.ok) throw new Error('Recovery session revocation unavailable');
        const changed = await request(provider, '/auth/v1/user', { method: 'PUT', body: { password }, ...auth });
        if (!changed.ok) return res.status(changed.status >= 500 ? 503 : 400).json(changed.status >= 500
          ? unavailable : { error: 'El proveedor rechazó la contraseña. Solicita otro código y usa una contraseña distinta.' });
        return res.status(200).json({ message: 'Contraseña actualizada. Inicia sesión con la nueva contraseña.' });
      } finally {
        await request(provider, '/auth/v1/logout', { method: 'POST', query: { scope: 'local' }, ...auth }).catch(() => {});
      }
    } catch {
      return res.status(503).json(unavailable);
    }
  };
}

export default createRecoveryHandler();
