#!/usr/bin/env node
/**
 * Smoke orden estados + exposición (082) en staging DEMO.
 *   node scripts/staging-kiosk-inventory-order-smoke.mjs --apply-082
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROD = 'gsnohwsvjxpjfcsstnfd';
const STAGING = 'dazfdcjscnpfvhcyjddt';
const ENV_FILE = '.env.staging.local';
const apply082 = process.argv.includes('--apply-082');
const MARKER = `inv082-${Date.now()}`;

function fail(msg) {
  console.error(`[inv082-smoke] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[inv082-smoke] OK: ${msg}`);
}

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const eq = t.indexOf('=');
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

const absEnv = resolve(process.cwd(), ENV_FILE);
if (!existsSync(absEnv)) fail(`missing ${ENV_FILE}`);
const env = parseEnv(absEnv);
if (env.FF_SUPABASE_TARGET !== 'staging') fail('FF_SUPABASE_TARGET != staging');
if (!env.DATABASE_URL?.includes(STAGING) || env.DATABASE_URL.includes(PROD)) {
  fail('DATABASE_URL not staging');
}

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled'],
  { stdio: 'inherit' }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

function preferSessionPooler(databaseUrl) {
  try {
    const u = new URL(databaseUrl.replace(/^postgres:/i, 'postgresql:'));
    if (u.port === '6543' && /pooler\.supabase\.com$/i.test(u.hostname)) {
      u.port = '5432';
      u.searchParams.delete('pgbouncer');
      return u.toString();
    }
  } catch {
    /* keep */
  }
  return databaseUrl;
}

const dbUrl = preferSessionPooler(env.DATABASE_URL);

function psql(sql, { file } = {}) {
  const args = ['-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', dbUrl];
  if (file) args.push('-f', file);
  else args.push('-c', sql);
  const r = spawnSync('psql', args, {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  if (r.status !== 0) {
    fail(`psql error: ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  }
  return (r.stdout || '').trim();
}

if (apply082) {
  const mig = resolve(
    process.cwd(),
    'supabase/migrations/082_kiosk_status_notes_append_v1.sql'
  );
  if (!existsSync(mig)) fail('missing 082');
  psql('', { file: mig });
  ok('082 aplicada');
}

const saId = psql(`
SELECT pur.profile_id::text
FROM platform_user_roles pur
JOIN platform_roles r ON r.id = pur.platform_role_id
WHERE r.key = 'PLATFORM_SUPERADMIN'
LIMIT 1;
`);
if (!saId) fail('no SA');

const assetId = psql(`
SELECT id::text FROM kiosk_assets
WHERE status IN ('warehouse','pending_identification')
  AND notes IS DISTINCT FROM 'DO_NOT_TOUCH_REAL'
ORDER BY updated_at DESC NULLS LAST
LIMIT 1;
`);
if (!assetId) fail('no DEMO-friendly warehouse asset');

const beforeNotes = psql(
  `SELECT coalesce(notes,'') FROM kiosk_assets WHERE id='${assetId}'::uuid;`
);

psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.ff_kiosk_inventory_set_status_v1(
  '${assetId}'::uuid,
  'exhibition',
  'Exposición: showroom DEMO ${MARKER}'
)::text;
`);

const mid = psql(`
SELECT status||'|'||coalesce(notes,'') FROM kiosk_assets WHERE id='${assetId}'::uuid;
`);
if (!mid.startsWith('exhibition|')) fail(`status mid: ${mid.slice(0, 120)}`);
if (!mid.includes(`Exposición: showroom DEMO ${MARKER}`)) {
  fail('nota exposición no guardada');
}
if (beforeNotes && !mid.includes(beforeNotes.split('\n')[0].slice(0, 20)) && beforeNotes.trim()) {
  // append should keep previous content when it existed
  if (!mid.includes(beforeNotes.trim())) {
    fail('historial de notas sobrescrito');
  }
}
ok('exposición sin farmacia + nota anexada');

psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.ff_kiosk_inventory_set_status_v1(
  '${assetId}'::uuid,
  'warehouse',
  'Vuelta a disponible ${MARKER}'
)::text;
`);

const after = psql(`
SELECT status||'|'||coalesce(current_pharmacy_id::text,'') FROM kiosk_assets WHERE id='${assetId}'::uuid;
`);
if (!after.startsWith('warehouse|')) fail(`status after: ${after}`);
ok('vuelta a disponible');

const events = psql(`
SELECT count(*)::text FROM kiosk_asset_status_events
WHERE asset_id='${assetId}'::uuid
  AND reason ILIKE '%${MARKER}%';
`);
if (Number(events) < 1) fail('sin eventos de auditoría');
ok(`auditoría events=${events}`);

const orderCheck = psql(`
WITH ranked AS (
  SELECT status,
    CASE status
      WHEN 'assigned' THEN 1
      WHEN 'exhibition' THEN 2
      WHEN 'warehouse' THEN 3
      WHEN 'pending_identification' THEN 3
      WHEN 'repair' THEN 4
      WHEN 'retired' THEN 5
      ELSE 9
    END AS rk
  FROM kiosk_assets
  LIMIT 200
)
SELECT CASE WHEN bool_and(rk <= 5) THEN 'ok' ELSE 'bad' END FROM ranked;
`);
if (orderCheck !== 'ok') fail('rank mapping');
ok('mapeo de orden operativo coherente');

console.log(
  JSON.stringify({ ok: true, staging: STAGING, marker: MARKER, assetId }, null, 2)
);
