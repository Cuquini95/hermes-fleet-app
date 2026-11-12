import { requireSession } from '../_lib/session-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await requireSession(req, res, undefined, { allowPanama: true });
  if (session) return res.status(200).json(session);
}
