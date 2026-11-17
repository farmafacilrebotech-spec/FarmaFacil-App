#!/usr/bin/env node
/**
 * Envíos reales controlados a la allowlist (EMAIL-09).
 * Solo staging. No reenvía automáticamente. Asuntos únicos.
 *
 * Uso:
 *   node scripts/staging-email-real-send-batch.mjs
 *   node scripts/staging-email-real-send-batch.mjs --only=libre-personal,piloto
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
    ) {
      v = v.slice(1, -1);
    }
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

const dryRaw = String(env.FF_CORPORATE_EMAIL_DRY_RUN || '')
  .trim()
  .toLowerCase();
const live = dryRaw === '0' || dryRaw === 'false' || dryRaw === 'no';
const sendOn = ['1', 'true', 'yes'].includes(
  String(env.FF_CORPORATE_EMAIL_SEND_ENABLED || '')
    .trim()
    .toLowerCase()
);
if (!sendOn || !live) {
  console.error('Abort: requiere SEND_ENABLED=1 y DRY_RUN=0');
  process.exit(2);
}

const recipient = (env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS || '')
  .split(',')[0]
  ?.trim()
  ?.toLowerCase();
if (recipient !== 'pilar.reyesbononat@gmail.com') {
  console.error('Abort: destinatario allowlist inesperado', recipient);
  process.exit(2);
}

const apiKey = String(env.RESEND_API_KEY || '').trim();
if (!apiKey) {
  console.error('Abort: falta RESEND_API_KEY');
  process.exit(2);
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : null;

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const batchId = `EMAIL09-${stamp}`;

const cases = [
  {
    key: 'libre-personal',
    subject: `[EMAIL-09] ${batchId} libre firma personal`,
    template: 'blank',
    html: `<p>Prueba EMAIL-09 libre con firma personal. Lote ${batchId}.</p>`,
    text: `Prueba EMAIL-09 libre con firma personal. Lote ${batchId}.`,
    from: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
    fromKey: 'pilar',
    purpose: 'operational',
    attach: false,
  },
  {
    key: 'libre-corporativa',
    subject: `[EMAIL-09] ${batchId} libre firma corporativa`,
    template: 'blank',
    html: `<p>Prueba EMAIL-09 libre con firma corporativa. Lote ${batchId}.</p>`,
    text: `Prueba EMAIL-09 libre con firma corporativa. Lote ${batchId}.`,
    from: 'Contacto · FarmaFácil <contacto@farmafacil.solutions>',
    replyTo: 'contacto@farmafacil.solutions',
    fromKey: 'contacto',
    purpose: 'operational',
    attach: false,
  },
  {
    key: 'libre-sin-firma',
    subject: `[EMAIL-09] ${batchId} libre sin firma`,
    template: 'blank',
    html: `<p>Prueba EMAIL-09 libre sin bloque de firma embebido. Lote ${batchId}.</p>`,
    text: `Prueba EMAIL-09 libre sin bloque de firma embebido. Lote ${batchId}.`,
    from: 'Info · FarmaFácil <info@farmafacil.solutions>',
    replyTo: 'info@farmafacil.solutions',
    fromKey: 'info',
    purpose: 'operational',
    attach: false,
  },
  {
    key: 'piloto',
    subject: `[EMAIL-09] ${batchId} plantilla Piloto`,
    template: 'piloto',
    html: `<p>Prueba EMAIL-09 plantilla Piloto. Lote ${batchId}.</p><p>Nota: validación real Resend.</p>`,
    text: `Prueba EMAIL-09 plantilla Piloto. Lote ${batchId}.`,
    from: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
    fromKey: 'pilar',
    purpose: 'operational',
    attach: false,
  },
  {
    key: 'demo',
    subject: `[EMAIL-09] ${batchId} plantilla Demostración`,
    template: 'demo',
    html: `<p>Prueba EMAIL-09 plantilla Demostración. Lote ${batchId}.</p>`,
    text: `Prueba EMAIL-09 plantilla Demostración. Lote ${batchId}.`,
    from: 'Demo · FarmaFácil <demo@farmafacil.solutions>',
    replyTo: 'demo@farmafacil.solutions',
    fromKey: 'demo',
    purpose: 'operational',
    attach: false,
  },
  {
    key: 'piloto-nota',
    subject: `[EMAIL-09] ${batchId} Piloto con nota`,
    template: 'piloto',
    html: `<p>Prueba EMAIL-09 Piloto con nota personalizada. Lote ${batchId}.</p><p><em>Nota personal: gracias por validar EMAIL-09.</em></p>`,
    text: `Prueba EMAIL-09 Piloto con nota personalizada. Lote ${batchId}. Nota personal: gracias por validar EMAIL-09.`,
    from: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
    fromKey: 'pilar',
    purpose: 'operational',
    attach: false,
  },
  {
    key: 'libre-adjunto',
    subject: `[EMAIL-09] ${batchId} libre con adjunto`,
    template: 'blank',
    html: `<p>Prueba EMAIL-09 libre con adjunto PDF mínimo. Lote ${batchId}.</p>`,
    text: `Prueba EMAIL-09 libre con adjunto PDF mínimo. Lote ${batchId}.`,
    from: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
    fromKey: 'pilar',
    purpose: 'operational',
    attach: true,
  },
].filter((c) => !only || only.has(c.key));

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

// Minimal valid PDF
const pdfBase64 = Buffer.from(
  `%PDF-1.1
1 0 obj<<>>endobj
2 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 100 700 Td (EMAIL-09) Tj ET
endstream
endobj
3 0 obj<< /Type /Page /Parent 4 0 R /Contents 2 0 R >>endobj
4 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 612 792] >>endobj
5 0 obj<< /Type /Catalog /Pages 4 0 R >>endobj
trailer<< /Root 5 0 R >>
%%EOF`
).toString('base64');

async function sendResend(c) {
  const payload = {
    from: c.from,
    to: [recipient],
    subject: c.subject,
    html: c.html,
    text: c.text,
    reply_to: c.replyTo,
  };
  if (c.attach) {
    payload.attachments = [
      {
        filename: `email09-${batchId}.pdf`,
        content: pdfBase64,
      },
    ];
  }
  const started = new Date().toISOString();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text();
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { raw: bodyText.slice(0, 500) };
  }
  return { started, httpStatus: res.status, body };
}

async function getResend(id) {
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  return { httpStatus: res.status, body };
}

const results = [];

for (const c of cases) {
  const hash = createHash('sha256')
    .update(`${c.subject}|${c.html}|${recipient}|${c.fromKey}`)
    .digest('hex');
  const idem = `ff-email09-${c.key}-${randomUUID()}`;

  const { data: claim, error: claimErr } = await sb.rpc(
    'ff_corporate_email_claim_send_v1',
    {
      p_idempotency_key: idem,
      p_draft_id: null,
      p_template_slug: c.template,
      p_subject: c.subject,
      p_html_body: c.html,
      p_text_body: c.text,
      p_recipient_email: recipient,
      p_recipient_name: null,
      p_from_address: c.from,
      p_reply_to: c.replyTo,
      p_purpose: c.purpose,
      p_legal_basis: null,
      p_payload_hash: hash,
      p_dry_run: false,
      p_attachment_count: c.attach ? 1 : 0,
      p_confirmation_ack_at: new Date().toISOString(),
      p_from_key: c.fromKey,
      p_cc_emails: [],
      p_bcc_emails: [],
    }
  );

  if (claimErr) {
    results.push({
      key: c.key,
      ok: false,
      stage: 'claim',
      error: claimErr.message,
      subject: c.subject,
    });
    continue;
  }

  const sendId = String(claim?.id || '');
  if (!sendId) {
    results.push({
      key: c.key,
      ok: false,
      stage: 'claim',
      error: 'no sendId',
      subject: c.subject,
    });
    continue;
  }

  // Idempotencia: si replay already sent, no reenviar a Resend
  if (claim?.replay && String(claim?.status) === 'sent') {
    results.push({
      key: c.key,
      ok: true,
      stage: 'replay',
      sendId,
      subject: c.subject,
      providerMessageId: claim.provider_message_id ?? null,
      dry_run: Boolean(claim.dry_run),
      skippedResend: true,
    });
    continue;
  }

  const sent = await sendResend(c);
  if (sent.httpStatus >= 300 || !sent.body?.id) {
    await sb.rpc('ff_corporate_email_finalize_send_v1', {
      p_send_id: sendId,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error: `Resend HTTP ${sent.httpStatus}`,
      p_provider_status: null,
    });
    results.push({
      key: c.key,
      ok: false,
      stage: 'resend',
      sendId,
      subject: c.subject,
      httpStatus: sent.httpStatus,
      error: sent.body,
      started: sent.started,
    });
    continue;
  }

  const providerId = String(sent.body.id);
  const { error: finErr } = await sb.rpc('ff_corporate_email_finalize_send_v1', {
    p_send_id: sendId,
    p_status: 'sent',
    p_provider_message_id: providerId,
    p_error: null,
    p_provider_status: 'accepted',
  });

  // Lectura Resend (best-effort): algunas API keys solo permiten POST.
  await new Promise((r) => setTimeout(r, 800));
  const probed = await getResend(providerId);

  // Duplicados: mismo provider_message_id
  const { data: dups } = await sb
    .from('email_sends')
    .select('id')
    .eq('provider_message_id', providerId);

  const authenticId =
    Boolean(providerId) && !/^dry-run-/i.test(providerId);
  const ok =
    !finErr &&
    sent.httpStatus >= 200 &&
    sent.httpStatus < 300 &&
    authenticId &&
    Array.isArray(dups) &&
    dups.length === 1;

  results.push({
    key: c.key,
    ok,
    stage: 'done',
    sendId,
    subject: c.subject,
    started: sent.started,
    httpStatus: sent.httpStatus,
    providerMessageId: providerId,
    finalizeError: finErr?.message || null,
    resendGetStatus: probed.httpStatus,
    resendGetNote:
      probed.httpStatus === 200
        ? null
        : 'GET emails/{id} no autorizado con esta API key; POST create sí aceptó el mensaje',
    resendLastEvent: probed.body?.last_event || probed.body?.status || null,
    duplicates: Array.isArray(dups) ? dups.length : null,
    dry_run: false,
  });
}

mkdirSync(resolve(root, 'tmp'), { recursive: true });
const outPath = resolve(root, `tmp/email09-real-sends-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ batchId, recipient, results }, null, 2));
console.log(JSON.stringify({ batchId, outPath, results }, null, 2));

const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
