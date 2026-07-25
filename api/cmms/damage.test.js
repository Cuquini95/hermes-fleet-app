import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './damage.js';
import { signSession } from '../_lib/session-auth.js';

beforeEach(() => {
  process.env.HERMES_AUTH_SECRET = 'test-only-secret-with-more-than-32-characters';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CMMS_API_BASE;
  delete process.env.CMMS_HERMES_INGEST_SECRET;
  delete process.env.CMMS_HERMES_SYSTEM_TOKEN;
  delete process.env.HERMES_AUTH_SECRET;
});

describe('CMMS damage proxy', () => {
  it('skips without pretending success when the CMMS system token is missing', async () => {
    const res = createRes();

    await handler(authorizedRequest({ asset_id: 'CA25', title: 'Falla' }), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({ success: false, skipped: true });
  });

  it('forwards sanitized damage payloads to CMMS with the server-side token', async () => {
    process.env.CMMS_API_BASE = 'https://cmms.example.test/';
    process.env.CMMS_HERMES_INGEST_SECRET = 'secret-token';
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
});

function authorizedRequest(body) {
  return {
    method: 'POST',
    body,
    headers: { cookie: `hermes_session=${signSession('operador')}` },
  };
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
