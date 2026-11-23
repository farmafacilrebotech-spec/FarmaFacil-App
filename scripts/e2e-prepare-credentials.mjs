#!/usr/bin/env node
/**
 * Prepara credenciales E2E en staging (solo cuentas de laboratorio).
 * Escribe `.env.e2e.local` (gitignored). Usa service_role SOLO para set password.
 * No toca producción.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
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

const root = resolve(__dirname, '..');
const staging = loadEnv(resolve(root, '.env.staging.local'));
const url = staging.NEXT_PUBLIC_SUPABASE_URL || '';
if (!url.includes('dazfdcjscnpfvhcyjddt')) {
  console.error('Abort: no es staging dazfdcjscnpfvhcyjddt');
  process.exit(2);
}
const service = staging.SUPABASE_SERVICE_ROLE_KEY;
if (!service) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.staging.local');
  process.exit(2);
}

/**
 * Modos:
 *  - (default)            resetea TODO el kit con una password compartida (E2E_PASSWORD o aleatoria).
 *  - --only=E2E_DUAL_EMAIL[,K2]  resetea solo esas claves del kit REUSANDO la password ya existente
 *                         en `.env.e2e.local` / env (no rota al resto). Aborta si no hay password previa.
 */
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyKeys = onlyArg
  ? onlyArg
      .slice('--only='.length)
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  : null;

const existingE2e = loadEnv(resolve(root, '.env.e2e.local'));
// Solo en modo --only se reusa la password del archivo; el modo default conserva el comportamiento previo.
const existingPassword =
  process.env.E2E_PASSWORD || (onlyKeys ? existingE2e.E2E_PASSWORD : undefined);
if (onlyKeys && !existingPassword) {
  console.error(
    'Abort: --only requiere E2E_PASSWORD previa (env o .env.e2e.local). Ejecuta sin --only una vez.'
  );
  process.exit(2);
}

const password =
  existingPassword || `FfE2E_${randomBytes(9).toString('base64url')}!aA1`;

const users = {
  E2E_SA_EMAIL: 'emails.sa.075-emails-stage@farmafacil.test',
  E2E_OWNER_EMAIL: 'catalog.owner.074@farmafacil.test',
  E2E_ADMIN_EMAIL: 'catalog.admin.074@farmafacil.test',
  E2E_PHARMACIST_EMAIL: 'catalog.pharmacist.074@farmafacil.test',
  E2E_STAFF_EMAIL: 'catalog.staff.074@farmafacil.test',
  E2E_CUSTOMER_EMAIL: 'cliente.test3070@farmafacil.test',
  E2E_CUSTOMER_B_EMAIL: 'lab.cliente.b.clientsqr@farmafacil.test',
  E2E_OUTSIDER_EMAIL: 'catalog.outsider.074@farmafacil.test',
  /** Usuario dual (owner/staff multi-rol en staging). Ver docs/qa/STAGING_MODULOS_PRUEBA_2026-11-23.md */
  E2E_DUAL_EMAIL: 'catalog.dual.074@farmafacil.test',
};

if (onlyKeys) {
  const unknown = onlyKeys.filter((k) => !(k in users));
  if (unknown.length) {
    console.error('Abort: claves desconocidas en --only:', unknown.join(', '));
    process.exit(2);
  }
}
const targetUsers = onlyKeys
  ? Object.fromEntries(onlyKeys.map((k) => [k, users[k]]))
  : users;

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function setPassword(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const u = (data?.users || []).find(
    (x) => (x.email || '').toLowerCase() === email.toLowerCase()
  );
  if (!u) {
    console.warn('SKIP missing user', email);
    return false;
  }
  const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
    password,
  });
  if (upErr) throw upErr;
  console.log('OK password set', email);
  return true;
}

let ok = 0;
for (const email of Object.values(targetUsers)) {
  if (await setPassword(email)) ok += 1;
}

/** Asegura account_kind customer en cuentas de aislamiento E2E (solo staging lab). */
async function ensureCustomerKind(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const u = (data?.users || []).find(
    (x) => (x.email || '').toLowerCase() === email.toLowerCase()
  );
  if (!u) return;
  const { error: upErr } = await admin
    .from('profiles')
    .update({ account_kind: 'customer' })
    .eq('id', u.id);
  if (upErr) {
    console.warn('WARN account_kind', email, upErr.message);
  } else {
    console.log('OK account_kind=customer', email);
  }
}

if (!onlyKeys) {
  await ensureCustomerKind(users.E2E_CUSTOMER_EMAIL);
  await ensureCustomerKind(users.E2E_CUSTOMER_B_EMAIL);
}

const lines = [
  '# Generado por scripts/e2e-prepare-credentials.mjs — NO COMMIT',
  `E2E_BASE_URL=http://127.0.0.1:3070`,
  `E2E_PASSWORD=${password}`,
  ...Object.entries(users).map(([k, v]) => `${k}=${v}`),
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${staging.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  '',
];
writeFileSync(resolve(root, '.env.e2e.local'), lines.join('\n'), {
  mode: 0o600,
});
console.log(`Wrote .env.e2e.local (${ok} users). Password not printed.`);
