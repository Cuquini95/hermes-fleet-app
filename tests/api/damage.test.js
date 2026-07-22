import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import handler from '../../api/cmms/damage.js';

const TEST_SESSION_SECRET = 'test-hermes-session-secret-that-is-long-enough';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CMMS_API_BASE;
  delete process.env.CMMS_HERMES_INGEST_SECRET;
  delete process.env.CMMS_HERMES_SYSTEM_TOKEN;
  delete process.env.HOSTED_CMMS_SUPABASE_URL;
  delete process.env.HOSTED_CMMS_SUPABASE_SERVICE_KEY;
  delete process.env.HERMES_AUTH_SESSION_SECRET;
});

describe('CMMS damage proxy', () => {
  it('skips without pretending success when the CMMS system token is missing', async () => {
    process.env.HERMES_AUTH_SESSION_SECRET = TEST_SESSION_SECRET;
    const res = createRes();

    await handler(authorizedRequest({ asset_id: 'CA25', title: 'Falla' }), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({ success: false, skipped: true });
  });

  it('rejects unauthenticated damage handoffs before checking CMMS configuration', async () => {
    process.env.CMMS_HERMES_INGEST_SECRET = 'server-only-secret';
    const res = createRes();

    await handler({ method: 'POST', headers: {}, body: { asset_id: 'CA25', title: 'Falla' } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ detail: 'Authentication required.' });
  });

  it('forwards sanitized damage payloads to CMMS with the server-side token', async () => {
    process.env.CMMS_API_BASE = 'https://cmms.example.test/';
    process.env.CMMS_HERMES_INGEST_SECRET = 'secret-token';
    process.env.HERMES_AUTH_SESSION_SECRET = TEST_SESSION_SECRET;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ authority: 'hermes' }), { status: 200 }),
    );
    const res = createRes();

    await handler(authorizedRequest({
        assetId: ' ca25 ',
        title: 'Hidraulica - CA25',
        severity: 'MEDIA',
        description: 'Acumuladores',
        photoUrl: 'https://cdn.example.test/falla.jpg',
        relatedWorkOrderId: 'OT-1',
        externalEventId: 'hermes-falla-OT-1',
      }), res);

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://cmms.example.test/api/live/hermes/damages/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-cmms-hermes-ingest-secret': 'secret-token' }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      asset_id: 'CA25',
      severity: 'medium',
      related_work_order_id: 'OT-1',
      external_event_id: 'hermes-falla-OT-1',
    });
  });

  it('removes hidden characters from CMMS header environment values', async () => {
    process.env.CMMS_API_BASE = '\uFEFF https://cmms.example.test/ ';
    process.env.CMMS_HERMES_INGEST_SECRET = '\uFEFFsecret-token\u200B ';
    process.env.HERMES_AUTH_SESSION_SECRET = TEST_SESSION_SECRET;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ authority: 'hermes' }), { status: 200 }),
    );
    const res = createRes();

    await handler(authorizedRequest({ asset_id: 'CA25', title: 'Falla' }), res);

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://cmms.example.test/api/live/hermes/damages/ingest',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-cmms-hermes-ingest-secret': 'secret-token' }),
      }),
    );
  });

  it('replays an existing hosted work order for the same external event id', async () => {
    process.env.HOSTED_CMMS_SUPABASE_URL = 'https://cmms-supabase.example.test';
    process.env.HOSTED_CMMS_SUPABASE_SERVICE_KEY = 'hosted-service-key';
    process.env.HERMES_AUTH_SESSION_SECRET = TEST_SESSION_SECRET;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{
        id: 'wo-existing',
        work_order_no: 'OT-20260721-0007',
        asset_id: 'asset-ca25',
        failure_id: 'failure-existing',
        legacy_source: 'hermes',
        legacy_id: 'hermes-event-7',
      }]), { status: 200 }),
    );
    const res = createRes();

    await handler(authorizedRequest({
      asset_id: 'CA25',
      title: 'Falla repetida',
      external_event_id: 'hermes-event-7',
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      path: 'hosted_supabase',
      created: false,
      idempotent_replay: true,
      work_order_id: 'wo-existing',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      'cmms_work_orders?select=id,work_order_no,asset_id,failure_id,legacy_source,legacy_id',
    );
  });
});

function authorizedRequest(body) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${makeSessionToken()}` },
    body,
  };
}

function makeSessionToken() {
  const payload = Buffer.from(JSON.stringify({
    sub: 'qa-supervisor',
    role: 'supervisor',
    exp: new Date(Date.now() + 60_000).toISOString(),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', TEST_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
