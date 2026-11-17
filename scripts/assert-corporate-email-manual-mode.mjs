#!/usr/bin/env node
/**
 * Garantiza que el entorno de validación manual NO queda en dry-run.
 * Uso: node scripts/assert-corporate-email-manual-mode.mjs
 * Exit 0 = envío real autorizado (allowlist). Exit 1 = modo simulado/off.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

// Misma precedencia efectiva que Next + daemon:
// staging.local (daemon --env-file) luego .env.local.
const env = {
  ...load(resolve(root, '.env.staging.local')),
  ...load(resolve(root, '.env.local')),
};

const sendRaw = String(env.FF_CORPORATE_EMAIL_SEND_ENABLED || '')
  .trim()
  .toLowerCase();
const enabled = sendRaw === '1' || sendRaw === 'true' || sendRaw === 'yes';
const dryRaw = String(env.FF_CORPORATE_EMAIL_DRY_RUN || '')
  .trim()
  .toLowerCase();
const live = dryRaw === '0' || dryRaw === 'false' || dryRaw === 'no';
const recipients = String(env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const resend = Boolean(String(env.RESEND_API_KEY || '').trim());

const report = {
  enabled,
  dryRun: enabled ? !live : null,
  live: enabled && live,
  allowlistConfigured: recipients.length > 0,
  resendConfigured: resend,
};

if (!report.live || !report.allowlistConfigured || !report.resendConfigured) {
  console.error(
    JSON.stringify({ ok: false, mode: 'not_manual_live', ...report })
  );
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, mode: 'manual_live', ...report }));
