import { verifyBearer } from './hermes-sheets-gate.js';
import { rejectIfRateLimited } from './rate-limit.js';

/** Return the verified Hermes session or terminate the request fail-closed. */
export function requireSession(req, res, options = {}) {
  const auth = verifyBearer(
    req.headers?.authorization || req.headers?.Authorization,
    req.headers?.cookie || req.headers?.Cookie,
  );
  if (!auth.ok) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(auth.status).json({ detail: auth.detail });
    return null;
  }
  if (rejectIfRateLimited(req, res, options, auth.session.sub)) return null;
  if (options.roles && !options.roles.has(auth.session.role)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(403).json({ detail: 'This role is not authorized for this operation.' });
    return null;
  }
  return auth.session;
}
