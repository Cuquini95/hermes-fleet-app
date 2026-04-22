/**
 * E2E: Orden de Compra (OC) flow — logged in as gerencia.
 *
 * Auth: gerencia PIN = 1963 (src/stores/auth-store.ts)
 * Route: /admin/ordenes-compra  (RequireRole: ['gerencia'])
 * Print route: /admin/ordenes-compra/:ocId
 *
 * The OC form loads vendor data from the Google Sheets API (readRange).
 * In a real E2E run the dev server must have valid VITE_SHEETS_* credentials,
 * OR the Sheets API must be mocked via page.route().
 *
 * This file mocks the Sheets API at the network level so the test is
 * self-contained and does not require real credentials.
 *
 * Mocked endpoints (matched by URL substring):
 *   PROVEEDORES sheet  → one vendor row
 *   ORDENES_COMPRA     → empty initially, then with one OC after save
 *   OC_LINEAS          → one matching line after save
 *   appendRow calls    → stubbed with 200 OK
 */

import { test, expect } from '@playwright/test';

// ── Types ────────────────────────────────────────────────────────────────────

type SheetValues = string[][];

// ── Sheets mock helpers ───────────────────────────────────────────────────────

const VENDOR_ROW = [
  'Materiales Norte SA',
  'MAT940101XYZ',
  'Av. Industrial 100',
  'Guadalajara',
  'Jalisco',
  '44100',
  '333-100-2000',
  'ventas@matesnorte.com',
  'Juan Perez',
];

/** Build a response body that mimics what the Google Sheets REST API returns. */
function sheetsResponse(values: SheetValues) {
  return JSON.stringify({ values });
}

/**
 * Intercept Google Sheets API calls:
 *   GET  …/values/PROVEEDORES   → vendor catalog (1 vendor)
 *   GET  …/values/Órdenes*      → empty OC list (first call) then one OC row
 *   GET  …/values/OC_Lineas     → empty (no print-page lines needed here)
 *   POST …:append               → 200 OK (write stub)
 */
async function mockSheetsApi(page: import('@playwright/test').Page) {
  let ocSaveCount = 0;

  await page.route('**googleapis.com/v4/spreadsheets/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Stub write calls (append)
    if (method === 'POST' && url.includes(':append')) {
      await route.fulfill({ status: 200, body: JSON.stringify({ updates: {} }) });
      return;
    }

    // Vendor catalog
    if (url.includes('PROVEEDORES')) {
      const body = sheetsResponse([
        ['Nombre', 'RFC', 'Dirección', 'Ciudad', 'Estado', 'CP', 'Teléfono', 'Email', 'Contacto'],
        VENDOR_ROW,
      ]);
      await route.fulfill({ status: 200, body, contentType: 'application/json' });
      return;
    }

    // OC list — return empty on first call, then one OC row after save
    if (url.includes('%C3%93rdenes') || url.includes('Ordenes') || url.includes('rdenes_Compra') || url.includes('ORDENES_COMPRA')) {
      ocSaveCount++;
      if (ocSaveCount === 1) {
        // Initial load: empty list (just header)
        const body = sheetsResponse([
          ['OC_ID', 'Fecha', 'Proveedor', 'RFC', 'Direccion', 'Unidad', 'Subtotal', 'IVA', 'Envio', 'Otros', 'Total', 'Estado', 'Comentarios', 'Aprobada_Por', 'Fecha_Entrega'],
        ]);
        await route.fulfill({ status: 200, body, contentType: 'application/json' });
      } else {
        // After save: one OC in list
        const body = sheetsResponse([
          ['OC_ID', 'Fecha', 'Proveedor', 'RFC', 'Direccion', 'Unidad', 'Subtotal', 'IVA', 'Envio', 'Otros', 'Total', 'Estado', 'Comentarios', 'Aprobada_Por', 'Fecha_Entrega'],
          ['OC-001', '21/04/2026', 'Materiales Norte SA', 'MAT940101XYZ', 'Av. Industrial 100, Guadalajara, Jalisco C.P. 44100', 'FLOTA', '1000.00', '160.00', '0.00', '0.00', '1160.00', 'Borrador', '', '', ''],
        ]);
        await route.fulfill({ status: 200, body, contentType: 'application/json' });
      }
      return;
    }

    // OC lines (for print page)
    if (url.includes('OC_Lineas') || url.includes('Lineas')) {
      const body = sheetsResponse([
        ['OC_ID', 'Item', 'Descripcion', 'Cantidad', 'PrecioUnit', 'Total'],
        ['OC-001', '1', 'Filtro de aceite HF6553', '5', '200.00', '1000.00'],
      ]);
      await route.fulfill({ status: 200, body, contentType: 'application/json' });
      return;
    }

    // Fallback: pass through (shouldn't happen in test)
    await route.continue();
  });
}

// ── Login helper (same as login-and-fleet.spec.ts) ───────────────────────────

async function loginAs(
  page: import('@playwright/test').Page,
  roleLabel: string,
  pin: string,
) {
  await page.goto('/login');
  await page.getByRole('button', { name: roleLabel, exact: true }).click();
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).first().click();
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('hermes-auth'));
});

test('gerencia can create a Nueva OC and it appears in the list', async ({ page }) => {
  await mockSheetsApi(page);

  await loginAs(page, 'Gerencia', '1963');
  await page.waitForURL('**/dashboard', { timeout: 5_000 });

  await page.goto('/admin/ordenes-compra');
  await expect(page).toHaveURL(/\/admin\/ordenes-compra/);

  // Page heading
  await expect(page.getByRole('heading', { name: 'Órdenes de Compra' })).toBeVisible({ timeout: 8_000 });

  // Wait for vendor dropdown to load (sheet mock must respond first)
  const vendorSelect = page.locator('select').first();
  await expect(vendorSelect).toBeVisible({ timeout: 8_000 });

  // Select the mocked vendor (index 0 after the placeholder)
  await vendorSelect.selectOption({ index: 1 });

  // Vendor card should appear with vendor name
  await expect(page.getByText('Materiales Norte SA').first()).toBeVisible({ timeout: 3_000 });

  // Fill in the first line item description
  const descInput = page.locator('input[placeholder="Descripción del item"]').first();
  await descInput.fill('Filtro de aceite HF6553');

  // Set quantity
  const qtyInput = page.locator('input[type="number"]').nth(1);
  await qtyInput.fill('5');

  // Set unit price
  const priceInput = page.locator('input[type="number"]').nth(2);
  await priceInput.fill('200');

  // Submit the form
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // Success banner should appear with OC ID
  await expect(page.getByText(/OC-\d{3} creada/)).toBeVisible({ timeout: 10_000 });

  // OC list table should now show the new row
  await expect(page.getByText('Materiales Norte SA').nth(1)).toBeVisible({ timeout: 8_000 });
});

test('"Ver / Imprimir" link navigates to print page with ULTRATK header', async ({ page }) => {
  await mockSheetsApi(page);

  await loginAs(page, 'Gerencia', '1963');
  await page.waitForURL('**/dashboard', { timeout: 5_000 });

  // Go directly to a known OC print page (the mock returns data for OC-001)
  await page.goto('/admin/ordenes-compra/OC-001');

  // The print page renders a red ULTRATK header block
  await expect(page.getByText('ULTRATK')).toBeVisible({ timeout: 10_000 });

  // The "ORDEN DE COMPRA" title must be visible (styled in red)
  await expect(page.getByText('ORDEN DE COMPRA')).toBeVisible();

  // OC number should appear on the page
  await expect(page.getByText('OC-001')).toBeVisible();

  // The "Imprimir / Guardar como PDF" button is present
  await expect(page.getByRole('button', { name: /Imprimir/ })).toBeVisible();

  // Vendor name
  await expect(page.getByText('Materiales Norte SA').first()).toBeVisible();
});

test('"Ver / Imprimir" link in OC list leads to print page', async ({ page }) => {
  // This test uses a pre-loaded list state — mock returns one OC immediately
  let callCount = 0;
  await page.route('**googleapis.com/v4/spreadsheets/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST') {
      await route.fulfill({ status: 200, body: JSON.stringify({ updates: {} }) });
      return;
    }

    if (url.includes('PROVEEDORES')) {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ values: [
          ['Nombre', 'RFC'],
          VENDOR_ROW,
        ]}),
        contentType: 'application/json',
      });
      return;
    }

    if (url.includes('OC_Lineas') || url.includes('Lineas')) {
      await route.fulfill({ status: 200, body: JSON.stringify({ values: [['OC_ID', 'Item']] }), contentType: 'application/json' });
      return;
    }

    // OC list always returns one row
    callCount++;
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ values: [
        ['OC_ID', 'Fecha', 'Proveedor', 'RFC', 'Dir', 'Unidad', 'Sub', 'IVA', 'Env', 'Otros', 'Total', 'Estado', 'Comentarios', 'AprobadaPor', 'FechaEnt'],
        ['OC-001', '21/04/2026', 'Materiales Norte SA', 'MAT940101XYZ', '', 'FLOTA', '1000.00', '160.00', '0.00', '0.00', '1160.00', 'Borrador', '', '', ''],
      ]}),
      contentType: 'application/json',
    });
  });

  await loginAs(page, 'Gerencia', '1963');
  await page.waitForURL('**/dashboard', { timeout: 5_000 });
  await page.goto('/admin/ordenes-compra');

  // Wait for OC list to render
  await expect(page.getByRole('link', { name: /Ver \/ Imprimir/ })).toBeVisible({ timeout: 10_000 });

  // Click the link
  await page.getByRole('link', { name: /Ver \/ Imprimir/ }).first().click();

  // Should be on the print page
  await expect(page).toHaveURL(/\/admin\/ordenes-compra\/OC-001/);
  await expect(page.getByText('ULTRATK')).toBeVisible({ timeout: 10_000 });
});
