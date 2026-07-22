import { buildManualLookupResponse, readJsonBody } from '../../lib/hermes-ai.js';
import { requireSession } from '../require-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireSession(req, res, { scope: 'ai-manual', limit: 30 })) return;

  try {
    const body = await readJsonBody(req);
    const payload = buildManualLookupResponse(body);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid manual lookup request',
    });
  }
}
