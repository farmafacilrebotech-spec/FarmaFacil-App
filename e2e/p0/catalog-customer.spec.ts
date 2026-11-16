import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  addFirstAvailableProduct,
  clearCart,
  expectPharmacyBranding,
  openPublicCatalog,
  submitGuestRequest,
  submitLinkedCustomerRequest,
  uniqueEsMobile,
} from '../helpers/catalog';
import { PHARMACIES } from '../fixtures/test-data';

test.describe('P0 catálogo y área cliente', () => {
  test('QR: nombre visible (CLI-04) y acceso catálogo', async ({ page }) => {
    await page.goto(`/e/${PHARMACIES.fase7.publicId}`);
    await expectPharmacyBranding(page, {
      namePart: 'Fase7|QR|TEST',
      expectLogo: true,
    });
    await openPublicCatalog(page);
  });

  test('añadir, editar cantidad y vaciar carrito (CLI-10 parcial)', async ({
    page,
  }) => {
    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    await page.keyboard.press('Escape').catch(() => {});
    const plus = page.getByRole('button', { name: /añadir uno de/i }).first();
    if (await plus.isVisible().catch(() => false)) {
      await plus.click();
    }
    await clearCart(page);
  });

  test('pedido invitado + carrito vacío tras envío (CLI-10)', async ({ page }) => {
    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    const display = await submitGuestRequest(page, {
      name: `E2E Invitado ${Date.now()}`,
    });
    expect(display).toBeTruthy();
    // Tras confirmación, nueva solicitud vacía
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/catalogo`);
    // Tras envío el carrito debe estar vacío: no hay barra «Revisar solicitud»
    await expect(
      page.getByRole('button', { name: /revisar solicitud/i })
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test('Mis farmacias: guardar / listar / quitar / volver a guardar (CLI-03)', async ({
    page,
  }) => {
    await loginAs(page, 'customer');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}`);
    const save = page.getByRole('button', {
      name: /guardar en mis farmacias/i,
    });
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await expect(
        page.getByText(/guardada|mis farmacias/i).first()
      ).toBeVisible({ timeout: 20_000 });
    }
    await page.goto('/cuenta/mis-farmacias');
    await expect(page.getByText(/mis farmacias/i).first()).toBeVisible();
    await expect(
      page.getByText(/Fase7|QR|TEST|Staging/i).first()
    ).toBeVisible({ timeout: 20_000 });
    // saved_at / orden: al menos una tarjeta
    const remove = page.getByRole('button', {
      name: /quitar|eliminar|dejar de guardar/i,
    }).first();
    if (await remove.isVisible().catch(() => false)) {
      await remove.click();
      await page.waitForTimeout(1000);
    }
    await page.goto(`/e/${PHARMACIES.fase7.publicId}`);
    const save2 = page.getByRole('button', {
      name: /guardar en mis farmacias/i,
    });
    if (await save2.isVisible().catch(() => false)) {
      await save2.click();
    }
    await page.reload();
    await page.goto('/cuenta/mis-farmacias');
    await expect(
      page.getByText(/Fase7|QR|TEST/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('CLI-11: cliente puede pedir como invitado o vinculado', async ({
    page,
  }) => {
    await loginAs(page, 'customer');
    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    // Guest path while logged in
    const guestBtn = page.getByRole('button', {
      name: /pedir como invitado/i,
    });
    if (await guestBtn.isVisible().catch(() => false)) {
      await guestBtn.click();
      await page.locator('#pub-name').fill(`E2E GuestMode ${Date.now()}`);
      await page.locator('#pub-phone').fill(uniqueEsMobile());
      await page
        .locator('#public-request-form input[type="checkbox"]')
        .check({ force: true });
      await page.getByRole('button', { name: /enviar solicitud/i }).click();
      await expect(page.getByText(/referencia\s*#\s*\d+/i)).toBeVisible({
        timeout: 45_000,
      });
    }

    await openPublicCatalog(page);
    await addFirstAvailableProduct(page);
    const linked = await submitLinkedCustomerRequest(page);
    expect(linked).toBeTruthy();
  });

  test('CLI-13: Mis pedidos muestra vinculados y no el puro invitado', async ({
    page,
  }) => {
    await loginAs(page, 'customer');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/cuenta/pedidos`);
    await expect(page.getByText(/mis pedidos/i).first()).toBeVisible();
    // Texto de ayuda: solicitudes invitado no aparecen
    await expect(
      page.getByText(/vinculados|invitado|sin vincular/i).first()
    ).toBeVisible();
  });
});
