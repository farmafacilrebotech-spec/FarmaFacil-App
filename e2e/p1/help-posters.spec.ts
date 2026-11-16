import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

test.describe('P1 ayuda, carteles y bienvenida', () => {
  test('centro de ayuda SA con manuales', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/ayuda');
    await expect(
      page.getByText(/ayuda|manual|documentaci/i).first()
    ).toBeVisible({ timeout: 30_000 });
    const link = page.getByRole('link', { name: /manual|superadmin|farmacia|cliente/i }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await expect(page.locator('body')).toContainText(/manual|farma|ayuda/i, {
        timeout: 20_000,
      });
    }
  });

  test('QR + carteles A3/A5 y pack bienvenida', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/qr`);
    await expect(
      page.getByText(/qr|cartel|descargar|pdf|a3|a5|bienvenida|poster/i).first()
    ).toBeVisible({ timeout: 30_000 });
    const body = await page.locator('body').innerText();
    // Enlaces/PDF deben apuntar a staging o host local 3070, no producción vercel
    expect(body).not.toMatch(/farmafacil\.com(?!.*test)/i);
  });
});
