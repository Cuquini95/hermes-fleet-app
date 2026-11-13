import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const profile = {
  userId: '34ac8366-9777-4946-b36f-c17102676c04', userName: 'Almacén QA', role: 'jefe_taller',
  project: 'tmf-panama', projects: ['tmf-panama'], assignedUnits: ['DZ203'], unitScope: 'assigned', allUnits: false,
  canApprovePurchases: false, canReceivePurchases: true,
};

test('Almacén registra entregas parciales desde el celular y consulta el saldo', async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: profile }));
  await page.route('**/hermes-api/api/panama/summary', (route) => route.fulfill({ json: { project: 'tmf-panama', sections: {} } }));

  const receipts: { id: string; at: string; by: string; quantity: string; reference: string }[] = [];
  await page.route('**/hermes-api/api/purchasing/receiving', (route) => route.fulfill({ json: { orders: [{
    folio: 'OC-MOVIL-QA', vendorName: 'Proveedor QA', unit: 'DZ203', deliveryDate: '17/11/2026', version: 'v' + receipts.length,
    receiptStatus: ['Pendiente', 'Recibida parcial', 'Recibida'][receipts.length], lines: [{
      id: 'filtro', number: '1', description: 'Filtro hidráulico', partNumber: 'FILTRO-QA', quantity: '3.125',
      received: ['0', '1.25', '3.125'][receipts.length], receipts,
    }],
  }] } }));

  await page.route('**/hermes-api/api/purchasing/order-receive', async (route) => {
    const { folio, lineId, version, quantity, reference, operationId } = route.request().postDataJSON();
    expect({ folio, lineId, version, quantity }).toEqual({
      folio: 'OC-MOVIL-QA', lineId: 'filtro', version: 'v' + receipts.length, quantity: ['1.25', '1.875'][receipts.length],
    });
    receipts.push({ id: operationId, at: '2026-11-12T15:30:00.000Z', by: profile.userName, quantity, reference });
    await route.fulfill({ json: { folio } });
  });

  await page.goto('/panama');
  await page.getByRole('link', { name: 'Recepciones de compras' }).click();
  await expect(page.getByRole('heading', { name: 'Recepciones de compras' })).toBeVisible();
  await expect(page.getByText('Pendientes 3.125')).toBeVisible();
  await page.getByRole('button', { name: 'Recibir partida' }).click();
  await page.getByLabel('Cantidad recibida').fill('1,25');
  await page.getByLabel('Referencia o remisión').fill('Remisión QA 01');
  await page.getByRole('button', { name: 'Registrar recepción' }).click();
  await expect(page.getByText('Pendientes 1.875')).toBeVisible();
  await expect(page.getByText('Remisión QA 01', { exact: false })).toBeVisible();
  await expect(page.getByText('Recibida parcial', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Recibir partida' }).click();
  await page.getByLabel('Cantidad recibida').fill('1.875');
  await page.getByLabel('Referencia o remisión').fill('Remisión QA 02');
  await page.getByRole('button', { name: 'Registrar recepción' }).click();
  await expect(page.getByText('Pendientes 0')).toBeVisible();
  await expect(page.getByText('Remisión QA 02', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recibir partida' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /aprobar|editar|pagar/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Jefatura sin permiso de Almacén carece de acceso directo a recepciones', async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { ...profile, canReceivePurchases: false } }));
  await page.route('**/hermes-api/api/panama/summary', (route) => route.fulfill({ json: { project: 'tmf-panama', sections: {} } }));

  await page.goto('/panama/recepciones');
  await expect(page).toHaveURL(/\/panama$/);
  await expect(page.getByRole('heading', { name: 'Hermes Panamá' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Recepciones de compras' })).toHaveCount(0);
});

test('Finanzas consulta la remisión, el responsable y la hora de recepción en la orden', async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: {
    ...profile, userName: 'Finanzas QA', role: 'gerencia', canReceivePurchases: false,
  } }));
  await page.route('**/hermes-api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/hermes-api/api/purchasing/requests', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/hermes-api/api/purchasing/orders', (route) => route.fulfill({ json: {
    vendors: [], issuers: [], orphanFolios: [], canApprove: false, orders: [{
      folio: 'OC-FINANZAS-QA', vendorName: 'Proveedor QA', unit: 'DZ203', total: '30.00', status: 'Recibida parcial',
      receiptStatus: 'Recibida parcial', approvedBy: 'Compras QA', approvedById: 'compras', approvedAt: '2026-11-11T15:30:00Z',
      lines: [{ id: 'filtro', description: 'Filtro hidráulico', quantity: '3', received: '1', receipts: [{
        id: 'recepcion', at: '2026-11-12T15:30:00Z', by: 'Almacén QA', quantity: '1', reference: 'Remisión QA 01',
      }] }],
    }],
  } }));

  await page.goto('/admin/ordenes-compra');
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await page.getByRole('button', { name: 'Ver recepciones' }).click();
  const record = page.getByText('Remisión QA 01', { exact: false });
  await expect(page.getByRole('button', { name: 'Registrar recepción' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Marcar pagada' })).toHaveCount(0);
  await expect(record).toContainText('Almacén QA');
  await expect(record.locator('time')).toHaveAttribute('datetime', '2026-11-12T15:30:00Z');
  await expect(record.locator('time')).toHaveText(/12 nov 2026.*10:30/);
});
