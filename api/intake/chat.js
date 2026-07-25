import { requireSession } from '../_require-session.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_INTAKE_BODY_BYTES = 8 * 1024 * 1024;

class RequestBodyTooLargeError extends Error {}
class InvalidJsonBodyError extends Error {}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireSession(req, res, { scope: 'intake', limit: 30 })) return;

  const baseUrl = process.env.OPSOS_INTAKE_URL;
  const secret = process.env.OPSOS_INTAKE_SECRET;
  if (!baseUrl || !secret) {
    return res.status(503).json({ error: 'OPSOS_INTAKE_URL and OPSOS_INTAKE_SECRET are required' });
  }

  try {
    const body = await readJsonBody(req);
    const upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/intake/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toOpsosPayload(body)),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const payload = await safeJson(upstream);
    return res.status(upstream.status).json(payload ?? { error: 'Invalid OpsOS response' });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    if (error instanceof InvalidJsonBodyError) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return res.status(502).json({ error: error instanceof Error ? error.message : 'OpsOS intake proxy failed' });
  }
}

function toOpsosPayload(body = {}) {
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
    sender_ref: body.userRef || body.userName || 'hermes-chat',
    submitted_by: body.userName ? `hermes_chat:${body.userName}` : '',
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
  const declaredLength = Number(req.headers?.['content-length'] || req.headers?.['Content-Length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INTAKE_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }

  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    assertBodySize(JSON.stringify(req.body));
    return req.body;
  }
  if (typeof req.body === 'string') {
    assertBodySize(req.body);
    return parseJsonBody(req.body);
  }

  if (typeof req[Symbol.asyncIterator] === 'function') {
    return parseJsonBody(await readAsyncBody(req));
  }

  if (typeof req.on === 'function') {
    return parseJsonBody(await readEventBody(req));
  }

  return {};
}

async function readAsyncBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_INTAKE_BODY_BYTES) {
      if (typeof req.destroy === 'function') req.destroy();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function readEventBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      if (typeof req.destroy === 'function') req.destroy();
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_INTAKE_BODY_BYTES) {
        fail(new RequestBodyTooLargeError());
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', fail);
  });
}

function assertBodySize(value) {
  if (Buffer.byteLength(value, 'utf8') > MAX_INTAKE_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }
}

function parseJsonBody(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidJsonBodyError();
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
