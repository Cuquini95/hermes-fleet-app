import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHermesIdentityFixture } from '../../tests/helpers/hermes-auth-fixture.js';
import { readHermesRows } from './hermes-google-sheets.js';
import handler, { createPartsHandler } from '../parts/import.js';

vi.mock('./hermes-google-sheets.js', () => ({ readHermesRows: vi.fn() }));

function response() {
  return {
    statusCode: 0,
    body: null,
    setHeader: vi.fn(),
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(role, method, body, fallback = vi.fn()) {
  const identity = createHermesIdentityFixture({ role });
  for (const [name, value] of Object.entries(identity.env)) vi.stubEnv(name, value);
  vi.stubGlobal('fetch', (input, init) => identity.fetchIdentity(input, init) ?? fallback(input, init));
  return { method, headers: { cookie: identity.cookie }, body, query: { q: 'OEM-1' } };
}

function expense() {
  const row = ['OLD', '10/11/2026', '', 'Refaccion', 'Proveedor A'];
  row[14] = '[OEM-1] Filtro x2 $200.00';
  row[16] = 'Aprobado';
  return row;
}

const quote = { supplier: 'Proveedor A', parts: [{ part_number: 'OEM-1', unit_price: 110 }] };

beforeEach(() => {
  vi.stubEnv('HERMES_EXPENSE_PRICE_CURRENCY', 'MXN');
  vi.stubEnv('HERMES_TELEGRAM_PRICE_ALERTS_ENABLED', 'false');
  readHermesRows.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('parts recovery API', () => {
  it('reads the recovered inventory for workshop roles', async () => {
    readHermesRows.mockResolvedValue([['FLT-1', 'Filtro', 'OEM-1', '', '', 3, 1, 92]]);
    const res = response();
    await handler(request('mecanico', 'GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject([{ part_number: 'FLT-1', unit_price: 92 }]);
  });

  it('blocks operators from reading prices before requesting Sheets', async () => {
    const res = response();
    await handler(request('operador', 'GET'), res);
    expect(res.statusCode).toBe(403);
    expect(readHermesRows).not.toHaveBeenCalled();
  });

  it('shows the previous price without sending an alert for a manual comparison', async () => {
    readHermesRows.mockResolvedValue([expense()]);
    const fetch = vi.fn();
    const res = response();
    await handler(request('gerencia', 'POST', quote, fetch), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ compared: 1, telegram_sent: false, price_changes: [{ old_price: 100, new_price: 110 }] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a verified comparison available if Telegram fails', async () => {
    readHermesRows.mockResolvedValue([expense()]);
    const isolated = createPartsHandler({ sendAlert: vi.fn().mockRejectedValue(new Error('offline')) });
    const res = response();
    await isolated(request('gerencia', 'POST', { ...quote, notify: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ compared: 1, telegram_sent: false, telegram_reason: 'telegram_unavailable' });
  });

  it('keeps the configured Telegram destination inactive until explicitly enabled', async () => {
    readHermesRows.mockResolvedValue([expense()]);
    const external = vi.fn();
    const res = response();
    await handler(request('gerencia', 'POST', { ...quote, notify: true }, external), res);
    expect(res.body).toMatchObject({ telegram_sent: false, telegram_reason: 'telegram_disabled' });
    expect(external).not.toHaveBeenCalled();
  });

  it('reports a missing source and requires confirmation of the history currency', async () => {
    readHermesRows.mockRejectedValue(new Error('connection failed'));
    const unavailable = response();
    await handler(request('gerencia', 'POST', quote), unavailable);
    expect(unavailable.statusCode).toBe(503);
    vi.stubEnv('HERMES_EXPENSE_PRICE_CURRENCY', '');
    const noCurrency = response();
    await handler(request('gerencia', 'POST', quote), noCurrency);
    expect(noCurrency.statusCode).toBe(503);
    expect(readHermesRows).toHaveBeenCalledTimes(1);
  });
});
