import { buildPhotoAnalysisResponse, readJsonBody } from '../../lib/hermes-ai.js';
import { requireSession } from '../_lib/session-auth.js';
import { readReceipt, ReceiptOcrError } from '../_lib/hermes-receipt-ocr.js';

const RECEIPT_ROLES = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const receiptMode = req.query?.mode === 'receipt';
  if (!requireSession(req, res, receiptMode ? RECEIPT_ROLES : undefined)) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const body = await readJsonBody(req);
    const payload = receiptMode ? await readReceipt(body) : await buildPhotoAnalysisResponse(body);
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof ReceiptOcrError) return res.status(error.status).json({ error: error.message });
    if (receiptMode) return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
    const message = error instanceof Error ? error.message : 'Invalid photo analysis request';
    const status = message.includes('OPENAI_API_KEY') || message.includes('OPENROUTER_API_KEY') ? 503 : 400;
    return res.status(status).json({
      error: message,
    });
  }
}
