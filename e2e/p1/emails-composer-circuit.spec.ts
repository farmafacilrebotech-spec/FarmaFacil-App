import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  assertComposerPreviewHasCorporateHtml,
  clickEnviar,
  fillManualRecipient,
  fillPersonalNote,
  fillSubject,
  goNuevoEmail,
  selectSenderByKey,
  selectTemplateByName,
  stagingRecipient,
} from '../helpers/email-composer';

/**
 * Regresión permanente EMAIL-10: circuito real del compositor.
 * Recorre plantilla → remitente → destinatario manual → nota → Enviar → modal.
 * Transporte controlado: cancela la confirmación (sin Resend).
 * Entrega real: emails-ui-final-real.spec.ts (EMAIL10_UI_FINAL=1).
 */
test.describe('P1 emails circuito compositor (transporte controlado)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('Piloto: plantilla + remitente + nota + Enviar abre confirmación sin bloqueo comercial', async ({
    page,
  }) => {
    const marker = `E2E-CIRCUIT-PILOTO-${Date.now()}`;
    await goNuevoEmail(page);
    await selectTemplateByName(page, /piloto/i);
    const htmlBefore = await page
      .locator('[data-ff-template-locked="1"]')
      .innerHTML();
    expect(htmlBefore).toMatch(/<img\b|<table\b/i);
    await selectSenderByKey(page, 'demo');
    await selectSenderByKey(page, 'pilar');
    const htmlAfterSender = await page
      .locator('[data-ff-template-locked="1"]')
      .innerHTML();
    // Cambiar remitente no debe vaciar ni sustituir la plantilla corporativa
    expect(htmlAfterSender.length).toBeGreaterThan(500);
    expect(htmlAfterSender).toMatch(/<img\b|<table\b/i);

    await fillManualRecipient(page, stagingRecipient());
    await fillSubject(page, marker);
    await fillPersonalNote(page, `Nota circuito ${marker}`);
    await assertComposerPreviewHasCorporateHtml(page);

    await clickEnviar(page);
    const modal = page
      .locator('div.fixed')
      .filter({ has: page.getByRole('heading', { name: /^confirmar env[ií]o$/i }) });
    await expect(modal.getByText(stagingRecipient(), { exact: false })).toBeVisible();
    await expect(modal.locator('dd', { hasText: marker })).toBeVisible();
    // Aviso informativo no bloqueante OK; no exigir habilitación registrada
    await expect(
      page.getByRole('button', { name: /^confirmar env[ií]o$/i })
    ).toBeEnabled();
    await expect(
      page.getByText(/habilitaci[oó]n comercial requerida|debe registrar consentimiento/i)
    ).toHaveCount(0);

    await page.getByRole('button', { name: /^cancelar$/i }).click();
    await expect(
      page.getByRole('heading', { name: /^confirmar env[ií]o$/i })
    ).toHaveCount(0);
  });

  test('Material corporativo: cambio info@↔pilar@ conserva HTML corporativo', async ({
    page,
  }) => {
    await goNuevoEmail(page);
    await selectTemplateByName(
      page,
      /material corporativo|imprentas|presupuesto/i
    );
    await assertComposerPreviewHasCorporateHtml(page);
    const before = await page.locator('[data-ff-template-locked="1"]').innerHTML();
    await selectSenderByKey(page, 'info');
    await selectSenderByKey(page, 'pilar');
    const after = await page.locator('[data-ff-template-locked="1"]').innerHTML();
    expect(after).toMatch(/<img\b|<table\b/i);
    expect(after.length).toBeGreaterThan(Math.min(500, before.length / 2));
    await fillManualRecipient(page, stagingRecipient());
    await fillSubject(page, `E2E-CIRCUIT-IMPRENTAS-${Date.now()}`);
    await clickEnviar(page);
    await expect(
      page.getByRole('button', { name: /^confirmar env[ií]o$/i })
    ).toBeVisible();
    // No es «Enviar prueba»
    await expect(
      page.getByRole('heading', { name: /confirmar env[ií]o de prueba/i })
    ).toHaveCount(0);
    await page.getByRole('button', { name: /^cancelar$/i }).click();
  });

  test('Demostración + Lanzadera: destinatario manual y vista previa con imágenes', async ({
    page,
  }) => {
    await goNuevoEmail(page);
    await selectTemplateByName(page, /demo|demostraci[oó]n/i);
    await selectSenderByKey(page, 'demo');
    await fillManualRecipient(page, stagingRecipient());
    await assertComposerPreviewHasCorporateHtml(page);
    const demoImgs = await page
      .locator('[data-ff-template-locked="1"] img')
      .count();
    expect(demoImgs).toBeGreaterThan(0);

    await goNuevoEmail(page);
    await selectTemplateByName(page, /lanzadera/i);
    await selectSenderByKey(page, 'pilar');
    await fillManualRecipient(page, stagingRecipient());
    await assertComposerPreviewHasCorporateHtml(page);
    const lanzImgs = await page
      .locator('[data-ff-template-locked="1"] img')
      .count();
    expect(lanzImgs).toBeGreaterThan(0);
  });
});
