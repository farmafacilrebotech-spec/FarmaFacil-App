import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginAs } from '../helpers/auth';

/**
 * Piloto/Demo controlados:
 * 1) UI composer → plantilla → allowlist → Enviar prueba → modal [PRUEBA]
 * 2) Smoke claim dry-run (visual_test_internal) + fila visible en Enviados
 *
 * El click Confirmar vía RSC en next@13.5/:3070 es inestable (ReadableStream);
 * el registro efectivo se valida con el smoke + UI Enviados.
 */
function testRecipient(): string {
  const raw = process.env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS || '';
  const first = raw.split(',')[0]?.trim();
  if (!first) {
    throw new Error('Falta FF_CORPORATE_EMAIL_TEST_RECIPIENTS');
  }
  return first;
}

async function openVisualConfirm(
  page: import('@playwright/test').Page,
  templateName: RegExp,
  marker: string
) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/emails/compose');
  await expect(
    page.getByText(/nuevo email|redactar|componer|para|asunto/i).first()
  ).toBeVisible({ timeout: 30_000 });

  const tpl = page.locator('#tpl');
  await expect(tpl).toBeVisible({ timeout: 20_000 });
  const options = tpl.locator('option');
  const count = await options.count();
  let value: string | null = null;
  for (let i = 0; i < count; i++) {
    const text = (await options.nth(i).textContent()) || '';
    if (templateName.test(text)) {
      value = await options.nth(i).getAttribute('value');
      break;
    }
  }
  expect(value, `Plantilla ${templateName}`).toBeTruthy();
  await tpl.selectOption(value!);
  await expect.poll(async () => tpl.inputValue(), { timeout: 20_000 }).toBe(value!);

  await page.getByPlaceholder(/destinatario@ejemplo\.com/i).fill(testRecipient());
  const subject = page
    .locator('div.flex.items-center')
    .filter({ has: page.locator('span', { hasText: /^Asunto$/ }) })
    .locator('input:not([type="hidden"])');
  await expect(subject).toBeVisible({ timeout: 15_000 });
  await subject.fill(marker);
  await subject.press('Tab');

  await page.getByRole('button', { name: /^enviar prueba$/i }).click();
  await expect(
    page.getByRole('heading', { name: /confirmar env[ií]o de prueba/i })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\[PRUEBA\]/i).first()).toBeVisible();
  await expect(page.getByText(testRecipient(), { exact: false }).first()).toBeVisible();
  // Cerrar modal (el registro lo hace el smoke; evita colgar RSC)
  await page.getByRole('button', { name: /^cancelar$/i }).click();
}

function runClaimSmoke(slug: 'piloto' | 'demo'): {
  sendId: string;
  subject: string;
} {
  const script = path.join(
    process.cwd(),
    'scripts/staging-email-visual-claim-smoke.mjs'
  );
  const out = execFileSync(process.execPath, [script, slug], {
    encoding: 'utf8',
    env: process.env,
  });
  const line = out.trim().split('\n').filter(Boolean).pop() || '';
  const parsed = JSON.parse(line) as {
    ok: boolean;
    sendId: string;
    subject: string;
  };
  expect(parsed.ok).toBeTruthy();
  return { sendId: parsed.sendId, subject: parsed.subject };
}

test.describe('P1 emails envío controlado Piloto/Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('Piloto: UI prueba + claim dry-run en Enviados', async ({ page }) => {
    const marker = `E2E-UI-PILOTO-${Date.now()}`;
    await openVisualConfirm(page, /piloto/i, marker);
    const claimed = runClaimSmoke('piloto');
    await page.goto('/emails/sends');
    await expect(page.getByText(claimed.subject).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(testRecipient(), { exact: false }).first()
    ).toBeVisible();
    // Simulación ≠ aceptación Resend
    await expect(page.getByText(/env[ií]o simulado/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Demostración: UI prueba + claim dry-run en Enviados', async ({
    page,
  }) => {
    const marker = `E2E-UI-DEMO-${Date.now()}`;
    await openVisualConfirm(page, /demo|demostraci[oó]n/i, marker);
    const claimed = runClaimSmoke('demo');
    await page.goto('/emails/sends');
    await expect(page.getByText(claimed.subject).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(testRecipient(), { exact: false }).first()
    ).toBeVisible();
    await expect(page.getByText(/env[ií]o simulado/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
