import { buildSmartDiagnoseResponse, readJsonBody } from '../../lib/hermes-ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const payload = await buildSmartDiagnoseResponse(body);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid diagnose request',
    });
  }
}

