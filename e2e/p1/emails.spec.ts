import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * P1 emails: navegación y compositor. No envía a destinatarios externos.
 */
test.describe('P1 emails', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('hub / inbox y enviados', async ({ page }) => {
    await page.goto('/emails/inbox');
    await expect(
      page.getByText(/recibidos|inbox|emails|bandeja/i).first()
    ).toBeVisible({ timeout: 30_000 });
    await page.goto('/emails/sends');
    await expect(
      page.getByText(/enviados|historial|outbox|env[ií]o/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('borradores y plantillas', async ({ page }) => {
    await page.goto('/emails/drafts');
    await expect(page.getByText(/borrador/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.goto('/emails/templates');
    await expect(
      page.getByText(/plantilla/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('compositor libre: asunto y firmas sin envío', async ({ page }) => {
    await page.goto('/emails/compose');
    await expect(
      page.getByText(/nuevo email|redactar|componer|para|asunto/i).first()
    ).toBeVisible({ timeout: 30_000 });
    const subject = page.locator('input[name="subject"], #subject, [placeholder*="Asunto" i]').first();
    if (await subject.isVisible().catch(() => false)) {
      await subject.fill(`E2E compose ${Date.now()}`);
    }
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/firma|plantilla|adjunt|destinat/i);
    // No pulsar Enviar
  });

  test('plantillas Piloto y Demostración', async ({ page }) => {
    await page.goto('/emails/piloto');
    await expect(page.getByText(/piloto/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.goto('/emails/demo');
    await expect(
      page.getByText(/demo|demostraci[oó]n/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('sin consentimiento comercial automático en UI de plantillas', async ({
    page,
  }) => {
    await page.goto('/emails/templates');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/consentimiento comercial registrado autom[aá]ticamente/i);
  });
});
