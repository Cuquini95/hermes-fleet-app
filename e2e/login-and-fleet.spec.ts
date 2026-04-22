/**
 * E2E: Login as jefe_taller and navigate to the Fleet view.
 *
 * Auth flow (hermes-fleet-app):
 *  Phase 1 — role selection cards (grid of role buttons on /login)
 *  Phase 2 — numeric PIN keypad (no text input; clicks digit buttons)
 *
 * Pins (from src/stores/auth-store.ts):
 *   jefe_taller → 1995
 *   supervisor  → 2008
 *   gerencia    → 1963
 *
 * After login, jefe_taller lands on /workshop.
 * Fleet is accessible to supervisor/gerencia via the bottom nav "Equipos" tab,
 * but jefe_taller can reach /fleet directly via the URL (RequireRole allows
 * supervisor|gerencia|coordinador — workaround: use gerencia for fleet nav test).
 *
 * Note: The Zustand store is persisted in localStorage under 'hermes-auth'.
 * We bypass localStorage pollution between tests by clearing storage before each test.
 */

import { test, expect } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Complete the two-phase hermes login:
 * 1. Click the role card by visible label text.
 * 2. Click each PIN digit button in sequence.
 *
 * The keypad renders digit buttons whose accessible text is the digit itself.
 * The delete key renders a Lucide Delete icon — we skip it.
 */
async function loginAs(
  page: import('@playwright/test').Page,
  roleLabel: string,
  pin: string,
) {
  await page.goto('/login');

  // Phase 1: pick the role card
  await page.getByRole('button', { name: roleLabel, exact: true }).click();

  // Phase 2: enter PIN digit by digit via the on-screen keypad
  for (const digit of pin) {
    // Each digit is a button with the digit as its visible text
    await page
      .getByRole('button', { name: digit, exact: true })
      .first()
      .click();
  }

  // After the 4th digit the store logs in and navigate() fires automatically
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Clear persisted auth so tests don't bleed into each other
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('hermes-auth'));
});

test('jefe_taller login lands on /workshop', async ({ page }) => {
  await loginAs(page, 'Jefe de Taller', '1995');

  // The navigate() is wrapped in setTimeout(0); wait for URL change
  await page.waitForURL('**/workshop', { timeout: 5_000 });
  expect(page.url()).toContain('/workshop');

  // Workshop home renders a greeting heading
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('gerencia can navigate to Fleet and see equipment tiles', async ({ page }) => {
  // gerencia has "Equipos" in its visible nav (via /fleet route)
  await loginAs(page, 'Gerencia', '1963');
  await page.waitForURL('**/dashboard', { timeout: 5_000 });

  // Navigate directly to /fleet (supervisor & gerencia can access it)
  await page.goto('/fleet');
  await expect(page).toHaveURL(/\/fleet/);

  // At least one equipment tile should be visible.
  // Each tile is a button with aria-label "Ver detalle de <unit_id>"
  const tiles = page.getByRole('button', { name: /Ver detalle de/ });
  await expect(tiles.first()).toBeVisible({ timeout: 10_000 });

  const count = await tiles.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('clicking an equipment tile opens UnitDetailModal', async ({ page }) => {
  await loginAs(page, 'Gerencia', '1963');
  await page.waitForURL('**/dashboard', { timeout: 5_000 });
  await page.goto('/fleet');

  const tiles = page.getByRole('button', { name: /Ver detalle de/ });
  await expect(tiles.first()).toBeVisible({ timeout: 10_000 });

  // Grab the unit id from the first tile's aria-label
  const firstTileLabel = await tiles.first().getAttribute('aria-label') ?? '';
  const unitId = firstTileLabel.replace('Ver detalle de ', '').trim();

  // Click the first tile
  await tiles.first().click();

  // UnitDetailModal renders: a heading with the unit ID (font-mono h2)
  // and a close button with aria-label "Cerrar"
  await expect(page.getByRole('heading', { name: unitId })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible();
});

test('UnitDetailModal closes when close button is clicked', async ({ page }) => {
  await loginAs(page, 'Gerencia', '1963');
  await page.waitForURL('**/dashboard', { timeout: 5_000 });
  await page.goto('/fleet');

  const tiles = page.getByRole('button', { name: /Ver detalle de/ });
  await expect(tiles.first()).toBeVisible({ timeout: 10_000 });
  await tiles.first().click();

  const closeBtn = page.getByRole('button', { name: 'Cerrar' });
  await expect(closeBtn).toBeVisible({ timeout: 5_000 });
  await closeBtn.click();

  // Modal disappears: close button is gone
  await expect(closeBtn).not.toBeVisible({ timeout: 3_000 });
});
