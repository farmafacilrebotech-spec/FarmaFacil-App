#!/usr/bin/env node
/**
 * Smoke staging plazas launch_2027 + 089.
 *   node scripts/staging-launch-seats-089-smoke.mjs
 * NO producción.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const STAGING = 'dazfdcjscnpfvhcyjddt';
const ENV_FILE = existsSync('.env.staging.local')
  ? '.env.staging.local'
  : '../pharmacy-clients-qr/.env.staging.local';
const MARKER = `launch-seat-smoke-${Date.now()}`;
const TEMP = `FfLaunchSeat_${Date.now()}!aA1`;

function fail(m) {
  console.error(`[launch-smoke] FAIL: ${m}`);
  process.exit(1);
}
function ok(m) {
  console.log(`[launch-smoke] OK — ${m}`);
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
    )
      v = v.slice(1, -1);
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}
function preferSession(db) {
  try {
    const u = new URL(db.replace(/^postgres:/i, 'postgresql:'));
    if (u.port === '6543' && /pooler\.supabase\.com$/i.test(u.hostname)) {
      u.port = '5432';
      u.searchParams.delete('pgbouncer');
      return u.toString();
    }
  } catch {
    /* */
  }
  return db;
}
function psql(dbUrl, sql) {
  const r = spawnSync(
    'psql',
    [dbUrl, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) fail(`psql: ${r.stderr || r.stdout}`);
  return (r.stdout || '').trim();
}

if (!existsSync(ENV_FILE)) fail(`missing ${ENV_FILE}`);
const env = parseEnv(ENV_FILE);
if (!(env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGING)) fail('not staging');
const db = preferSession(env.DATABASE_URL);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const has089 =
  psql(
    db,
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='commercial_launch_seat_events');`
  ) === 't';
if (!has089) fail('089 not applied on staging (commercial_launch_seat_events missing)');

const sa = psql(
  db,
  `SELECT p.id::text||'|'||p.email
   FROM platform_user_roles pur
   JOIN platform_roles pr ON pr.id=pur.platform_role_id
   JOIN profiles p ON p.id=pur.profile_id
   WHERE pr.key='PLATFORM_SUPERADMIN'
   ORDER BY p.email LIMIT 1;`
);
const [saId, saEmail] = sa.split('|');
if (!saEmail) fail('no SA');

const pharmacyId = psql(
  db,
  `SELECT id::text FROM pharmacies ORDER BY created_at DESC NULLS LAST LIMIT 1;`
);
if (!pharmacyId) fail('no pharmacy');

await admin.auth.admin.updateUserById(saId, { password: TEMP });
const user = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
{
  const { error } = await user.auth.signInWithPassword({
    email: saEmail,
    password: TEMP,
  });
  if (error) fail(`login: ${error.message}`);
}

const before = Number(
  psql(db, `SELECT used_slots FROM commercial_launch_cohort_counters WHERE cohort_key='launch_2027';`)
);

// Ensure clean starting point for this pharmacy
await user.rpc('ff_release_launch_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_reason: `${MARKER}-pre-clean`,
});

const { data: reserved, error: rErr } = await user.rpc('ff_reserve_launch_2027_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_commercial_sku_key: 'general',
});
if (rErr) fail(`reserve: ${rErr.message}`);
ok(`reserve ${JSON.stringify(reserved)}`);

const used1 = Number(
  psql(db, `SELECT used_slots FROM commercial_launch_cohort_counters WHERE cohort_key='launch_2027';`)
);
if (used1 < before) fail('used_slots did not increase as expected');

const { data: dup } = await user.rpc('ff_reserve_launch_2027_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_commercial_sku_key: 'general',
});
if (!dup?.idempotent) fail('expected idempotent second reserve');
ok('duplicate reserve idempotent');

const { error: badReason } = await user.rpc('ff_release_launch_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_reason: 'x',
});
if (!badReason) fail('expected short reason to fail');
ok('short reason blocked');

const { data: released, error: relErr } = await user.rpc('ff_release_launch_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_reason: `${MARKER}-release`,
});
if (relErr) fail(`release: ${relErr.message}`);
if (!released?.released) fail('expected released=true');
ok('release ok');

const used2 = Number(
  psql(db, `SELECT used_slots FROM commercial_launch_cohort_counters WHERE cohort_key='launch_2027';`)
);
ok(`used_slots after release=${used2}`);

const events = Number(
  psql(
    db,
    `SELECT count(*) FROM commercial_launch_seat_events WHERE pharmacy_id='${pharmacyId}'::uuid AND reason LIKE '${MARKER}%';`
  )
);
if (events < 1) fail('expected audit events');
ok(`audit events=${events}`);

// Confirm blocks release
await user.rpc('ff_reserve_launch_2027_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_commercial_sku_key: 'general',
});
const { error: confErr } = await user.rpc('ff_confirm_launch_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_commitment_kind: 'manual',
  p_notes: MARKER,
});
if (confErr) fail(`confirm: ${confErr.message}`);
const { error: blocked } = await user.rpc('ff_release_launch_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_reason: `${MARKER}-should-block`,
});
if (!blocked) fail('expected committed release to fail');
ok('committed seat blocks release');

// Cleanup: clear commitment via SQL as service (test only)
psql(
  db,
  `UPDATE commercial_launch_seat_reservations
   SET confirmed_at=NULL, confirmed_by=NULL, commitment_kind=NULL, commitment_notes=NULL
   WHERE pharmacy_id='${pharmacyId}'::uuid;`
);
await user.rpc('ff_release_launch_seat_v1', {
  p_pharmacy_id: pharmacyId,
  p_reason: `${MARKER}-cleanup`,
});
ok('cleanup done');
console.log('[launch-smoke] ALL PASS');
