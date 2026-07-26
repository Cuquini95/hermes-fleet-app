import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMeterHandler, dedupeLatestPerUnit, normalizeReading } from '../../api/cmms/meter.js';

const SESSION_SECRET = 'meter-test-session-secret-that-is-long-enough';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

describe('CMMS meter handoff endpoint', () => {
  it('normalizes readings and keeps only the latest value per unit', () => {
    const older = normalizeReading({ unit: ' ca26 ', hours: '12400', recorded_at: '2026-07-25T18:00:00Z' });
    const newer = normalizeReading({ unit: 'CA26', hours: '12500.5', recorded_at: '2026-07-25T19:15:00Z' });

    expect(older).toMatchObject({ unit: 'CA26', hours: 12400 });
    expect(newer).toMatchObject({ unit: 'CA26', hours: 12500.5 });
    expect(dedupeLatestPerUnit([older, newer].filter(Boolean))).toEqual([newer]);
    expect(normalizeReading({ unit: 'CA26', hours: 0 })).toBeNull();
  });

  it('looks up the CMMS asset and inserts the captured horometer', async () => {
    process.env.HERMES_AUTH_SESSION_SECRET = SESSION_SECRET;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('/cmms_assets?')) {
        return new Response(JSON.stringify([
          { id: 'asset-ca26', unit_code: 'CA26', organization_id: 'org-a' },
        ]), { status: 200 });
      }
      expect(String(url)).toContain('/cmms_meter_readings?on_conflict=');
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify([{ id: 'reading-1' }]), { status: 201 });
    });

    const handler = createMeterHandler({
      env: {
        HOSTED_CMMS_SUPABASE_URL: 'https://cmms.example.test',
        HOSTED_CMMS_SUPABASE_SERVICE_KEY: 'service-key',
        CMMS_HERMES_FALLBACK_ORGANIZATION_ID: 'org-a',
      },
    });
    const res = createResponse();
    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${makeSessionToken()}` },
      body: {
        readings: [
          { unit: 'CA26', hours: 12400, recorded_at: '2026-07-25T18:00:00Z' },
          { unit: 'CA26', hours: 12500.5, recorded_at: '2026-07-25T19:15:00Z' },
        ],
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: 2, accepted: 1, applied: 1, unmatched: [], ambiguous: [] });
    const insertCall = fetchMock.mock.calls[1];
    const insertedRows = JSON.parse(insertCall[1].body);
    expect(insertedRows).toEqual([{
      organization_id: 'org-a',
      asset_id: 'asset-ca26',
      meter_type: 'hours',
      reading: 12500.5,
      recorded_at: '2026-07-25T19:15:00.000Z',
      source: 'hermes-horometro',
      legacy_id: 'CA26:2026-07-25T19:15:00.000Z',
    }]);
  });
});

function makeSessionToken() {
  const payload = Buffer.from(JSON.stringify({
    sub: 'meter-test',
    role: 'supervisor',
    exp: new Date(Date.now() + 60_000).toISOString(),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
