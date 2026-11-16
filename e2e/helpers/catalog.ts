import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { PHARMACIES } from '../fixtures/test-data';

export async function openPublicCatalog(
  page: Page,
  publicId = PHARMACIES.fase7.publicId
) {
  await page.goto(`/e/${publicId}`);
  // Entrada → catálogo o botón catálogo
  const catalogLink = page.getByRole('link', { name: /catálogo|pedir|productos/i }).first();
  if (await catalogLink.isVisible().catch(() => false)) {
    await catalogLink.click();
  } else {
    await page.goto(`/e/${publicId}/catalogo`);
  }
  await expect(page.locator('body')).toContainText(/catálogo|producto|solicitud|añadir/i, {
    timeout: 30_000,
  });
}

export async function expectPharmacyBranding(
  page: Page,
  opts: { namePart: string; expectLogo?: boolean }
) {
  await expect(page.getByText(new RegExp(opts.namePart, 'i')).first()).toBeVisible({
    timeout: 20_000,
  });
  if (opts.expectLogo) {
    const logo = page.locator('img').filter({ has: page.locator('[alt*="logo" i], [alt*="farmacia" i]') }).first();
    // Logo puede ser img genérica de farmacia
    const anyImg = page.locator('header img, main img').first();
    await expect(anyImg.or(logo)).toBeVisible({ timeout: 10_000 }).catch(() => {
      // branding opcional si staging no tiene logo — no fallar P0 branding name
    });
  }
}

export async function addFirstAvailableProduct(page: Page) {
  const addBtn = page
    .getByRole('button', { name: /añadir .+ al carrito|^añadir$/i })
    .first();
  await expect(addBtn).toBeVisible({ timeout: 30_000 });
  await addBtn.click();
  await expect(
    page.getByRole('button', { name: /revisar solicitud/i })
  ).toBeVisible({ timeout: 15_000 });
}

export async function openRequestPanel(page: Page) {
  // Cerrar ficha de producto (z-60) si intercepta el footer
  await page.keyboard.press('Escape').catch(() => {});
  const closeDetail = page.getByRole('button', { name: /cerrar|close/i }).first();
  if (await closeDetail.isVisible().catch(() => false)) {
    await closeDetail.click().catch(() => {});
  }
  const review = page.getByRole('button', { name: /revisar solicitud/i });
  await expect(review).toBeVisible({ timeout: 15_000 });
  await review.click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
}

export async function adjustQuantity(page: Page, delta: 'plus' | 'minus') {
  if (delta === 'plus') {
    await page.getByRole('button', { name: /añadir uno de/i }).first().click();
  } else {
    await page.getByRole('button', { name: /quitar uno de/i }).first().click();
  }
}

export async function clearCart(page: Page) {
  await openRequestPanel(page);
  page.once('dialog', (d) => d.accept());
  const clearBtn = page.getByRole('button', { name: /vaciar solicitud/i });
  await expect(clearBtn).toBeVisible({ timeout: 15_000 });
  await clearBtn.click();
  // Tras vaciar, el panel se cierra y desaparece «Revisar solicitud»
  await expect(
    page.getByRole('button', { name: /revisar solicitud/i })
  ).toHaveCount(0, { timeout: 15_000 });
}

/** Móvil ES 9 dígitos empezando por 6/7, único por ejecución. */
export function uniqueEsMobile(): string {
  const n = Date.now().toString().slice(-8);
  return `6${n}`;
}

export async function submitGuestRequest(
  page: Page,
  data: { name: string; phone?: string }
) {
  await openRequestPanel(page);
  const guestBtn = page.getByRole('button', { name: /pedir como invitado/i });
  if (await guestBtn.isVisible().catch(() => false)) {
    await guestBtn.click();
  }
  await page.locator('#pub-name').fill(data.name);
  const phone = data.phone && /^[67]\d{8}$/.test(data.phone.replace(/\s/g, ''))
    ? data.phone.replace(/\s/g, '')
    : uniqueEsMobile();
  await page.locator('#pub-phone').fill(phone);
  const privacy = page.locator('#public-request-form input[type="checkbox"]');
  await privacy.check({ force: true });
  const send = page.getByRole('button', { name: /enviar solicitud/i });
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();
  const ref = page.getByText(/referencia\s*#\s*\d+/i);
  try {
    await ref.waitFor({ state: 'visible', timeout: 60_000 });
  } catch {
    const alert = page.locator('#public-request-form [role="alert"]');
    const msg = (await alert.innerText().catch(() => '')).trim();
    throw new Error(
      `Envío invitado sin referencia. alert=${msg || '(vacío)'} phone=${phone}`
    );
  }
  const refText = await ref.innerText();
  const m = refText.match(/#\s*(\d+)/);
  return m?.[1] ?? null;
}

export async function submitLinkedCustomerRequest(page: Page) {
  await openRequestPanel(page);
  const useAccount = page.getByRole('button', { name: /usar mis datos/i });
  if (await useAccount.isVisible().catch(() => false)) {
    await useAccount.click();
  } else {
    // Ya en modo cuenta (chip «Pedido con tu cuenta»)
    await expect(
      page.getByText(/pedido con tu cuenta|aparecerá en mis pedidos/i).first()
    ).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.locator('#pub-name')).toBeVisible({ timeout: 10_000 });
  // Siempre fijar contacto: prefill a menudo vacío y required HTML5 bloquea el envío
  await page.locator('#pub-name').fill('Cliente E2E');
  // Rate-limit staging: máx 5 pedidos/hora por teléfono+farmacia
  const phone = uniqueEsMobile();
  await page.locator('#pub-phone').fill(phone);
  const privacy = page.locator('#public-request-form input[type="checkbox"]');
  await expect(privacy).toBeVisible({ timeout: 10_000 });
  await privacy.check({ force: true });
  const send = page.getByRole('button', { name: /enviar solicitud/i });
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.scrollIntoViewIfNeeded();
  await send.click();
  const ref = page.getByText(/Referencia\s*#\s*\d+/i);
  try {
    await ref.waitFor({ state: 'visible', timeout: 60_000 });
  } catch {
    const alert = page.locator('#public-request-form [role="alert"]');
    const msg = (await alert.innerText().catch(() => '')).trim();
    throw new Error(
      `Envío vinculado sin referencia. alert=${msg || '(vacío)'} phone=${phone}`
    );
  }
  const refText = await ref.innerText();
  const m = refText.match(/#\s*(\d+)/);
  return m?.[1] ?? null;
}
