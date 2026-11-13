import { afterEach, expect, it, vi } from 'vitest';
import { purchaseWrite, PurchaseApiError, setPurchaseSession } from './purchasing-api';

const operationId = 'e4c3294c-4bc5-4539-a6bf-239fe20310b1';
const expense = { document_date: '2026-11-13', folio_factura: 'FAC-QA', imagen_url: '/hermes-api/api/evidence?id=' + 'a'.repeat(64) };
const input = { expense, allocations: [{ unit: 'DZ203', amount: '104.35' }] };

afterEach(() => { setPurchaseSession(''); vi.unstubAllGlobals(); });

it('reuses the same expense body and operation after an incomplete success response', async () => {
  setPurchaseSession('test-employee');
  const reported: object[] = [];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    reported.push(JSON.parse(String(init.body)));
    return reported.length === 1 ? Response.json({}) : Response.json({ ids: ['GST-QA-1'] });
  });
  vi.stubGlobal('fetch', fetch);
  const confirm = (data: { ids?: string[] }) => data.ids?.length === 1;
  await expect(purchaseWrite('expense-save', input, operationId, confirm)).rejects.toMatchObject({ status: 200, confirmationPending: true });
  await expect(purchaseWrite('expense-save', input, operationId, confirm)).resolves.toEqual({ ids: ['GST-QA-1'] });
  const attempt = { ...input, operationId, expectedUserId: 'test-employee' };
  expect(reported).toEqual([attempt, attempt]);
});

it('distinguishes clear expense validation errors from transport, timeout and idempotency uncertainty', () => {
  for (const status of [400, 401, 403, 404, 409, 415, 422, 429]) {
    expect(new PurchaseApiError(status, '').confirmationPending).toBe(false);
  }
  for (const status of [200, 204, 408, 500, 503]) {
    expect(new PurchaseApiError(status, '').confirmationPending).toBe(true);
  }
});
