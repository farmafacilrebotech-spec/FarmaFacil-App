import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

/**
 * P1 profundo: reserva → liberación → reserva → confirmación (staging_fixture).
 * Farmacia lab: staging1.
 */
test.describe('P1 plazas mutaciones efectivas', () => {
  test('reserva, libera y confirma plaza en staging1', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, 'superadmin');
    const url = `/farmacias/${PHARMACIES.staging1.id}?tab=contrato`;
    await page.goto(url);
    await expect(page.getByText(/promoci[oó]n de lanzamiento 2027/i)).toBeVisible({
      timeout: 30_000,
    });

    async function refreshPanel() {
      await page.goto(url);
      await expect(
        page.getByText(/promoci[oó]n de lanzamiento 2027/i)
      ).toBeVisible({ timeout: 30_000 });
    }

    const confirmedLock = page.getByText(
      /plaza confirmada\. liberación ordinaria no disponible/i
    );
    if (await confirmedLock.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: 'note',
        description:
          'staging1 ya Confirmada; mutación completa no re-ejecutable sin plaza libre.',
      });
      await expect(page.getByText(/confirmada/i).first()).toBeVisible();
      return;
    }

    const liberar = page.getByRole('button', { name: /^liberar plaza$/i });
    if (await liberar.isVisible().catch(() => false)) {
      await liberar.click();
      await page.locator('#release-reason').fill(`E2E release cleanup ${Date.now()}`);
      await page.getByRole('button', { name: /confirmar liberaci[oó]n/i }).click();
      await expect(page.getByText(/plaza liberada/i)).toBeVisible({
        timeout: 30_000,
      });
      await refreshPanel();
    }

    await expect(page.getByRole('button', { name: /reservar plaza/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /reservar plaza/i }).click();
    await expect(
      page.getByText(/plaza de lanzamiento 2027 reservada/i)
    ).toBeVisible({ timeout: 30_000 });
    await refreshPanel();
    await expect(page.getByText(/^reservada$/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^liberar plaza$/i }).click();
    await page.locator('#release-reason').fill(`E2E release cycle ${Date.now()}`);
    await page.getByRole('button', { name: /confirmar liberaci[oó]n/i }).click();
    await expect(page.getByText(/plaza liberada/i)).toBeVisible({ timeout: 30_000 });
    await refreshPanel();
    await expect(
      page.getByRole('button', { name: /reservar plaza/i })
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /reservar plaza/i }).click();
    await expect(
      page.getByText(/plaza de lanzamiento 2027 reservada/i)
    ).toBeVisible({ timeout: 30_000 });
    await refreshPanel();

    await page.getByRole('button', { name: /^confirmar plaza$/i }).click();
    await expect(
      page.getByRole('heading', { name: /confirmar plaza de lanzamiento/i })
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('button', { name: /^confirmar plaza$/i })
      .last()
      .click();
    await expect(page.getByText(/plaza confirmada/i)).toBeVisible({
      timeout: 30_000,
    });
    await refreshPanel();
    await expect(
      page.getByText(/plaza confirmada\. liberación ordinaria no disponible/i)
    ).toBeVisible();
  });
});
