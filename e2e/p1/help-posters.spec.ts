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

  test('Owner: QR PNG/SVG sí; carteles y pack de bienvenida no (solo SuperAdmin)', async ({
    page,
  }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/qr`);
    await expect(page.getByText(/qr/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /png/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /svg/i })).toBeVisible();
    await expect(
      page.getByTestId('pharmacy-qr-materials-contact')
    ).toContainText(/contacta con FarmaF/i);
    await expect(page.getByRole('button', { name: /descargar pdf/i })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /pack de bienvenida/i })
    ).toHaveCount(0);
    const body = await page.locator('body').innerText();
    // Enlaces/PDF deben apuntar a staging o host local 3070, no producción vercel
    expect(body).not.toMatch(/farmafacil\.com(?!.*test)/i);
  });

  test('SuperAdmin: ficha farmacia → QR con carteles y pack de bienvenida', async ({
    page,
  }) => {
    await loginAs(page, 'superadmin');
    await page.goto(`/farmacias/${PHARMACIES.fase7.id}?tab=qr`);
    await expect(
      page.getByText(/material publicitario|cartel|pack de bienvenida/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
