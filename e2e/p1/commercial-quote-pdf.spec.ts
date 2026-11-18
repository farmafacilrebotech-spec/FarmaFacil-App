import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loginAs } from '../helpers/auth';

/**
 * PRE-05C · Descarga PDF / envío simulado desde el navegador real.
 * No envía emails comerciales reales (FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN=1).
 */
test.describe('PRE-05C presupuesto PDF UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('middleware: /tarifas sin sesión no redirige a localhost', async ({
    request,
  }) => {
    const res = await request.get('/tarifas', {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect([307, 302]).toContain(res.status());
    const location = res.headers()['location'] || '';
    expect(location).toMatch(/\/login\?/);
    expect(location).not.toMatch(/localhost/i);
    if (/^https?:\/\//i.test(location)) {
      expect(location).toMatch(/127\.0\.0\.1/);
    }
  });

  test('descarga PDF corporativo desde la UI (Server Action)', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /simulador/i }).click();

    await page.locator('#sim-client').fill('Farmacia PRE-05C E2E');
    await page.locator('#sim-contact').fill('E2E SuperAdmin');
    await page.locator('#sim-email').fill('e2e.pre05c@farmafacil.test');
    await page.getByRole('button', { name: /guardar propuesta/i }).click();
    await expect(page.getByText(/presupuesto|guardad|FF-PRE/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('tab', { name: /presupuestos/i }).click();
    const downloadBtn = page.getByRole('button', {
      name: /descargar presupuesto/i,
    });
    await expect(downloadBtn).toBeEnabled({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/presupuesto-.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expect(readFileSync(path!).subarray(0, 5).toString('utf8')).toBe('%PDF-');
    await expect(page.getByText(/sesión o origen/i)).toHaveCount(0);
  });

  test('envío simulado: no pasa a Enviado; reintento permitido', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /presupuestos/i }).click();

    const statusBadge = page.getByText(/^Borrador$|^Enviado$/).first();
    await expect(statusBadge).toBeVisible({ timeout: 20_000 });

    async function simulateOnce() {
      const sendBtn = page.getByRole('button', {
        name: /enviar por email/i,
      });
      await sendBtn.first().click();
      await page
        .getByRole('button', {
          name: /^(confirmar simulación|confirmar y enviar)$/i,
        })
        .click();
      await expect(
        page.getByText(/simulaci[oó]n de env[ií]o/i).first()
      ).toBeVisible({ timeout: 120_000 });
      await expect(
        page.getByText(/no se ha enviado ningún correo/i).first()
      ).toBeVisible();
    }

    await simulateOnce();
    // Estado comercial permanece Borrador
    await expect(page.getByText(/Borrador/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Simulado \(sin correo\)/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Reintento controlado (segunda simulación)
    await simulateOnce();
    await expect(page.getByText(/Borrador/i).first()).toBeVisible();
    await expect(page.getByText(/sesión o origen/i)).toHaveCount(0);
  });
});
