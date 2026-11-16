#!/usr/bin/env node
/**
 * Smoke staging: claim+finalize dry-run de envío visual Piloto/Demo.
 * Reproduce el fix visual_test_internal sin depender del RSC de Next.
 * Uso: node scripts/staging-email-visual-claim-smoke.mjs [piloto|demo]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function load(path) {
  if (!existsSync(path)) return {};
  const o = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

const env = {
  ...load(resolve(root, '.env.staging.local')),
  ...load(resolve(root, '.env.local')),
  ...load(resolve(root, '.env.e2e.local')),
};
if (!String(env.NEXT_PUBLIC_SUPABASE_URL || '').includes('dazfdcjscnpfvhcyjddt')) {
  console.error('Abort: no staging');
  process.exit(2);
}

const slug = (process.argv[2] || 'piloto').toLowerCase();
const marker = `E2E-SMOKE-${slug.toUpperCase()}-${Date.now()}`;
const recipient = (env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS || '')
  .split(',')[0]
  ?.trim()
  ?.toLowerCase();
if (!recipient) {
  console.error('Falta FF_CORPORATE_EMAIL_TEST_RECIPIENTS');
  process.exit(2);
}

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const email = env.E2E_SA_EMAIL || 'emails.sa.075-emails-stage@farmafacil.test';
const password = env.E2E_PASSWORD;
if (!password) {
  console.error('Falta E2E_PASSWORD');
  process.exit(2);
}

const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error('auth', authErr.message);
  process.exit(1);
}

const idem = `ff-smoke-${randomUUID()}`;
const subject = `[PRUEBA] ${marker}`;
const html = `<p>Smoke controlado ${marker} (${slug})</p>`;

const { data: claim, error: claimErr } = await sb.rpc(
  'ff_corporate_email_claim_send_v1',
  {
    p_idempotency_key: idem,
    p_draft_id: null,
    p_template_slug: slug,
    p_subject: subject,
    p_html_body: html,
    p_text_body: `Smoke ${marker}`,
    p_recipient_email: recipient,
    p_recipient_name: null,
    p_from_address: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    p_reply_to: 'pilar@farmafacil.solutions',
    // Visual test: purpose operativo (no inventa consentimiento comercial)
    p_purpose: 'operational',
    p_legal_basis: null,
    p_payload_hash: randomUUID().replace(/-/g, ''),
    p_dry_run: true,
    p_attachment_count: 0,
    p_confirmation_ack_at: new Date().toISOString(),
    p_from_key: 'pilar',
    p_cc_emails: [],
    p_bcc_emails: [],
  }
);

if (claimErr) {
  console.error('CLAIM_FAIL', claimErr.code, claimErr.message);
  process.exit(1);
}

const sendId = String(claim?.id || '');
if (!sendId) {
  console.error('CLAIM_NO_ID', claim);
  process.exit(1);
}

const { error: finErr } = await sb.rpc('ff_corporate_email_finalize_send_v1', {
  p_send_id: sendId,
  p_status: 'sent',
  p_provider_message_id: `dry-run-${sendId.slice(0, 8)}`,
  p_error: null,
  p_provider_status: 'accepted',
});
if (finErr) {
  console.error('FINALIZE_FAIL', finErr.message);
  process.exit(1);
}

console.log(
  JSON.stringify({ ok: true, sendId, subject, recipient, slug, dry_run: true })
);
