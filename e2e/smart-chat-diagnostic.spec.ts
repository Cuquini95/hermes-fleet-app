import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('.tmp-hermes-ui-proof-smart-chat');
const DASHBOARD_IMAGE = 'C:/Users/Cuki/Desktop/obsidian-mind-main/WhatsApp Image 2026-06-29 at 9.45.18 PM.jpeg';

async function loginAs(
  page: import('@playwright/test').Page,
  roleLabel: string,
  pin: string,
) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('hermes-auth'));
  await page.goto('/login');
  await page.getByRole('button', { name: roleLabel, exact: true }).click();
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).first().click();
  }
}

test.describe('Hermes smart diagnostic chat smoke', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('HM400 dashboard photo and oil-pressure follow-ups', async ({ page }) => {
    test.setTimeout(240_000);

    await loginAs(page, 'Jefe de Taller', '1995');
    await page.waitForURL('**/workshop', { timeout: 10_000 });
    await page.goto('/chat');

    await page.locator('select').selectOption('CA22');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-chat-unit-selected.png'), fullPage: true });

    const fileInput = page.locator('input[type="file"]');
    if (fs.existsSync(DASHBOARD_IMAGE)) {
      await fileInput.setInputFiles(DASHBOARD_IMAGE);
      await page.locator('textarea').fill('foto tablero luz aceite');
      await page.locator('textarea').press('Enter');
      await page.waitForTimeout(3_000);
      await expect.poll(async () => page.locator('body').innerText(), { timeout: 90_000 })
        .toMatch(/NO OPERAR|man[oó]metro|ALTA/i);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-photo-diagnosis.png'), fullPage: true });
    }

    const followUp1 = 'No veo fuga y el motor suena normal. Puedo moverlo al taller?';
    await page.locator('textarea').fill(followUp1);
    await page.locator('textarea').press('Enter');
    await expect.poll(async () => page.locator('body').innerText(), { timeout: 90_000 })
      .toMatch(/NO OPERAR/i);
    await expect(page.locator('body')).not.toContainText(/seguro mover|puede operar con normalidad/i);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-followup-no-move.png'), fullPage: true });

    const followUp2 = 'Si no tengo manometro que le digo al operador?';
    await page.locator('textarea').fill(followUp2);
    await page.locator('textarea').press('Enter');
    await expect.poll(async () => page.locator('body').innerText(), { timeout: 90_000 })
      .toMatch(/NO OPERAR|parado|man[oó]metro/i);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-no-manometer.png'), fullPage: true });
  });
});