import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

/**
 * P1 comercial: tarifas, simulador, presupuestos, pilotos, plazas 2027.
 * No activa firma jurídica ni envía presupuestos a terceros no controlados.
 */
test.describe('P1 comercial', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('planes: General, Personalizado e IA + promo lanzamiento', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await expect(page.getByRole('tab', { name: /planes y tarifas/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('tab', { name: /planes y tarifas/i }).click();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/general/i);
    expect(body).toMatch(/personalizado/i);
    expect(body).toMatch(/asistente|ia/i);
    expect(body).toMatch(/lanzamiento|2027|plaza/i);
  });

  test('condiciones 2028/2029 visibles en economía de plaza (detalle farmacia)', async ({
    page,
  }) => {
    await page.goto(`/farmacias/${PHARMACIES.fase7.id}?tab=contrato`);
    await expect(
      page.getByText(/plaza|lanzamiento|suscripci[oó]n|piloto/i).first()
    ).toBeVisible({ timeout: 30_000 });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/2027|lanzamiento|plaza/i);
    if (/evoluci[oó]n econ[oó]mica|2028|2029/i.test(body)) {
      expect(body).toMatch(/2028/);
      expect(body).toMatch(/2029/);
    }
  });

  test('contratación: asignar plan sin firmar; independencia plaza/piloto', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /contrataci[oó]n/i }).click();
    await expect(
      page.getByText(/asignar plan|sin reserva autom[aá]tica|firma jur[ií]dica/i).first()
    ).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/no\s+(reserva|reservar).*plaza|sin reserva/i);
    expect(body).not.toMatch(/firmar definitivamente y activar servicio/i);
  });

  test('simulador: proyección y cuota de kiosko', async ({ page }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /simulador/i }).click();
    await expect(page.getByText(/simulador|plan|intervalo|kiosko/i).first()).toBeVisible({
      timeout: 20_000,
    });
    // Interactuar: elegir plan personalizado si hay combobox/select
    const planTrigger = page.getByRole('combobox').first();
    if (await planTrigger.isVisible().catch(() => false)) {
      await planTrigger.click();
      const opt = page.getByRole('option', { name: /personalizado/i });
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/€|eur|cuota|kiosko|mensual|anual/i);
  });

  test('presupuestos: listado y descarga disponible sin envío forzado', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /presupuestos/i }).click();
    await expect(
      page.getByText(/presupuesto|sin presupuestos|descargar/i).first()
    ).toBeVisible({ timeout: 20_000 });
    const downloadBtn = page.getByRole('button', {
      name: /descargar presupuesto/i,
    });
    if (await downloadBtn.first().isVisible().catch(() => false)) {
      await expect(downloadBtn.first()).toBeEnabled();
    }
  });

  test('pilotos: listado y sin conversión automática', async ({ page }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /gesti[oó]n de pilotos/i }).click();
    await expect(
      page.getByText(/piloto|listado|activar|readiness|prepar/i).first()
    ).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/piloto/i);
    expect(body).toMatch(/no hay conversi[oó]n autom[aá]tica/i);
  });

  test('preparar piloto: selector obligatorio General/Personalizado/IA', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /gesti[oó]n de pilotos/i }).click();
    await page
      .getByRole('button', { name: /preparar farmacia comercial/i })
      .click();
    await expect(
      page.getByRole('heading', { name: /preparar farmacia comercial/i })
    ).toBeVisible({ timeout: 15_000 });
    const plan = page.locator('#prep-plan');
    await expect(plan).toBeVisible();
    const options = await plan.locator('option').allTextContents();
    const joined = options.join(' | ');
    expect(joined).toMatch(/general/i);
    expect(joined).toMatch(/personalizado/i);
    expect(joined).toMatch(/asistente|ia/i);
    expect(joined).not.toMatch(/\bstarter\b/i);
    await expect(
      page.getByText(/no inicia el contador|sin activar|no reserva plaza/i).first()
    ).toBeVisible();
    await page.getByRole('button', { name: /^cancelar$/i }).click();
  });

  test('planes visibles no listan Starter como producto comercial', async ({
    page,
  }) => {
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /planes y tarifas/i }).click();
    const cards = page.locator('.grid').filter({ hasText: /general|personalizado/i });
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('body').innerText();
    // Puede mencionar legacy, pero no como tarjeta de oferta principal sin matiz
    if (/\bstarter\b/i.test(body)) {
      expect(body).toMatch(/legacy|interno|kernel|pendientes de asignaci/i);
    }
  });

  test('emisor corporativo: formulario SuperAdmin sin NIF inventado', async ({
    page,
  }) => {
    await page.goto('/configuracion/emisor');
    await expect(
      page.getByRole('heading', { name: /datos del emisor/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/farmaf[aá]cil/i).first()).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/solo si verificado|pendientes de verificaci/i);
  });

  test('plazas: panel reserva/liberación en pestaña Contrato', async ({
    page,
  }) => {
    await page.goto(`/farmacias/${PHARMACIES.fase7.id}?tab=contrato`);
    await expect(
      page.getByText(/plaza|lanzamiento|total plazas|disponibles|reservadas/i).first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(/total plazas|disponibles|reservadas|confirmadas|sin plaza/i).first()
    ).toBeVisible();
    const reserve = page.getByRole('button', { name: /reservar plaza/i });
    const release = page.getByRole('button', { name: /liberar plaza/i });
    const hasAction =
      (await reserve.isVisible().catch(() => false)) ||
      (await release.isVisible().catch(() => false)) ||
      (await page
        .getByText(/sin plaza|reservada|confirmada|liberada/i)
        .first()
        .isVisible());
    expect(hasAction).toBeTruthy();
  });
});
