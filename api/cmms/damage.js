import { verifyBearer } from '../hermes-sheets-gate.js';
import { rejectIfRateLimited } from '../rate-limit.js';

const DEFAULT_CMMS_API_BASE = 'https://gtp-cmms.vercel.app';
// Upstream cold starts + live auth can exceed 12s; keep under typical serverless budget.
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_BODY_BYTES = 64 * 1024;

class RequestBodyTooLargeError extends Error {}
class InvalidJsonBodyError extends Error {}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = verifyBearer(
    req.headers?.authorization || req.headers?.Authorization,
    req.headers?.cookie || req.headers?.Cookie,
  );
  if (!auth.ok) {
    return res.status(auth.status).json({ detail: auth.detail });
  }
  if (rejectIfRateLimited(req, res, { scope: 'cmms-damage', limit: 30 }, auth.session.sub)) return;

  const correlationId = String(
    req.headers?.['x-correlation-id'] || req.headers?.['x-request-id'] || crypto.randomUUID(),
  ).slice(0, 120);
  res.setHeader('X-Correlation-ID', correlationId);

  const token = cleanEnvValue(process.env.CMMS_HERMES_SYSTEM_TOKEN);
  const ingestSecret = cleanEnvValue(process.env.CMMS_HERMES_INGEST_SECRET);
  const hostedUrl = cleanEnvValue(process.env.HOSTED_CMMS_SUPABASE_URL || process.env.SUPABASE_URL);
  const hostedKey = cleanEnvValue(
    process.env.HOSTED_CMMS_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  );
  const hostedOrganizationId = cleanEnvValue(process.env.CMMS_HERMES_FALLBACK_ORGANIZATION_ID);
  const hostedCredentials = Boolean(hostedUrl && hostedKey);
  const allowHostedFallback = Boolean(hostedCredentials && hostedOrganizationId);

  if (!token && !ingestSecret && !hostedCredentials) {
    return res.status(202).json({
      success: false,
      skipped: true,
      reason:
        'CMMS_HERMES_INGEST_SECRET / CMMS_HERMES_SYSTEM_TOKEN / HOSTED Supabase service key not configured',
    });
  }
  if (!token && !ingestSecret && hostedCredentials && !hostedOrganizationId) {
    return res.status(202).json({
      success: false,
      skipped: true,
      reason: 'CMMS_HERMES_FALLBACK_ORGANIZATION_ID is not configured',
    });
  }

  try {
    const body = await readJsonBody(req);
    const payload = toCmmsDamagePayload(body);

    // 1) Prefer live gtp-cmms / PocketBase path when secrets present
    if (token || ingestSecret) {
      const baseUrl = (cleanEnvValue(process.env.CMMS_API_BASE) || DEFAULT_CMMS_API_BASE).replace(/\/+$/, '');
      const useIngestSecret = Boolean(ingestSecret);
      const path = useIngestSecret ? '/api/live/hermes/damages/ingest' : '/api/live/hermes/damages';
      try {
        const upstream = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            ...(useIngestSecret
              ? { 'x-cmms-hermes-ingest-secret': ingestSecret }
              : { Authorization: `Bearer ${token}` }),
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Hermes-Actor': auth.session.sub,
            'X-Hermes-Role': auth.session.role,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });
        const responsePayload = await safeJson(upstream);
        if (upstream.ok) {
          return res.status(200).json({ success: true, cmms: responsePayload, path: 'live' });
        }
        // Fall through to HOSTED if enabled
        if (!allowHostedFallback) {
          return res.status(upstream.status).json({
            ...(responsePayload && typeof responsePayload === 'object'
              ? responsePayload
              : { error: 'CMMS damage handoff failed' }),
            cmms_status: upstream.status,
            cmms_base: baseUrl,
            path,
            correlation_id: correlationId,
          });
        }
      } catch (liveError) {
        if (!allowHostedFallback) {
          const message = liveError instanceof Error ? liveError.message : 'CMMS damage handoff failed';
          return res.status(502).json({
            success: false,
            error: message,
            cmms_base: baseUrl,
            timeout_ms: DEFAULT_TIMEOUT_MS,
            correlation_id: correlationId,
          });
        }
        // continue to hosted
      }
    }

    // 2) HOSTED Supabase SoR fallback (gtp-cmms-rescue / maintenance-os DB)
    if (allowHostedFallback) {
      const hosted = await createHostedDamageWorkOrder(
        payload,
        hostedUrl,
        hostedKey,
        hostedOrganizationId,
      );
      return res.status(200).json({ success: true, path: 'hosted_supabase', correlation_id: correlationId, ...hosted });
    }

    return res.status(502).json({ success: false, error: 'No damage handoff path available', correlation_id: correlationId });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({
        success: false,
        error: 'Request body is too large',
        correlation_id: correlationId,
      });
    }
    if (error instanceof InvalidJsonBodyError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON body',
        correlation_id: correlationId,
      });
    }
    const message = error instanceof Error ? error.message : 'CMMS damage handoff failed';
    const baseUrl = (cleanEnvValue(process.env.CMMS_API_BASE) || DEFAULT_CMMS_API_BASE).replace(/\/+$/, '');
    return res.status(502).json({
      success: false,
      error: message,
      cmms_base: baseUrl,
      timeout_ms: DEFAULT_TIMEOUT_MS,
      correlation_id: correlationId,
    });
  }
}

/**
 * Create a TEST_QA-safe HOSTED work order + failure with hermes legacy linkage.
 * Uses service role; assets are looked up by unit_code within an explicit
 * fallback organization (asset_id from Hermes is the unit code).
 */
async function createHostedDamageWorkOrder(payload, supabaseUrl, serviceKey, organizationId) {
  const base = supabaseUrl.replace(/\/+$/, '');
  const unit = payload.asset_id;
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const hermesOt = payload.external_event_id || `OT-QA${stamp}`;
  const title = payload.title.slice(0, 180);
  const description = payload.description || title;

  // Retries from a field client must not create a second CMMS work order.
  // The event id is the cross-app idempotency key; requests without one keep
  // the existing TEST_QA-safe unique identifier behavior.
  if (payload.external_event_id) {
    const existing = await sbGet(
      base,
      serviceKey,
      `/rest/v1/cmms_work_orders?select=id,work_order_no,asset_id,failure_id,legacy_source,legacy_id&organization_id=eq.${encodeURIComponent(organizationId)}&legacy_source=eq.hermes&legacy_id=eq.${encodeURIComponent(hermesOt)}&limit=1`,
    );
    const existingRow = Array.isArray(existing) ? existing[0] : null;
    if (existingRow) {
      return {
        hermes_ot: existingRow.legacy_id || hermesOt,
        work_order_no: existingRow.work_order_no || null,
        work_order_id: existingRow.id,
        asset_id: existingRow.asset_id || null,
        failure_id: existingRow.failure_id || null,
        authority: 'hermes',
        created: false,
        idempotent_replay: true,
      };
    }
  }

  const assets = await sbGet(
    base,
    serviceKey,
    `/rest/v1/cmms_assets?select=id,unit_code,organization_id,site_id&organization_id=eq.${encodeURIComponent(organizationId)}&unit_code=eq.${encodeURIComponent(unit)}&limit=2`,
  );
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new Error(`HOSTED asset not found for unit_code=${unit}`);
  }
  if (assets.length !== 1) {
    throw new Error(`HOSTED asset lookup is not unique for unit_code=${unit}`);
  }
  const asset = assets[0];
  const woNo = `OT-20260721-H${stamp}`;
  const woId = cryptoRandomId();

  const failBody = {
    organization_id: asset.organization_id,
    site_id: asset.site_id,
    asset_id: asset.id,
    description: `Hermes damage: ${description}`.slice(0, 500),
    severity: payload.severity === 'critical' ? 'critical' : payload.severity === 'high' ? 'high' : 'medium',
    status: 'reported',
    equipment_stopped: payload.severity === 'critical' || payload.severity === 'high',
    legacy_source: 'hermes',
    legacy_id: hermesOt,
  };
  const failures = await sbPost(base, serviceKey, '/rest/v1/cmms_failures', failBody);
  const failure = Array.isArray(failures) ? failures[0] : failures;

  const woBody = {
    id: woId,
    organization_id: asset.organization_id,
    site_id: asset.site_id,
    asset_id: asset.id,
    failure_id: failure?.id || null,
    work_order_no: woNo,
    work_type: 'corrective',
    title: title.startsWith('TEST_QA') ? title : `TEST_QA ${title}`.slice(0, 180),
    description: description.slice(0, 1000),
    priority: payload.severity === 'critical' || payload.severity === 'high' ? 'high' : 'medium',
    status: 'open',
    legacy_source: 'hermes',
    legacy_id: hermesOt,
    metadata: {
      hermes_native_damage: true,
      photo_url: payload.photo_url,
      reason: payload.reason,
      path: 'hosted_supabase_fallback',
    },
  };
  const created = await sbPost(base, serviceKey, '/rest/v1/cmms_work_orders', woBody);
  const row = Array.isArray(created) ? created[0] : created;

  return {
    hermes_ot: hermesOt,
    work_order_no: woNo,
    work_order_id: row?.id || woId,
    asset_unit: asset.unit_code,
    asset_id: asset.id,
    failure_id: failure?.id || null,
    authority: 'hermes',
    created: true,
  };
}

function cryptoRandomId() {
  // UUID v4
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function sbGet(base, key, path) {
  const r = await fetch(`${base}${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HOSTED GET ${path} -> ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function sbPost(base, key, path, body) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HOSTED POST ${path} -> ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
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
  const declaredLength = Number(req.headers?.['content-length'] || req.headers?.['Content-Length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
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

  if (typeof req[Symbol.asyncIterator] !== 'function') return {};

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      if (typeof req.destroy === 'function') req.destroy();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return parseJsonBody(raw);
}

function assertBodySize(value) {
  if (Buffer.byteLength(value, 'utf8') > MAX_BODY_BYTES) {
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
