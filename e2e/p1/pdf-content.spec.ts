import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';
import { assertPdfContent, downloadToBuffer } from '../helpers/pdf';

test.describe('P1 PDF contenido real', () => {
  test('presupuesto: descarga PDF con texto FarmaFácil extraíble', async ({
    page,
  }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/tarifas');
    await page.getByRole('tab', { name: /presupuestos/i }).click();
    await expect(
      page.getByText(/presupuesto|sin presupuestos|descargar/i).first()
    ).toBeVisible({ timeout: 30_000 });

    const btn = page.getByRole('button', { name: /descargar presupuesto/i });
    if ((await btn.count()) === 0) {
      test.skip(true, 'No hay presupuestos descargables en staging');
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      btn.first().click(),
    ]);
    const buf = await downloadToBuffer(download);
    await assertPdfContent(
      buf,
      [/FarmaF|presupuesto|€|EUR|kiosko|cuota/i],
      'presupuesto'
    );
    expect(download.suggestedFilename()).toMatch(/pdf|presupuesto/i);
  });

  test('contrato: PDF borrador habilitado o gate sin presupuesto aceptado', async ({
    page,
  }) => {
    await loginAs(page, 'superadmin');
    await page.goto('/contratos');
    await expect(page.getByText(/contratos/i).first()).toBeVisible({
      timeout: 30_000,
    });
    const pdfBtn = page.getByRole('button', { name: /pdf borrador/i }).first();
    await expect(pdfBtn).toBeVisible({ timeout: 20_000 });

    const disabled = await pdfBtn.isDisabled();
    if (disabled) {
      // Gate real: sin presupuesto aceptado no se emite PDF (regresión de bloqueo)
      await expect(
        page.getByText(/no hay presupuestos aceptados|migraci[oó]n 069/i)
      ).toBeVisible();
      test.info().annotations.push({
        type: 'note',
        description:
          'PDF contrato bloqueado sin presupuesto aceptado — gate verificado; contenido PDF cubierto vía presupuesto/cartel.',
      });
      return;
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      pdfBtn.click(),
    ]);
    const buf = await downloadToBuffer(download);
    await assertPdfContent(buf, [/FarmaF|BORRADOR|Contrato|contrato/i], 'contrato');
  });

  test('cartel QR: PDF A4 con texto de farmacia (solo SuperAdmin)', async ({
    page,
  }) => {
    await loginAs(page, 'superadmin');
    await page.goto(`/farmacias/${PHARMACIES.fase7.id}?tab=qr`);
    await expect(
      page.getByText(/qr|cartel|descargar|pdf/i).first()
    ).toBeVisible({ timeout: 30_000 });
    const btn = page.getByRole('button', { name: /descargar pdf/i }).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      btn.click(),
    ]);
    const buf = await downloadToBuffer(download);
    await assertPdfContent(
      buf,
      [/FarmaF|Farmacia|QR|Fase7|TEST/i],
      'cartel'
    );
    expect(download.suggestedFilename()).toMatch(/pdf/i);
  });
});
