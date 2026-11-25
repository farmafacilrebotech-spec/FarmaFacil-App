#!/usr/bin/env node
/**
 * Prepara credenciales E2E en staging (solo cuentas de laboratorio).
 * Escribe `.env.e2e.local` (gitignored). Usa service_role SOLO para set password.
 * No toca producción.
 *
 * Estabilidad QA / CI:
 *  - Por defecto REUTILIZA E2E_PASSWORD (env o `.env.e2e.local`).
 *  - NO genera password aleatoria salvo `--force-rotate`.
 *  - `--ensure` solo escribe password si el login actual falla (CI seguro).
 *  - `--only=KEY[,KEY]` limita el kit afectado.
 *
 * Futuro: separar usuarios CI (`ci.*@…`) de QA manual para rotaciones independientes.
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
const anon = staging.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!service) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.staging.local');
  process.exit(2);
}
if (!anon) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.staging.local');
  process.exit(2);
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyKeys = onlyArg
  ? onlyArg
      .slice('--only='.length)
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  : null;
const forceRotate = process.argv.includes('--force-rotate');
const ensureOnly = process.argv.includes('--ensure');

const existingE2e = loadEnv(resolve(root, '.env.e2e.local'));
const existingPassword =
  process.env.E2E_PASSWORD || existingE2e.E2E_PASSWORD || undefined;

if (onlyKeys && !existingPassword && !forceRotate) {
  console.error(
    'Abort: --only requiere E2E_PASSWORD previa (env o .env.e2e.local), o usa --force-rotate.'
  );
  process.exit(2);
}

let password;
if (forceRotate) {
  password = `FfE2E_${randomBytes(9).toString('base64url')}!aA1`;
  console.log('Mode: --force-rotate (nueva password; no se imprime).');
} else if (existingPassword) {
  password = existingPassword;
  console.log(
    ensureOnly
      ? 'Mode: --ensure (reusa password; solo corrige logins rotos).'
      : 'Mode: sync (reusa password de env / .env.e2e.local).'
  );
} else {
  console.error(
    'Abort: falta E2E_PASSWORD (env o .env.e2e.local). ' +
      'Para rotar a propósito: --force-rotate. ' +
      'Evita regenerar en CI/QA sin autorización.'
  );
  process.exit(2);
}

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
const anonClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loginWorks(email) {
  const { error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  // Cerrar sesión anónima del cliente compartido
  await anonClient.auth.signOut().catch(() => {});
  return !error;
}

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
  if (ensureOnly) {
    if (await loginWorks(email)) {
      console.log('OK already valid', email);
      return true;
    }
    console.log('FIX login broken, resetting', email);
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
  `# sync=${new Date().toISOString()} ensure=${ensureOnly} force_rotate=${forceRotate}`,
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
