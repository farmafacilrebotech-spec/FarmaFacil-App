import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

test.describe('P1 contratos', () => {
  test('workspace borrador sin firma definitiva', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/contratos');
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/contrato|borrador|presupuesto|plantilla/i);
    expect(body).not.toMatch(/firmar definitivamente y activar servicio/i);
    // STATUS jurídico / ReBoTech pendiente si está expuesto
    if (/rebotec|jur[ií]dic|pendiente|borrador/i.test(body)) {
      expect(body).toMatch(/pendiente|borrador|revisi[oó]n|status/i);
    }
  });

  test('preview/PDF controls no habilitan firma bloqueada', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/contratos');
    const sign = page.getByRole('button', {
      name: /firmar definitiv|activar servicio|emitir firma/i,
    });
    if (await sign.count()) {
      for (const btn of await sign.all()) {
        await expect(btn).toBeDisabled();
      }
    }
  });
});
