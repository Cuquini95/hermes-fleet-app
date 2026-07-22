import { buildPhotoAnalysisResponse, readJsonBody } from '../../lib/hermes-ai.js';
import { requireSession } from '../require-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireSession(req, res, { scope: 'ai-photo', limit: 10 })) return;

  try {
    const body = await readJsonBody(req);
    const payload = await buildPhotoAnalysisResponse(body);
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid photo analysis request';
    const status = message.includes('OPENAI_API_KEY') || message.includes('OPENROUTER_API_KEY') ? 503 : 400;
    return res.status(status).json({
      error: message,
    });
  }
}
