import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('.tmp-hermes-ui-proof-mechanic-intake');

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

test.describe('Hermes mechanic intake chat', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('asks a guided question for vague workshop slang and diagnoses after choice', async ({ page }) => {
    test.setTimeout(180_000);

    await loginAs(page, 'Jefe de Taller', '1995');
    await page.waitForURL('**/workshop', { timeout: 10_000 });
    await page.goto('/chat');
    await page.locator('select').selectOption('CA22');

    await page.locator('textarea').fill('ta pesado');
    await page.locator('textarea').press('Enter');

    await expect.poll(async () => page.locator('body').innerText(), { timeout: 30_000 })
      .toMatch(/Necesito ubicar la falla primero|Elige una/i);
    await expect(page.getByRole('button', { name: 'Motor', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Frenos', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-vague-slang-guided-buttons.png'), fullPage: true });

    await page.getByRole('button', { name: 'Motor', exact: true }).click();

    await expect.poll(async () => page.locator('body').innerText(), { timeout: 90_000 })
      .toMatch(/Que hago ahorita|Puedo moverlo o no|Que reviso primero/i);
    await expect(page.locator('body')).not.toContainText(/No pude conectar con el diagnostico IA/i);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-guided-choice-diagnosis.png'), fullPage: true });
  });
});

