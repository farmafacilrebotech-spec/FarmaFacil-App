#!/usr/bin/env node
/**
 * EMAIL-10 — 5 envíos reales Enviar (sin [PRUEBA]) a allowlist staging.
 * Uso: node scripts/staging-email10-real-sends.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
if (String(env.FF_CORPORATE_EMAIL_DRY_RUN || '').trim() !== '0') {
  console.error('Abort: DRY_RUN debe ser 0');
  process.exit(2);
}

const recipient = (env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS || '')
  .split(',')[0]
  ?.trim()
  ?.toLowerCase();
if (recipient !== 'pilar.reyesbononat@gmail.com') {
  console.error('Abort: destinatario unexpected', recipient);
  process.exit(2);
}

const apiKey = String(env.RESEND_API_KEY || '').trim();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const batch = `EMAIL10-${stamp}`;

const SENDERS = {
  pilar: {
    from: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
  },
  info: {
    from: 'Info · FarmaFácil <info@farmafacil.solutions>',
    replyTo: 'info@farmafacil.solutions',
  },
  demo: {
    from: 'Demo · FarmaFácil <demo@farmafacil.solutions>',
    replyTo: 'demo@farmafacil.solutions',
  },
};

const cases = [
  {
    key: 'imprentas-pilar',
    template: 'imprentas',
    purpose: 'procurement',
    fromKey: 'pilar',
    subject: `[EMAIL-10] ${batch} Material corporativo pilar@ Enviar`,
  },
  {
    key: 'imprentas-info',
    template: 'imprentas',
    purpose: 'procurement',
    fromKey: 'info',
    subject: `[EMAIL-10] ${batch} Material corporativo info@ Enviar`,
  },
  {
    key: 'piloto-pilar',
    template: 'piloto',
    purpose: 'commercial',
    fromKey: 'pilar',
    subject: `[EMAIL-10] ${batch} Piloto pilar@ Enviar`,
  },
  {
    key: 'demo-demo',
    template: 'demo',
    purpose: 'commercial',
    fromKey: 'demo',
    subject: `[EMAIL-10] ${batch} Demostración demo@ Enviar`,
  },
  {
    key: 'lanzadera-pilar',
    template: 'lanzadera',
    purpose: 'institutional',
    fromKey: 'pilar',
    subject: `[EMAIL-10] ${batch} Lanzadera pilar@ Enviar`,
  },
];

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: env.E2E_SA_EMAIL,
  password: env.E2E_PASSWORD,
});
if (authErr) {
  console.error('auth', authErr.message);
  process.exit(1);
}

const results = [];
for (const c of cases) {
  const sender = SENDERS[c.fromKey];
  const html = `<p>Validación EMAIL-10 Enviar. Caso <strong>${c.key}</strong>.</p><p>Lote ${batch}. Remitente ${c.fromKey}. Plantilla ${c.template}.</p>`;
  const text = `Validación EMAIL-10 Enviar. Caso ${c.key}. Lote ${batch}.`;
  const hash = createHash('sha256')
    .update(`${c.subject}|${html}|${c.fromKey}`)
    .digest('hex');
  const idem = `ff-email10-${c.key}-${randomUUID()}`;

  const { data: claim, error: claimErr } = await sb.rpc(
    'ff_corporate_email_claim_send_v1',
    {
      p_idempotency_key: idem,
      p_draft_id: null,
      p_template_slug: c.template,
      p_subject: c.subject,
      p_html_body: html,
      p_text_body: text,
      p_recipient_email: recipient,
      p_recipient_name: null,
      p_from_address: sender.from,
      p_reply_to: sender.replyTo,
      p_purpose: c.purpose,
      p_legal_basis: null,
      p_payload_hash: hash,
      p_dry_run: false,
      p_attachment_count: 0,
      p_confirmation_ack_at: new Date().toISOString(),
      p_from_key: c.fromKey,
      p_cc_emails: [],
      p_bcc_emails: [],
    }
  );

  if (claimErr || !claim?.id) {
    results.push({
      key: c.key,
      ok: false,
      stage: 'claim',
      error: claimErr?.message || 'no id',
      subject: c.subject,
    });
    continue;
  }

  const sendId = String(claim.id);
  if (claim.replay && String(claim.status) === 'sent') {
    results.push({
      key: c.key,
      ok: true,
      stage: 'replay',
      sendId,
      subject: c.subject,
      providerMessageId: claim.provider_message_id,
      skippedResend: true,
    });
    continue;
  }

  const started = new Date().toISOString();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender.from,
      to: [recipient],
      subject: c.subject,
      html,
      text,
      reply_to: sender.replyTo,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.id) {
    await sb.rpc('ff_corporate_email_finalize_send_v1', {
      p_send_id: sendId,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error: `Resend HTTP ${res.status}`,
      p_provider_status: null,
    });
    results.push({
      key: c.key,
      ok: false,
      stage: 'resend',
      sendId,
      subject: c.subject,
      httpStatus: res.status,
      error: body,
      started,
    });
    continue;
  }

  const providerId = String(body.id);
  const { error: finErr } = await sb.rpc('ff_corporate_email_finalize_send_v1', {
    p_send_id: sendId,
    p_status: 'sent',
    p_provider_message_id: providerId,
    p_error: null,
    p_provider_status: 'accepted',
  });

  const { data: dups } = await sb
    .from('email_sends')
    .select('id')
    .eq('provider_message_id', providerId);

  results.push({
    key: c.key,
    ok: !finErr && Boolean(providerId) && (dups?.length || 0) === 1,
    stage: 'done',
    sendId,
    subject: c.subject,
    started,
    httpStatus: res.status,
    providerMessageId: providerId,
    fromKey: c.fromKey,
    template: c.template,
    purpose: c.purpose,
    dry_run: false,
    duplicates: dups?.length ?? null,
    finalizeError: finErr?.message || null,
  });
}

mkdirSync(resolve(root, 'tmp'), { recursive: true });
const outPath = resolve(root, `tmp/email10-real-sends-${stamp}.json`);
writeFileSync(
  outPath,
  JSON.stringify({ batch, recipient, results }, null, 2)
);
console.log(JSON.stringify({ batch, outPath, results }, null, 2));
process.exit(results.some((r) => !r.ok) ? 1 : 0);
