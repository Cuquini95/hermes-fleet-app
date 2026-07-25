/**
 * Hermes -> CMMS horometer handoff.
 *
 * Hermes records horometer readings into the Google Sheet tab
 * '04B Registro Horómetros' (SHEET_TABS.HOROMETROS) from HorometroPage and
 * FuelDispatchScanner. CMMS never learned about them, so every asset in
 * cmms_assets kept current_hour_meter null and the fleet displayed "0 h".
 *
 * That is not cosmetic: CMMS PM due-selection gates on
 *   next_due_meter <= greatest(coalesce(current_hour_meter,0), ...)
 * so with the meter pinned at zero no hour-based preventive maintenance can
 * ever come due.
 *
 * This endpoint accepts readings already captured by Hermes and writes them
 * into cmms_meter_readings. The CMMS trigger installed by
 * transplus_cmms_meter_sync_v29 then advances cmms_assets.current_hour_meter.
 *
 * Idempotency: cmms_meter_readings carries
 *   unique nulls not distinct (organization_id, source, legacy_id)
 * so a replayed reading collides on (source='hermes-horometro', legacy_id)
 * instead of double-counting.
 */
import { verifyBearer } from '../hermes-sheets-gate.js';
import { rejectIfRateLimited } from '../_rate-limit.js';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_READINGS = 500;
const DEFAULT_TIMEOUT_MS = 25_000;

function cleanEnvValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function normalizeReading(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const unit = typeof entry.unit === 'string' ? entry.unit.trim().toUpperCase() : '';
  if (!unit || unit.length > 40) return null;

  const hours = Number(entry.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 1_000_000) return null;

  const rawAt = typeof entry.recorded_at === 'string' ? entry.recorded_at.trim() : '';
  const parsed = rawAt ? Date.parse(rawAt) : Date.now();
  if (!Number.isFinite(parsed)) return null;
  const recordedAt = new Date(parsed).toISOString();

  return { unit, hours: Math.round(hours * 100) / 100, recordedAt };
}

export function dedupeLatestPerUnit(readings) {
  const latest = new Map();
  for (const reading of readings) {
    const previous = latest.get(reading.unit);
    if (!previous || reading.recordedAt > previous.recordedAt) latest.set(reading.unit, reading);
  }
  return [...latest.values()];
}

async function sbFetch(base, key, path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { ok: response.ok, status: response.status, body: parsed, raw: text };
  } finally {
    clearTimeout(timer);
  }
}

export function createMeterHandler({ env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ detail: 'Method not allowed.' });
    }

    const auth = verifyBearer(req.headers?.authorization, req.headers?.cookie);
    if (!auth.ok) return res.status(auth.status).json({ detail: auth.detail });

    if (rejectIfRateLimited(req, res)) return undefined;

    const supabaseUrl = cleanEnvValue(
      env.HOSTED_CMMS_SUPABASE_URL || env.SUPABASE_URL,
    ).replace(/\/+$/, '');
    const serviceKey = cleanEnvValue(
      env.HOSTED_CMMS_SUPABASE_SERVICE_KEY
        || env.SUPABASE_SERVICE_ROLE_KEY
        || env.SUPABASE_SERVICE_KEY,
    );
    const organizationId = cleanEnvValue(env.CMMS_HERMES_FALLBACK_ORGANIZATION_ID);

    if (!supabaseUrl || !serviceKey || !organizationId) {
      return res.status(503).json({ detail: 'CMMS meter handoff is not configured.' });
    }

    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      const status = error?.statusCode === 413 ? 413 : 400;
      return res.status(status).json({ detail: error?.publicMessage || 'Invalid request body.' });
    }

    const rawList = Array.isArray(payload?.readings)
      ? payload.readings
      : payload?.unit
        ? [payload]
        : [];
    if (rawList.length === 0) return res.status(400).json({ detail: 'No readings supplied.' });
    if (rawList.length > MAX_READINGS) {
      return res.status(413).json({ detail: `At most ${MAX_READINGS} readings per request.` });
    }

    const normalized = [];
    const rejected = [];
    for (const entry of rawList) {
      const reading = normalizeReading(entry);
      if (reading) normalized.push(reading);
      else rejected.push(entry?.unit ?? null);
    }
    if (normalized.length === 0) {
      return res.status(400).json({ detail: 'No valid readings supplied.', rejected });
    }

    const readings = dedupeLatestPerUnit(normalized);
    const units = [...new Set(readings.map((r) => r.unit))];

    const lookup = await sbFetch(
      supabaseUrl,
      serviceKey,
      `/rest/v1/cmms_assets?select=id,unit_code,organization_id`
        + `&organization_id=eq.${encodeURIComponent(organizationId)}`
        + `&unit_code=in.(${units.map((u) => encodeURIComponent(u)).join(',')})`,
    );
    if (!lookup.ok || !Array.isArray(lookup.body)) {
      return res.status(502).json({ detail: 'CMMS asset lookup failed.' });
    }

    const assetsByUnit = new Map();
    for (const asset of lookup.body) {
      const code = String(asset.unit_code || '').trim().toUpperCase();
      // A duplicate unit_code inside one organization is ambiguous; fail that
      // unit closed rather than attaching a meter to an arbitrary asset.
      if (assetsByUnit.has(code)) assetsByUnit.set(code, null);
      else assetsByUnit.set(code, asset);
    }

    const rows = [];
    const unmatched = [];
    const ambiguous = [];
    for (const reading of readings) {
      const asset = assetsByUnit.get(reading.unit);
      if (asset === null) { ambiguous.push(reading.unit); continue; }
      if (!asset) { unmatched.push(reading.unit); continue; }
      rows.push({
        organization_id: asset.organization_id,
        asset_id: asset.id,
        meter_type: 'hours',
        reading: reading.hours,
        recorded_at: reading.recordedAt,
        source: 'hermes-horometro',
        legacy_id: `${reading.unit}:${reading.recordedAt}`,
      });
    }

    let applied = 0;
    if (rows.length > 0) {
      const insert = await sbFetch(
        supabaseUrl,
        serviceKey,
        '/rest/v1/cmms_meter_readings?on_conflict=organization_id,source,legacy_id',
        {
          method: 'POST',
          headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify(rows),
        },
      );
      if (!insert.ok) {
        return res.status(502).json({ detail: 'CMMS meter write failed.', status: insert.status });
      }
      applied = Array.isArray(insert.body) ? insert.body.length : 0;
    }

    return res.status(200).json({
      received: rawList.length,
      accepted: readings.length,
      applied,
      unmatched,
      ambiguous,
      rejected,
    });
  };
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    assertBodySize(JSON.stringify(req.body));
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Payload too large');
      error.statusCode = 413;
      error.publicMessage = 'Request body is too large.';
      throw error;
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Malformed JSON');
    error.statusCode = 400;
    error.publicMessage = 'Request body must be valid JSON.';
    throw error;
  }
}

function assertBodySize(value) {
  if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > MAX_BODY_BYTES) {
    const error = new Error('Payload too large');
    error.statusCode = 413;
    error.publicMessage = 'Request body is too large.';
    throw error;
  }
}

export default createMeterHandler();
