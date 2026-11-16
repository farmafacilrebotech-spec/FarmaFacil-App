import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

test.describe('P1 catálogos y promociones', () => {
  test('catálogo maestro plataforma (SA)', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/catalogo');
    await expect(
      page.getByText(/cat[aá]logo|maestro|producto|import/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('catálogo farmacia Fase7 (owner)', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/catalogo`);
    await expect(
      page.getByText(/cat[aá]logo|producto|disponib|generic|propio|personaliz/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('promociones farmacia accesible', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/promociones`);
    await expect(page.locator('body')).toBeVisible();
    // Módulo puede estar placeholder
    await expect(
      page.getByText(/promoci[oó]n|pr[oó]ximamente|m[oó]dulo|vac[ií]o|crear/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('farmacéutico no edita precios maestros del catálogo plataforma', async ({
    page,
  }) => {
    await loginAs(page, 'pharmacist');
    await page.goto('/catalogo');
    const denied = page.getByText(
      /no tienes|sin permiso|acceso denegado|no autorizado|PLATFORM_SUPERADMIN/i
    );
    if (await denied.first().isVisible().catch(() => false)) {
      await expect(denied.first()).toBeVisible();
    } else {
      await expect(page).not.toHaveURL(/\/catalogo$/);
    }
  });
});
