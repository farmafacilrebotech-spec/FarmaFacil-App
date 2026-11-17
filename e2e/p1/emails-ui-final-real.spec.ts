import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loginAs } from '../helpers/auth';
import {
  assertComposerPreviewHasCorporateHtml,
  clickEnviar,
  confirmSendAndWaitSends,
  fillManualRecipient,
  fillPersonalNote,
  fillSubject,
  goNuevoEmail,
  selectSenderByKey,
  selectTemplateByName,
  stagingRecipient,
} from '../helpers/email-composer';

/**
 * EMAIL-10 — 5 envíos reales desde el compositor (botón Enviar).
 * Solo se ejecuta con EMAIL10_UI_FINAL=1. No forma parte del gate ordinario.
 */
const enabled = process.env.EMAIL10_UI_FINAL === '1';

type Case = {
  key: string;
  templateRe: RegExp;
  fromKey: string;
  subjectLabel: string;
  note?: string;
};

const ALL_CASES: Case[] = [
  {
    key: 'imprentas-pilar',
    templateRe: /material corporativo|imprentas|presupuesto/i,
    fromKey: 'pilar',
    subjectLabel: 'Material corporativo pilar@',
  },
  {
    key: 'imprentas-info',
    templateRe: /material corporativo|imprentas|presupuesto/i,
    fromKey: 'info',
    subjectLabel: 'Material corporativo info@',
  },
  {
    key: 'piloto-pilar',
    templateRe: /piloto/i,
    fromKey: 'pilar',
    subjectLabel: 'Piloto pilar@',
    note: 'Nota personalizada UI-FINAL Piloto — validación compositor real.',
  },
  {
    key: 'demo-demo',
    templateRe: /demo|demostraci[oó]n/i,
    fromKey: 'demo',
    subjectLabel: 'Demostración demo@',
  },
  {
    key: 'lanzadera-pilar',
    templateRe: /lanzadera/i,
    fromKey: 'pilar',
    subjectLabel: 'Lanzadera pilar@',
  },
];

/** Opcional: EMAIL10_UI_FINAL_KEYS=imprentas-info,piloto-pilar,... */
function selectedCases(): Case[] {
  const raw = (process.env.EMAIL10_UI_FINAL_KEYS || '').trim();
  if (!raw) return ALL_CASES;
  const keys = new Set(
    raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  );
  const picked = ALL_CASES.filter((c) => keys.has(c.key));
  if (!picked.length) {
    throw new Error(`EMAIL10_UI_FINAL_KEYS sin coincidencias: ${raw}`);
  }
  return picked;
}

function evidenceDir(): string {
  const dir = path.join(process.cwd(), 'tmp', 'email10-ui-final');
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function fetchSendBySubject(subject: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const email = process.env.E2E_SA_EMAIL || '';
  const password = process.env.E2E_PASSWORD || '';
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authErr } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) throw new Error(authErr.message);
  const { data, error } = await sb
    .from('email_sends')
    .select(
      'id, subject, status, dry_run, provider_message_id, provider_status, from_key, template_slug, html_body, recipient_email, signature_included'
    )
    .eq('subject', subject)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  return data || [];
}

test.describe('EMAIL-10 UI-FINAL envíos reales compositor', () => {
  test.skip(!enabled, 'Requiere EMAIL10_UI_FINAL=1');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('cinco Enviar reales con plantillas corporativas', async ({ page }) => {
    test.setTimeout(600_000);
    const stamp =
      process.env.EMAIL10_UI_FINAL_STAMP ||
      new Date().toISOString().replace(/[:.]/g, '-');
    const dir = evidenceDir();
    const recipient = stagingRecipient();
    const results: Array<Record<string, unknown>> = [];
    const cases = selectedCases();

    // Serial; re-login por caso (la acción de envío puede invalidar cookie SSR)
    for (const c of cases) {
      await loginAs(page, 'superadmin');
      const subject = `[UI-FINAL] ${c.subjectLabel} ${stamp}`;
      await goNuevoEmail(page);
      const tpl = await selectTemplateByName(page, c.templateRe);
      await selectSenderByKey(page, c.fromKey);
      await fillManualRecipient(page, recipient);
      await fillSubject(page, subject);
      if (c.note) await fillPersonalNote(page, c.note);
      await assertComposerPreviewHasCorporateHtml(page);

      await page.screenshot({
        path: path.join(dir, `${c.key}-composer.png`),
        fullPage: true,
      });

      await clickEnviar(page);
      await expect(page.getByText(subject, { exact: false })).toBeVisible();
      // Sin bloqueo de habilitación comercial
      await expect(
        page.getByRole('button', { name: /^confirmar env[ií]o$/i })
      ).toBeEnabled();
      await page.screenshot({
        path: path.join(dir, `${c.key}-confirm.png`),
        fullPage: true,
      });

      await confirmSendAndWaitSends(page);

      // Toast / fila Enviados
      await expect(page.getByText(subject).first()).toBeVisible({
        timeout: 60_000,
      });
      await page.screenshot({
        path: path.join(dir, `${c.key}-enviados.png`),
        fullPage: true,
      });

      // Abrir detalle HTML
      const row = page.locator('li').filter({ hasText: subject }).first();
      await row.getByRole('button', { name: /abrir correo completo/i }).click();
      await expect(page.locator('.fixed, [role="dialog"]').first()).toBeVisible({
        timeout: 20_000,
      });
      await page.screenshot({
        path: path.join(dir, `${c.key}-detalle.png`),
        fullPage: true,
      });
      // Cerrar si hay botón
      const close = page.getByRole('button', { name: /cerrar|close/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click();

      const rows = await fetchSendBySubject(subject);
      expect(rows.length, `registro ${c.key}`).toBeGreaterThan(0);
      const send = rows[0]!;
      expect(send.dry_run).toBe(false);
      expect(send.status).toMatch(/sent|accepted|delivered/i);
      expect(String(send.provider_message_id || '')).toMatch(/\S/);
      expect(String(send.html_body || '').length).toBeGreaterThan(500);
      expect(String(send.html_body || '')).toMatch(/<img\b|<table\b/i);
      expect(String(send.html_body || '')).not.toMatch(
        /Validación EMAIL-10 Enviar\. Caso/i
      );
      if (c.note) {
        expect(String(send.html_body || '')).toContain('Nota personalizada UI-FINAL');
      }
      // Sin prefijo [PRUEBA]
      expect(subject).not.toMatch(/^\[PRUEBA\]/i);
      expect(String(send.subject)).not.toMatch(/^\[PRUEBA\]/i);

      results.push({
        key: c.key,
        subject,
        templateLabel: tpl.label,
        fromKey: c.fromKey,
        sendId: send.id,
        providerMessageId: send.provider_message_id,
        providerStatus: send.provider_status,
        status: send.status,
        dry_run: send.dry_run,
        signatureIncluded: send.signature_included,
        htmlLength: String(send.html_body || '').length,
        hasImg: /<img\b/i.test(String(send.html_body || '')),
        hasTable: /<table\b/i.test(String(send.html_body || '')),
        hasNote: c.note
          ? String(send.html_body || '').includes('Nota personalizada UI-FINAL')
          : null,
        recipient: send.recipient_email,
      });
    }

    writeFileSync(
      path.join(dir, `results-${stamp}.json`),
      JSON.stringify({ stamp, recipient, results }, null, 2)
    );
    expect(results).toHaveLength(cases.length);
    expect(results.every((r) => r.hasImg || r.hasTable)).toBeTruthy();
  });
});
