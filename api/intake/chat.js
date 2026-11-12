import { requireSession } from '../_lib/session-auth.js';
import { hasIdentityUnit } from '../_lib/hermes-identity.js';

const DEFAULT_TIMEOUT_MS = 15_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireSession(req, res);
  if (!session) return;

  const baseUrl = process.env.OPSOS_INTAKE_URL;
  const secret = process.env.OPSOS_INTAKE_SECRET;
  if (!baseUrl || !secret) {
    return res.status(503).json({ error: 'OPSOS_INTAKE_URL and OPSOS_INTAKE_SECRET are required' });
  }

  try {
    const body = await readJsonBody(req);
    const unit = String(body.selectedUnit || '').trim();
    const fieldUnit = String(body.fields?.equipment_or_unit_id || '').trim();
    if ([unit, fieldUnit].some((id) => id && id !== 'General' && !hasIdentityUnit(session, id))) {
      return res.status(403).json({ error: 'Unidad fuera de tu asignación' });
    }
    const upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/intake/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toOpsosPayload(body, session)),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const payload = await safeJson(upstream);
    return res.status(upstream.status).json(payload ?? { error: 'Invalid OpsOS response' });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'OpsOS intake proxy failed' });
  }
}

function toOpsosPayload(body, session) {
  const text = String(body.text || '');
  const selectedUnit = String(body.selectedUnit || '').trim();
  const fields = {
    ...(body.fields || {}),
  };
  if (selectedUnit && selectedUnit !== 'General') {
    fields.equipment_or_unit_id ||= selectedUnit;
  }

  return {
    source_channel: 'hermes_chat',
    external_message_id: body.messageId || `hermes-chat-${Date.now()}`,
    sender_ref: session.userId,
    submitted_by: `hermes_chat:${session.userName}`,
    text,
    fields,
    media: body.photoBase64
      ? [
          {
            base64: body.photoBase64,
            mimeType: body.photoMimeType || 'image/jpeg',
            fileName: body.photoName || 'hermes-chat-photo',
          },
        ]
      : [],
  };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
