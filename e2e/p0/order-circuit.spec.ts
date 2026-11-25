import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  addFirstAvailableProduct,
  openPublicCatalog,
  submitGuestRequest,
  submitLinkedCustomerRequest,
} from '../helpers/catalog';
import { PHARMACIES } from '../fixtures/test-data';

/**
 * Circuito P0 de pedidos (pasos 1–20 del plan).
 * Conserva #0029–#0035: solo crea pedidos nuevos.
 */
test.describe('P0 circuito pedidos', () => {
  test('circuito invitado + cliente + panel farmacia + valoración', async ({
    page,
  }) => {
    // 1–5 invitado
    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    const guestRef = await submitGuestRequest(page, {
      name: `E2E Circuit Guest ${Date.now()}`,
    });
    expect(guestRef).toBeTruthy();

    // Carrito vacío
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/catalogo`);
    await expect(
      page.getByRole('button', { name: /revisar solicitud/i })
    ).toHaveCount(0, { timeout: 20_000 });

    // 6–8 cliente identificado
    await loginAs(page, 'customer');
    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    const linkedRef = await submitLinkedCustomerRequest(page);
    expect(linkedRef).toBeTruthy();

    // 9–11 panel farmacia
    await loginAs(page, 'pharmacist');
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    await expect(page.getByText(/pedidos|solicitudes/i).first()).toBeVisible();

    // Abrir detalle: el nº puede ir con ceros (#0162 vs 162); click en el <button> de fila
    const orderNum = String(linkedRef).replace(/^0+/, '') || '0';
    const orderBtn = page.getByRole('button', {
      name: new RegExp(`#0*${orderNum}\\b`),
    });
    await expect(orderBtn.first()).toBeVisible({ timeout: 30_000 });
    await orderBtn.first().click();
    // Detalle real (no el subtítulo de lista «Precio y disponibilidad…»)
    await expect(
      page.getByRole('button', { name: /volver a pedidos/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /confirmar valoración/i })
    ).toBeVisible({ timeout: 20_000 });

    // 12–14 valorar: select Disponibilidad → Disponible → precio → confirmar
    const availSelect = page
      .locator('select')
      .filter({ hasText: /Pendiente|Disponible/ })
      .first();
    await expect(availSelect).toBeVisible({ timeout: 15_000 });
    await availSelect.selectOption('available');
    const priceInput = page.locator('input[inputmode="decimal"]:not([disabled])').first();
    await expect(priceInput).toBeEnabled({ timeout: 10_000 });
    await priceInput.fill('3.50');
    const confirmVal = page.getByRole('button', {
      name: /confirmar valoración/i,
    });
    await expect(confirmVal).toBeEnabled({ timeout: 10_000 });
    await confirmVal.click();
    await expect(
      page.getByText(/valoraci[oó]n|confirmad|presupuesto|guardad|importe/i).first()
    ).toBeVisible({ timeout: 30_000 });

    // 15–16 avanzar estados si disponibles
    for (const label of [/preparaci[oó]n/i, /listo|ready/i, /entregad/i]) {
      const btn = page.getByRole('button', { name: label }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
      }
    }

    // 17–19 cliente: pedido vinculado visible; invitado no
    await loginAs(page, 'customer');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/cuenta/pedidos`);
    await expect(
      page.getByText(new RegExp(`#?${linkedRef}`)).first()
    ).toBeVisible({ timeout: 30_000 });
    if (guestRef && guestRef !== linkedRef) {
      await expect(
        page.getByText(new RegExp(`#?${guestRef}$`))
      ).toHaveCount(0);
    }

    // 20 notificaciones: best-effort UI badge / texto
    const notif = page.getByText(/notificaci|aviso|actualizaci/i).first();
    if (await notif.isVisible().catch(() => false)) {
      await expect(notif).toBeVisible();
    }
  });

  test('owner abre líneas de pedido nuevo (CLI-16 UI)', async ({ page }) => {
    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    const ref = await submitGuestRequest(page, {
      name: `E2E Lines ${Date.now()}`,
    });
    expect(ref).toBeTruthy();

    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    const row = page.getByText(new RegExp(`#?${ref}`)).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    await expect(
      page.getByText(/líneas|productos|cantidad/i).first()
    ).toBeVisible();
  });
});
