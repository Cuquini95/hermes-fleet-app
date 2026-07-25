import {
  buildManualLookupResponse,
  InvalidJsonBodyError,
  readJsonBody,
  RequestBodyTooLargeError,
} from '../../lib/hermes-ai.js';
import { requireSession } from '../_require-session.js';

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
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    if (error instanceof InvalidJsonBodyError) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid manual lookup request',
    });
  }
}
