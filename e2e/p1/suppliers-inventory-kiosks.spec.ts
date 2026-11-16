import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

test.describe('P1 proveedores, inventario y kioskos', () => {
  test('proveedores (SA)', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/proveedores');
    await expect(
      page.getByText(/proveedor/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('inventario físico kioskos (SA)', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/inventario-kioskos');
    await expect(
      page.getByText(/inventario|kiosko|activo|asset/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('gestión dispositivos kiosko farmacia (owner)', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/dispositivos`);
    await expect(
      page.getByText(/dispositivo|kiosko|emparej|pair|activo/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('asistente IA según plan (owner)', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/asistente`);
    await expect(page.locator('body')).toBeVisible();
    await expect(
      page
        .getByText(
          /asistente|ia|no incluido|plan|consultas|configuraci[oó]n|m[oó]dulo/i
        )
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
