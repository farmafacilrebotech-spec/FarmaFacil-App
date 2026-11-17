import { expect, type Page } from '@playwright/test';

export function stagingRecipient(): string {
  const raw = process.env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS || '';
  const first = raw.split(',')[0]?.trim()?.toLowerCase();
  if (!first) throw new Error('Falta FF_CORPORATE_EMAIL_TEST_RECIPIENTS');
  return first;
}

const DIALOG_HOOK = Symbol.for('ff.e2e.dialogAccept');

export async function goNuevoEmail(page: Page) {
  const flagged = page as Page & { [DIALOG_HOOK]?: boolean };
  if (!flagged[DIALOG_HOOK]) {
    flagged[DIALOG_HOOK] = true;
    page.on('dialog', (d) => {
      void d.accept().catch(() => undefined);
    });
  }
  // Inbox → Nuevo email (flujo de usuaria); fallback directo si la sesión redirige
  await page.goto('/emails/inbox');
  if (/\/login/.test(page.url())) {
    throw new Error('Sesión caducada en /emails/inbox');
  }
  const nuevo = page.getByRole('link', { name: /nuevo email/i });
  await expect(nuevo).toBeVisible({ timeout: 30_000 });
  await nuevo.click();
  await expect(page).toHaveURL(/\/emails\/compose/, { timeout: 30_000 });
  await expect(page.locator('#tpl')).toBeVisible({ timeout: 30_000 });
}

export async function selectTemplateByName(page: Page, nameRe: RegExp) {
  const tpl = page.locator('#tpl');
  await expect(tpl).toBeVisible({ timeout: 20_000 });
  const options = tpl.locator('option');
  const count = await options.count();
  let value: string | null = null;
  let label = '';
  for (let i = 0; i < count; i++) {
    const text = ((await options.nth(i).textContent()) || '').trim();
    if (nameRe.test(text)) {
      value = await options.nth(i).getAttribute('value');
      label = text;
      break;
    }
  }
  expect(value, `Plantilla ${nameRe}`).toBeTruthy();
  await tpl.selectOption(value!);
  await expect.poll(async () => tpl.inputValue(), { timeout: 20_000 }).toBe(value!);
  // Esperar shell de plantilla bloqueada
  await expect(page.locator('[data-ff-template-locked="1"]')).toBeVisible({
    timeout: 25_000,
  });
  return { value: value!, label };
}

export async function selectSenderByKey(page: Page, fromKey: string) {
  const target = page
    .locator('div.flex.items-center')
    .filter({ has: page.locator('span', { hasText: /^De$/ }) })
    .locator('select');
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.selectOption(fromKey);
  await expect.poll(async () => target.inputValue(), { timeout: 15_000 }).toBe(
    fromKey
  );
  // Plantilla bloqueada debe seguir presente tras cambiar remitente
  await expect(page.locator('[data-ff-template-locked="1"]')).toBeVisible();
}

export async function fillManualRecipient(page: Page, email: string) {
  const input = page.getByPlaceholder(/destinatario@ejemplo\.com/i);
  await input.fill(email);
  await expect(input).toHaveValue(email);
}

export async function fillSubject(page: Page, subject: string) {
  const subjectInput = page
    .locator('div.flex.items-center')
    .filter({ has: page.locator('span', { hasText: /^Asunto$/ }) })
    .locator('input:not([type="hidden"])');
  await expect(subjectInput).toBeVisible({ timeout: 15_000 });
  await subjectInput.fill(subject);
  await subjectInput.press('Tab');
}

export async function fillPersonalNote(page: Page, note: string) {
  const noteBox = page.locator('[data-ff-composer-note="1"]');
  await expect(noteBox).toBeVisible({ timeout: 15_000 });
  await noteBox.click();
  await page.keyboard.type(note, { delay: 15 });
  await expect(noteBox).toContainText(note, { timeout: 10_000 });
}

export async function assertComposerPreviewHasCorporateHtml(page: Page) {
  const locked = page.locator('[data-ff-template-locked="1"]');
  await expect(locked).toBeVisible({ timeout: 15_000 });
  const html = (await locked.innerHTML()).toLowerCase();
  expect(html.length).toBeGreaterThan(500);
  expect(html).toMatch(/<img\b|<table\b/);
  // No exigir consentimiento comercial para habilitar envío
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(
    /consentimiento comercial registrado|habilitaci[oó]n comercial requerida para enviar/i
  );
}

export async function clickEnviar(page: Page) {
  await page.getByRole('button', { name: /^enviar$/i }).click();
  await expect(
    page.getByRole('heading', { name: /^confirmar env[ií]o$/i })
  ).toBeVisible({ timeout: 20_000 });
}

export async function confirmSendAndWaitSends(page: Page) {
  const confirmBtn = page.getByRole('button', {
    name: /^confirmar env[ií]o$/i,
  });
  await expect(confirmBtn).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/emails\/sends/, {
      timeout: 120_000,
      waitUntil: 'domcontentloaded',
    }),
    confirmBtn.click(),
  ]);
}
