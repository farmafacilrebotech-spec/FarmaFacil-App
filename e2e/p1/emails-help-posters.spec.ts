import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

test.describe('P1 emails / ayuda / carteles', () => {
  test('emails: bandeja SA sin envío accidental', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/emails');
    await expect(
      page.getByText(/emails|bandeja|redactar|plantillas|enviados/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('centro de ayuda accesible', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/ayuda');
    await expect(
      page.getByText(/ayuda|manual|documentaci/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('QR tab farmacia muestra descarga de carteles', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/farmacias/${PHARMACIES.fase7.id}`);
    // Pestaña QR / materiales
    const qrTab = page.getByRole('tab', { name: /qr|cartel|material/i }).or(
      page.getByRole('link', { name: /qr|cartel/i })
    );
    if (await qrTab.first().isVisible().catch(() => false)) {
      await qrTab.first().click();
    } else {
      await page.goto(`/f/${PHARMACIES.fase7.id}/qr`);
    }
    await expect(
      page.getByText(/qr|cartel|descargar|pdf|a3|a5|bienvenida/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
