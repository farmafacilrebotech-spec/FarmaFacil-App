import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loginAs } from '../helpers/auth';

/**
 * PRE-05C · Descarga PDF y envío (dry-run) desde el navegador real.
 * Reproduce el fallo Failed to fetch / CORS por Location localhost.
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
    // Relativa (/login?…) o absoluta en 127.0.0.1 — nunca localhost (PRE-05C).
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

    // Crear presupuesto mínimo para garantizar fila seleccionable.
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
    const name = download.suggestedFilename();
    expect(name).toMatch(/presupuesto-.*\.pdf$/i);

    const path = await download.path();
    expect(path).toBeTruthy();
    const head = readFileSync(path!).subarray(0, 5).toString('utf8');
    expect(head).toBe('%PDF-');

    // No debe haber toast de sesión/origen fallido.
    await expect(page.getByText(/sesión o origen/i)).toHaveCount(0);
  });

  test('envío dry-run desde la UI genera PDF sin Resend real', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /presupuestos/i }).click();

    const sendBtn = page.getByRole('button', {
      name: /enviar por email|enviar presupuesto/i,
    });
    await expect(sendBtn.first()).toBeVisible({ timeout: 20_000 });
    await sendBtn.first().click();

    await page.getByRole('button', { name: /^confirmar y enviar$/i }).click();

    await expect(
      page.getByText(/env[ií]o simulado \(dry-run\)|presupuesto enviado a/i).first()
    ).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/sesión o origen/i)).toHaveCount(0);
  });
});
