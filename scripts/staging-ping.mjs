#!/usr/bin/env node
/**
 * Comprobación de solo lectura: Auth health del proyecto staging.
 * No ejecuta SQL ni migraciones. No imprime claves.
 *
 *   node scripts/assert-staging-target.mjs --require-filled
 *   node scripts/staging-ping.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ENV_FILE = '.env.staging.local';

function fail(message) {
  console.error(`[staging-ping] ABORT: ${message}`);
  process.exit(1);
}

function parseEnvFile(path) {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) fail(`No existe ${path}`);
  const out = {};
  for (const line of readFileSync(abs, 'utf8').split(/\r?\n/)) {
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

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled', '--env-file', ENV_FILE],
  { stdio: 'inherit' }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

const env = parseEnvFile(ENV_FILE);
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const healthUrl = `${base}/auth/v1/health`;

const res = await fetch(healthUrl, {
  method: 'GET',
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  },
});

if (!res.ok) {
  fail(`Auth health HTTP ${res.status} en ${base.replace(/https:\/\/([^.]+).*/, 'https://$1…')}`);
}

const ref = base.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? '?';
console.log(`[staging-ping] OK: Auth health reachable for project ref=${ref}`);
process.exit(0);
