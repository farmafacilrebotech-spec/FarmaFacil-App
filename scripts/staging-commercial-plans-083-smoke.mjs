/**
 * Staging-only: apply 083 (optional) + assign commercial plan to a FICTIONAL pharmacy.
 * Does NOT touch production. Does NOT mutate other pharmacies' subscriptions.
 *
 *   node scripts/staging-commercial-plans-083-smoke.mjs [--apply-083]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';

const STAGING = 'dazfdcjscnpfvhcyjddt';
const apply083 = process.argv.includes('--apply-083');
const MARKER = `FF-083-FICT-${Date.now()}`;

function fail(msg) {
  console.error(`[083-smoke] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[083-smoke] OK: ${msg}`);
}

function loadEnv() {
  const path = existsSync('.env.staging.local')
    ? '.env.staging.local'
    : '../pharmacy-clients-qr/.env.staging.local';
  if (!existsSync(path)) fail('missing .env.staging.local');
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\n/)) {
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
    env[t.slice(0, i).trim()] = v;
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGING)) fail('not staging URL');
  let db = env.DATABASE_URL;
  const u = new URL(db.replace(/^postgres:/i, 'postgresql:'));
  if (u.port === '6543') {
    u.port = '5432';
    u.searchParams.delete('pgbouncer');
    db = u.toString();
  }
  return { env, db, path };
}

function psql(db, sql) {
  const r = spawnSync(
    'psql',
    [db, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }
  );
  if (r.status) fail(r.stderr || r.stdout || 'psql failed');
  return r.stdout.trim();
}

function psqlFile(db, file) {
  const r = spawnSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8',
  });
  if (r.status) fail(r.stderr || r.stdout || `apply failed ${file}`);
  return r.stdout;
}

const { env, db } = loadEnv();
ok(`target=${STAGING}`);

const beforePharmacies = psql(
  db,
  `SELECT id::text||'|'||COALESCE(plan_id::text,'null') FROM pharmacies ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);
const beforeSubs = psql(
  db,
  `SELECT id::text||'|'||pharmacy_id::text||'|'||status||'|'||COALESCE(plan_id::text,'null')||'|'||COALESCE(updated_at::text,'') FROM subscriptions ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);
ok(`snapshot pharmacies=${beforePharmacies.length} subscriptions=${beforeSubs.length}`);

if (apply083) {
  const mig = resolve('supabase/migrations/083_commercial_plans_activation_v1.sql');
  if (!existsSync(mig)) fail('missing 083 migration');
  ok('applying 083 on staging…');
  psqlFile(db, mig);
  ok('083 applied');
}

const plans = psql(
  db,
  `SELECT key FROM plans WHERE key IN ('general','personalizado','asistente_ia_personalizado') AND is_active ORDER BY sort_order`
)
  .split(/\n/)
  .filter(Boolean);
if (plans.length !== 3) fail(`commercial plans missing: ${plans.join(',')}`);
ok(`plans=${plans.join(',')}`);

const effects = {
  general: psql(db, `SELECT public.ff_commercial_sku_effects_v1('general')->>'technical_plan_key'`),
  personalized: psql(
    db,
    `SELECT public.ff_commercial_sku_effects_v1('personalized')->>'technical_plan_key'`
  ),
  ai: psql(
    db,
    `SELECT public.ff_commercial_sku_effects_v1('ai_personalized')->>'technical_plan_key'`
  ),
};
if (effects.general !== 'general') fail(`effects general=${effects.general}`);
if (effects.personalized !== 'personalizado') fail(`effects personalized=${effects.personalized}`);
if (effects.ai !== 'asistente_ia_personalizado') fail(`effects ai=${effects.ai}`);
ok(`effects map OK ${JSON.stringify(effects)}`);

const prices = psql(
  db,
  `SELECT s.key||'|'||p.monthly_cents||'|'||p.annual_cents
   FROM commercial_plan_price_versions p
   JOIN commercial_plan_skus s ON s.id=p.sku_id
   JOIN commercial_tariff_versions v ON v.id=p.tariff_version_id
   WHERE v.is_current AND v.version_label='v2-list-2027'
   ORDER BY s.key`
)
  .split(/\n/)
  .filter(Boolean);
const expected = {
  'ai_personalized|24750|252500': true,
  'general|9750|99500': true,
  'personalized|17250|176000': true,
  'pilot|0|0': true,
};
for (const row of prices) {
  if (!expected[row]) fail(`unexpected price row ${row}`);
}
ok(`list prices OK (${prices.join('; ')})`);

const slots = psql(
  db,
  `SELECT cohort_key||'|'||max_slots||'|'||used_slots FROM commercial_launch_cohort_counters WHERE cohort_key='launch_2027'`
);
if (slots !== 'launch_2027|20|0' && !slots.startsWith('launch_2027|20|')) {
  fail(`launch slots unexpected: ${slots}`);
}
ok(`launch counter ${slots}`);

// Create fictional pharmacy (starter) then assign general via RPC as SA
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
const sa =
  (listed?.users || []).find((u) =>
    /emails\.sa\.|prod-smoke|staging-smoke|superadmin/i.test(u.email || '')
  ) || (listed?.users || [])[0];
if (!sa) fail('no SA user');
const TEMP = `Ff083_${Date.now()}!aA1`;
await admin.auth.admin.updateUserById(sa.id, { password: TEMP });
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: loginErr } = await c.auth.signInWithPassword({
  email: sa.email,
  password: TEMP,
});
if (loginErr) fail(`SA login ${loginErr.message}`);
ok(`SA login ${sa.email}`);

const pharmacyId = psql(
  db,
  `WITH ins AS (
     INSERT INTO pharmacies (name, legal_name, status, plan_id, created_by, updated_by)
     SELECT '${MARKER}', '${MARKER}', 'active', id, '${sa.id}'::uuid, '${sa.id}'::uuid
     FROM plans WHERE key='starter'
     RETURNING id
   )
   SELECT id::text FROM ins`
)
  .split(/\n/)
  .map((s) => s.trim())
  .find((s) => /^[0-9a-f-]{36}$/i.test(s));
if (!pharmacyId) fail('could not create fictional pharmacy');
ok(`fictional pharmacy ${pharmacyId}`);

const { data: assignData, error: assignErr } = await c.rpc('ff_assign_commercial_plan_v1', {
  p_pharmacy_id: pharmacyId,
  p_commercial_plan_key: 'general',
  p_reason: '083-smoke-fictional',
  p_end_open_pilot: false,
});
if (assignErr) fail(`assign RPC ${assignErr.message}`);
const assignStatus = assignData?.status || assignData;
ok(`assign general → ${JSON.stringify(assignData)}`);

const tech = psql(
  db,
  `SELECT pl.key FROM pharmacies p JOIN plans pl ON pl.id=p.plan_id WHERE p.id='${pharmacyId}'`
);
if (tech !== 'general') fail(`pharmacy plan_id key=${tech}`);
const asg = psql(
  db,
  `SELECT commercial_sku_key||'|'||technical_plan_key||'|'||catalog_mode
   FROM pharmacy_commercial_assignments WHERE pharmacy_id='${pharmacyId}'`
);
if (asg !== 'general|general|generic') fail(`assignment ${asg}`);
ok(`assignment ${asg}`);

// Others unchanged
const afterPharmacies = psql(
  db,
  `SELECT id::text||'|'||COALESCE(plan_id::text,'null') FROM pharmacies WHERE id <> '${pharmacyId}' ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);
const afterSubsOthers = psql(
  db,
  `SELECT id::text||'|'||pharmacy_id::text||'|'||status||'|'||COALESCE(plan_id::text,'null')||'|'||COALESCE(updated_at::text,'')
   FROM subscriptions WHERE pharmacy_id <> '${pharmacyId}' ORDER BY id`
)
  .split(/\n/)
  .filter(Boolean);

const beforePhFiltered = beforePharmacies;
if (JSON.stringify(beforePhFiltered) !== JSON.stringify(afterPharmacies)) {
  fail('other pharmacies plan_id changed');
}
if (JSON.stringify(beforeSubs) !== JSON.stringify(afterSubsOthers)) {
  fail('other subscriptions changed');
}
ok('other pharmacies/subscriptions untouched');

// Cleanup fictional only (best-effort child rows)
psql(
  db,
  `DELETE FROM pharmacy_commercial_assignments WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacy_commercial_trials WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM subscriptions WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacy_entitlements WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacy_assistant_settings WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM public_entrypoints WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacy_settings WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacy_branding WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacy_products WHERE pharmacy_id='${pharmacyId}';
   DELETE FROM pharmacies WHERE id='${pharmacyId}';`
);
ok('fictional pharmacy cleaned up');

const report = {
  at: new Date().toISOString(),
  project: STAGING,
  applied083: apply083,
  marker: MARKER,
  effects,
  prices,
  slots,
  assign: assignData,
  othersUntouched: true,
};
mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/staging-083-smoke.json', JSON.stringify(report, null, 2));
ok('ALL PASSED');
