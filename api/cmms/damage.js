import { requireSession } from '../_lib/session-auth.js';

const DEFAULT_CMMS_API_BASE = 'https://gtp-cmms.vercel.app';
const DEFAULT_TIMEOUT_MS = 12_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireSession(req, res, ['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'])) return;

  const token = cleanEnvValue(process.env.CMMS_HERMES_SYSTEM_TOKEN);
  const ingestSecret = cleanEnvValue(process.env.CMMS_HERMES_INGEST_SECRET);
  if (!token && !ingestSecret) {
    return res.status(202).json({
      success: false,
      skipped: true,
      reason: 'CMMS_HERMES_INGEST_SECRET or CMMS_HERMES_SYSTEM_TOKEN is not configured',
    });
  }

  try {
    const body = await readJsonBody(req);
    const payload = toCmmsDamagePayload(body);
    const baseUrl = (cleanEnvValue(process.env.CMMS_API_BASE) || DEFAULT_CMMS_API_BASE).replace(/\/+$/, '');
    const useIngestSecret = Boolean(ingestSecret);
    const upstream = await fetch(`${baseUrl}${useIngestSecret ? '/api/live/hermes/damages/ingest' : '/api/live/hermes/damages'}`, {
      method: 'POST',
      headers: {
        ...(useIngestSecret
          ? { 'x-cmms-hermes-ingest-secret': ingestSecret }
          : { Authorization: `Bearer ${token}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const responsePayload = await safeJson(upstream);
    if (!upstream.ok) {
      return res.status(upstream.status).json(responsePayload ?? { error: 'CMMS damage handoff failed' });
    }
    return res.status(200).json({ success: true, cmms: responsePayload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CMMS damage handoff failed';
    return res.status(502).json({ success: false, error: message });
  }
}

function toCmmsDamagePayload(body = {}) {
  const assetId = String(body.asset_id || body.assetId || '').trim().toUpperCase();
  const title = String(body.title || '').trim();
  if (!assetId) throw new Error('asset_id is required');
  if (!title) throw new Error('title is required');

  return {
    asset_id: assetId,
    title: title.slice(0, 180),
    severity: normalizeSeverity(body.severity),
    description: stringOrNull(body.description, 1000),
    photo_url: stringOrNull(body.photo_url || body.photoUrl, 1000),
    related_work_order_id: stringOrNull(body.related_work_order_id || body.relatedWorkOrderId, 120),
    downtime: stringOrNull(body.downtime, 80),
    reason: stringOrNull(body.reason, 500),
    external_event_id: stringOrNull(body.external_event_id || body.externalEventId, 160),
  };
}

function normalizeSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(normalized)) return normalized;
  if (normalized === 'critica' || normalized === 'crítica') return 'critical';
  if (normalized === 'alta') return 'high';
  if (normalized === 'baja') return 'low';
  return 'medium';
}

function stringOrNull(value, maxLength) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanEnvValue(value) {
  return String(value || '').replace(/[\uFEFF\u200B-\u200D\u2060]/g, '').trim();
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

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
