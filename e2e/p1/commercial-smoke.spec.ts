import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * P1 comercial — smoke de pantallas existentes (no sustituye P0).
 * Firma definitiva debe permanecer bloqueada.
 */
test.describe('P1 commercial smoke', () => {
  test('tarifas accesible para SA', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/tarifas');
    await expect(page.getByText(/tarifa|plan|general|personalizado|simul/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('contratos borrador: UI sin firmar definitivo', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/contratos');
    const body = await page.locator('body').innerText();
    // Si la ruta existe, no debe ofrecer firma definitiva activa sin legal
    if (/contrato/i.test(body)) {
      expect(body).not.toMatch(/firmar definitivamente y activar servicio/i);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Ruta /contratos sin contenido visible para este SA',
      });
    }
  });
});
