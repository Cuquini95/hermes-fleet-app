import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readReceipt } from './hermes-receipt-ocr.js';
import { createHermesIdentityFixture } from '../../tests/helpers/hermes-auth-fixture.js';
import handler from '../hermes-ai/photo_to_failure.js';

const jpeg = { media_type: 'image/jpeg', image_base64: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64') };
const pdf = { media_type: 'application/pdf', image_base64: Buffer.from('%PDF-1.7\n').toString('base64') };
const invoice = { proveedor: 'Proveedor de prueba', subtotal: 100, iva: 16, total: 116, tipo: 'Refaccion', line_items: [{ part_number: 'QA-1', description: 'Filtro', qty: 1, unit_price: 100, subtotal: 100 }] };

function provider(value, finish_reason = 'stop') {
  const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason, message: { content: JSON.stringify(value) } }] }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', 'isolated-test');
  vi.stubEnv('HERMES_RECEIPT_OCR_MODEL', 'isolated-model');
  vi.stubEnv('HERMES_AUTH_SECRET', 'a'.repeat(32));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('receipt OCR recovery', () => {
  it.each([[jpeg, 'image_url'], [pdf, 'file']])('sends the receipt using its format and returns validated values', async (file, format) => {
    const fetch = provider(invoice);
    expect(await readReceipt(file)).toMatchObject(invoice);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(request.body).messages[0].content[1].type).toBe(format);
  });

  it('rejects a truncated reply or an invalid file', async () => {
    const fetch = provider(invoice, 'length');
    await expect(readReceipt(jpeg)).rejects.toMatchObject({ status: 422 });
    await expect(readReceipt({ ...jpeg, image_base64: pdf.image_base64 })).rejects.toMatchObject({ status: 400 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('requires a configured provider and protects the receipt route with its role rules', async () => {
    vi.stubEnv('HERMES_RECEIPT_OCR_MODEL', '');
    const fetch = provider(invoice);
    await expect(readReceipt(jpeg)).rejects.toMatchObject({ status: 503 });
    const fixture = createHermesIdentityFixture({ role: 'operador' });
    for (const [key, value] of Object.entries(fixture.env)) vi.stubEnv(key, value);
    vi.stubGlobal('fetch', vi.fn((url, init) => fixture.fetchIdentity(url, init) ?? fetch(url, init)));
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ method: 'POST', query: { mode: 'receipt' }, headers: { cookie: fixture.cookie }, body: jpeg }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
