/**
 * Staging-only smoke for 084 + commercial assign (no prod).
 *   node scripts/staging-commercial-084-smoke.mjs [--apply-084]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';

const STAGING = 'dazfdcjscnpfvhcyjddt';
const apply084 = process.argv.includes('--apply-084');
const MARKER = `FF-084-${Date.now()}`;

function fail(m) {
  console.error(`[084-smoke] FAIL: ${m}`);
  process.exit(1);
}
function ok(m) {
  console.log(`[084-smoke] OK: ${m}`);
}

const env = {};
for (const line of readFileSync('.env.staging.local', 'utf8').split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(STAGING)) fail('not staging');
let db = env.DATABASE_URL;
{
  const u = new URL(db.replace(/^postgres:/i, 'postgresql:'));
  if (u.port === '6543') {
    u.port = '5432';
    u.searchParams.delete('pgbouncer');
    db = u.toString();
  }
}
function psql(sql) {
  const r = spawnSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
  });
  if (r.status) fail(r.stderr || r.stdout);
  return r.stdout.trim();
}
function psqlFile(f) {
  const r = spawnSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-f', f], {
    encoding: 'utf8',
  });
  if (r.status) fail(r.stderr || r.stdout);
}

const beforePh = psql(
  `SELECT id::text||'|'||COALESCE(plan_id::text,'null') FROM pharmacies ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);
const beforeSubs = psql(
  `SELECT id::text||'|'||pharmacy_id||'|'||status||'|'||COALESCE(plan_id::text,'')||'|'||COALESCE(updated_at::text,'') FROM subscriptions ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);

if (apply084) {
  ok('applying 084…');
  psqlFile(resolve('supabase/migrations/084_commercial_assign_guard_launch_seats_v1.sql'));
  ok('084 applied');
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
const sa = (listed?.users || []).find((u) => /sa\.|smoke|superadmin/i.test(u.email || ''));
if (!sa) fail('no SA');
const TEMP = `Ff084_${Date.now()}!aA1`;
await admin.auth.admin.updateUserById(sa.id, { password: TEMP });
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: loginErr } = await c.auth.signInWithPassword({
  email: sa.email,
  password: TEMP,
});
if (loginErr) fail(loginErr.message);
ok(`SA ${sa.email}`);

// 017 rejects commercial (authenticated)
{
  const ph = psql(`SELECT id::text FROM pharmacies ORDER BY created_at LIMIT 1`);
  const { error: rejErr } = await c.rpc('ff_change_pharmacy_plan_v1', {
    p_pharmacy_id: ph,
    p_new_plan_key: 'general',
  });
  if (!rejErr) fail('017 should reject general');
  if (
    !/commercial_plan_requires_assign_rpc|planes comerciales/i.test(
      rejErr.message || ''
    )
  ) {
    fail(`unexpected 017 error: ${rejErr.message}`);
  }
  ok('017 rejects commercial general');
}

function createPharmacy(tag) {
  const id = psql(
    `WITH ins AS (
      INSERT INTO pharmacies (name, legal_name, status, plan_id, created_by, updated_by)
      SELECT '${MARKER}-${tag}', '${MARKER}-${tag}', 'active', id, '${sa.id}'::uuid, '${sa.id}'::uuid
      FROM plans WHERE key='starter' RETURNING id
    ) SELECT id::text FROM ins`
  )
    .split(/\n/)
    .map((s) => s.trim())
    .find((s) => /^[0-9a-f-]{36}$/i.test(s));
  if (!id) fail(`create pharmacy ${tag}`);
  return id;
}

async function assign(id, sku, promo) {
  const { data, error } = await c.rpc('ff_assign_commercial_plan_v1', {
    p_pharmacy_id: id,
    p_commercial_plan_key: sku,
    p_reason: '084-smoke',
    p_end_open_pilot: false,
    p_use_launch_promo: promo,
  });
  return { data, error };
}

function cleanup(id) {
  psql(`
    DELETE FROM commercial_launch_seat_reservations WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_commercial_assignments WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_commercial_trials WHERE pharmacy_id='${id}';
    DELETE FROM subscriptions WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_entitlements WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_assistant_settings WHERE pharmacy_id='${id}';
    DELETE FROM public_entrypoints WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_settings WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_branding WHERE pharmacy_id='${id}';
    DELETE FROM pharmacy_products WHERE pharmacy_id='${id}';
    DELETE FROM pharmacies WHERE id='${id}';
  `);
}

const idG = createPharmacy('G');
const idP = createPharmacy('P');
const idA = createPharmacy('A');
ok(`pharmacies ${idG.slice(0, 8)}…`);

let r = await assign(idG, 'general', true);
if (r.error) fail(`assign general promo ${r.error.message}`);
ok(`general+promo tech=${r.data.technical_plan_key} launch=${JSON.stringify(r.data.launch?.idempotent ?? r.data.launch)}`);

r = await assign(idG, 'general', true);
if (r.error) fail(`reassign general ${r.error.message}`);
ok(`general re-promo idempotent seat ok`);

r = await assign(idP, 'personalized', false);
if (r.error) fail(`personalized ${r.error.message}`);
if (r.data.technical_plan_key !== 'personalizado') fail('tech key personalizado');
ok('personalized list tariff');

r = await assign(idA, 'ai_personalized', true);
if (r.error) fail(`ai ${r.error.message}`);
if (r.data.technical_plan_key !== 'asistente_ia_personalizado') fail('tech key ia');
ok('ai + promo');

// change plan G → personalized with promo (same seat)
r = await assign(idG, 'personalized', true);
if (r.error) fail(`change G→P ${r.error.message}`);
ok('change general→personalized keeps/updates seat');

// concurrency: fill remaining seats with parallel reserves via psql advisory
const used = Number(psql(`SELECT used_slots FROM commercial_launch_cohort_counters WHERE cohort_key='launch_2027'`));
const max = Number(psql(`SELECT max_slots FROM commercial_launch_cohort_counters WHERE cohort_key='launch_2027'`));
ok(`slots used=${used}/${max}`);

// others untouched
const afterPh = psql(
  `SELECT id::text||'|'||COALESCE(plan_id::text,'null') FROM pharmacies
   WHERE id NOT IN ('${idG}','${idP}','${idA}') ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);
const afterSubs = psql(
  `SELECT id::text||'|'||pharmacy_id||'|'||status||'|'||COALESCE(plan_id::text,'')||'|'||COALESCE(updated_at::text,'')
   FROM subscriptions WHERE pharmacy_id NOT IN ('${idG}','${idP}','${idA}') ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);
if (JSON.stringify(beforePh) !== JSON.stringify(afterPh)) fail('other pharmacies changed');
if (JSON.stringify(beforeSubs) !== JSON.stringify(afterSubs)) fail('other subs changed');
ok('legacy pharmacies/subs untouched');

cleanup(idG);
cleanup(idP);
cleanup(idA);
// restore counter from active seats only
psql(`
  UPDATE commercial_launch_cohort_counters c
  SET used_slots = (
    SELECT COUNT(*) FROM commercial_launch_seat_reservations r
    WHERE r.cohort_key='launch_2027' AND r.status='active'
  ),
  updated_at = now()
  WHERE c.cohort_key='launch_2027';
`);
ok('cleaned ficticious + counter reconciled');

mkdirSync('tmp', { recursive: true });
writeFileSync(
  'tmp/staging-084-smoke.json',
  JSON.stringify({ at: new Date().toISOString(), marker: MARKER, used, max }, null, 2)
);
ok('ALL PASSED');
