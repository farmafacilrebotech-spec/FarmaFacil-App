import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

/**
 * Confirmación: el cliente NO usa /farmacias (panel plataforma).
 * Su lista es /cuenta/mis-farmacias (o bajo /e/.../cuenta).
 */
test.describe('P1 acceso cliente vs /farmacias', () => {
  test('cliente recibe acceso denegado en /farmacias', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/farmacias');
    await expect(
      page.getByText(/acceso no autorizado|no tiene el rol|PLATFORM_SUPERADMIN|sin permiso/i).first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/gestiona todas las farmacias de tu red/i)).toHaveCount(0);
  });

  test('cliente usa Mis farmacias (no panel plataforma)', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/cuenta/mis-farmacias');
    await expect(page.getByText(/mis farmacias/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).not.toHaveURL(/\/farmacias$/);
  });

  test('cliente desde entrada QR no aterriza en /farmacias', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}`);
    await expect(page).not.toHaveURL(/\/farmacias/);
    await expect(
      page.getByText(/cat[aá]logo|pedir|farmacia|guardar/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
