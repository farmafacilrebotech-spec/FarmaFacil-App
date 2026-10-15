#!/usr/bin/env node
/**
 * Guardrail: impide apuntar scripts/migraciones de staging a producción.
 *
 * Uso:
 *   node scripts/assert-staging-target.mjs
 *   node scripts/assert-staging-target.mjs --require-filled
 *   node scripts/assert-staging-target.mjs --env-file .env.staging.local
 *
 * Exit 0 = seguro para staging. Exit 1 = abortar.
 * No imprime secretos (solo nombres de variable y project refs).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROD_PROJECT_REF = 'gsnohwsvjxpjfcsstnfd';
const DEFAULT_ENV_FILE = '.env.staging.local';

const args = new Set(process.argv.slice(2));
const requireFilled = args.has('--require-filled');
const envFileArgIdx = process.argv.indexOf('--env-file');
const envFile =
  envFileArgIdx >= 0 && process.argv[envFileArgIdx + 1]
    ? process.argv[envFileArgIdx + 1]
    : DEFAULT_ENV_FILE;

function fail(message) {
  console.error(`[assert-staging] ABORT: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[assert-staging] OK: ${message}`);
}

function parseEnvFile(path) {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) {
    fail(`No existe ${path}. Crea y rellena las credenciales de staging.`);
  }
  const raw = readFileSync(abs, 'utf8');
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function extractProjectRef(urlOrConn) {
  if (!urlOrConn) return null;
  const fromUrl = urlOrConn.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (fromUrl) return fromUrl[1].toLowerCase();
  const fromPooler = urlOrConn.match(/postgres\.([a-z0-9]+)\./i);
  if (fromPooler) return fromPooler[1].toLowerCase();
  const fromDbUser = urlOrConn.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (fromDbUser) return fromDbUser[1].toLowerCase();
  return null;
}

function containsProdRef(value) {
  if (!value) return false;
  return value.toLowerCase().includes(PROD_PROJECT_REF);
}

const env = parseEnvFile(envFile);

if (env.FF_SUPABASE_TARGET !== 'staging') {
  fail(
    `${envFile}: FF_SUPABASE_TARGET debe ser exactamente "staging" (encontrado: ${JSON.stringify(env.FF_SUPABASE_TARGET ?? null)}).`
  );
}

const watched = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
];

for (const key of watched) {
  const value = env[key] ?? '';
  if (containsProdRef(value)) {
    fail(
      `${key} contiene el project ref de PRODUCCIÓN (${PROD_PROJECT_REF}). Usa solo farmafacil-staging.`
    );
  }
}

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const dbUrl = (env.DATABASE_URL ?? '').trim();

if (requireFilled) {
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL está vacío. Rellena credenciales de staging.');
  if (!(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()) {
    fail('NEXT_PUBLIC_SUPABASE_ANON_KEY está vacío.');
  }
  if (!(env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()) {
    fail('SUPABASE_SERVICE_ROLE_KEY está vacío.');
  }
}

const urlRef = extractProjectRef(url);
if (url && !urlRef) {
  fail('NEXT_PUBLIC_SUPABASE_URL no parece una URL de Supabase válida.');
}
if (urlRef === PROD_PROJECT_REF) {
  fail(`URL apunta a producción (${PROD_PROJECT_REF}).`);
}

const dbRef = extractProjectRef(dbUrl);
if (dbUrl && dbRef === PROD_PROJECT_REF) {
  fail(`DATABASE_URL apunta a producción (${PROD_PROJECT_REF}).`);
}
if (urlRef && dbRef && urlRef !== dbRef) {
  fail(
    `Project ref de URL (${urlRef}) ≠ DATABASE_URL (${dbRef}). Deben ser el mismo staging.`
  );
}

ok(`target=staging env=${envFile}`);
if (urlRef) ok(`supabase project ref=${urlRef} (≠ producción)`);
else ok('URL aún sin rellenar — completa .env.staging.local antes de migrar o conectar.');
if (dbUrl && dbRef) ok(`database project ref=${dbRef}`);
process.exit(0);
