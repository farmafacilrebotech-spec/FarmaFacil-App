#!/usr/bin/env node
/**
 * Ejecuta psql contra DATABASE_URL de .env.staging.local con guardrail anti-producción.
 * No imprime la connection string.
 *
 *   node scripts/staging-psql.mjs -c "SELECT 1"
 *   node scripts/staging-psql.mjs -f supabase/migrations/001_....sql
 *   node scripts/staging-psql.mjs --migrate-001-033
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROD = 'gsnohwsvjxpjfcsstnfd';
const STAGING = 'dazfdcjscnpfvhcyjddt';
const ENV_FILE = '.env.staging.local';

function fail(msg) {
  console.error(`[staging-psql] ABORT: ${msg}`);
  process.exit(1);
}

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

function assertStagingEnv(env) {
  if (env.FF_SUPABASE_TARGET !== 'staging') {
    fail('FF_SUPABASE_TARGET must be staging');
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
  const db = env.DATABASE_URL || '';
  if (!db) fail('DATABASE_URL vacío');
  if (url.includes(PROD) || db.includes(PROD)) {
    fail('Credenciales apuntan a PRODUCCIÓN');
  }
  if (!db.includes(STAGING)) {
    fail('DATABASE_URL no contiene el project ref de staging esperado');
  }
  const urlRef = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (urlRef && urlRef !== STAGING) {
    fail(`URL ref ${urlRef} ≠ staging ${STAGING}`);
  }
}

/**
 * Migraciones DDL suelen fallar o comportarse mal en pooler transaction (6543).
 * Preferir Session mode (5432) en el mismo host pooler si viene 6543.
 */
function preferSessionPooler(databaseUrl) {
  try {
    const u = new URL(databaseUrl.replace(/^postgres:/i, 'postgresql:'));
    if (u.port === '6543' && /pooler\.supabase\.com$/i.test(u.hostname)) {
      u.port = '5432';
      // pgbouncer=true es para transaction mode; en session no hace falta
      u.searchParams.delete('pgbouncer');
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return databaseUrl;
}

function runPsql(databaseUrl, psqlArgs) {
  const result = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', ...psqlArgs], {
    env: { ...process.env, DATABASE_URL: databaseUrl, PGOPTIONS: '' },
    stdio: 'inherit',
    // Pass connection via env var recognized by psql when using conninfo?
    // Safer: use argv without printing — pass as first non-option after rewriting.
  });
  // Actually psql needs the URL as argument or PG* vars. Use env PGDATABASE etc is hard.
  // Re-run properly:
  return result;
}

const absEnv = resolve(process.cwd(), ENV_FILE);
if (!existsSync(absEnv)) fail(`No existe ${ENV_FILE}`);

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled'],
  { stdio: 'inherit' }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

const env = parseEnv(absEnv);
assertStagingEnv(env);

let databaseUrl = preferSessionPooler(env.DATABASE_URL);
// Final safety
if (databaseUrl.includes(PROD)) fail('PROD detectado tras normalizar URL');
if (!databaseUrl.includes(STAGING)) fail('STAGING ref ausente tras normalizar URL');

const argv = process.argv.slice(2);

if (argv[0] === '--migrate-001-033') {
  const dir = resolve('supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .filter((f) => {
      const n = parseInt(f.slice(0, 3), 10);
      return n >= 1 && n <= 33;
    })
    .sort((a, b) => a.localeCompare(b));

  if (files.length !== 33) {
    fail(`Se esperaban 33 migraciones 001–033, encontradas ${files.length}`);
  }
  console.log(`[staging-psql] Aplicando ${files.length} migraciones 001–033 a staging (${STAGING})…`);

  for (const file of files) {
    const full = resolve(dir, file);
    console.log(`[staging-psql] → ${file}`);
    const r = spawnSync(
      'psql',
      [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', full],
      { stdio: 'inherit', env: process.env }
    );
    if (r.status !== 0) {
      fail(`Falló migración ${file} (exit ${r.status}). Detenido.`);
    }
  }
  console.log('[staging-psql] OK: migraciones 001–033 aplicadas.');
  process.exit(0);
}

// Generic psql passthrough
const r = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', ...argv], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(r.status ?? 1);
