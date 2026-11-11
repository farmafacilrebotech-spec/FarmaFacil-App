#!/usr/bin/env node
/**
 * Smoke identidad RLS (staging). Ejecutar SOLO tras aplicar
 * docs/migrations/staging_pharmacy_identity_rls_v1.sql con autorización.
 *
 *   node scripts/staging-pharmacy-identity-rls-smoke.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const STAGING = 'dazfdcjscnpfvhcyjddt';
const PROD = 'gsnohwsvjxpjfcsstnfd';
const PHARMACY_ID = '98ea2742-5b57-4271-8448-b132cae70598';
const TEMP_PASSWORD = `FfIdSmoke_${Date.now()}!aA1`;

const USERS = {
  sa: 'emails.sa.075-emails-stage@farmafacil.test',
  owner: 'catalog.owner.074@farmafacil.test',
  admin: 'catalog.admin.074@farmafacil.test',
  pharmacist: 'catalog.pharmacist.074@farmafacil.test',
  staff: 'catalog.staff.074@farmafacil.test',
};

function fail(m) {
  console.error(`[identity-smoke] FAIL: ${m}`);
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

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled'],
  { stdio: 'inherit' }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

const env = parseEnv(resolve('.env.staging.local'));
if (!(env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGING)) fail('not staging');
if ((env.NEXT_PUBLIC_SUPABASE_URL || '').includes(PROD)) fail('prod');

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = preferSession(env.DATABASE_URL);
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[identity-smoke] ${pass ? 'PASS' : 'FAIL'} — ${name}: ${detail}`);
}

function uid(email) {
  const r = spawnSync(
    'psql',
    [
      dbUrl,
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `SELECT id::text FROM auth.users WHERE lower(email)=lower('${email.replace(/'/g, "''")}')`,
    ],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) fail(`uid ${email}: ${r.stderr}`);
  return r.stdout.trim();
}

async function asUser(email) {
  const id = uid(email);
  await admin.auth.admin.updateUserById(id, { password: TEMP_PASSWORD });
  const c = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: TEMP_PASSWORD,
  });
  if (error) fail(`login ${email}: ${error.message}`);
  return c;
}

async function main() {
  // Preconditions: triggers + policy present
  const pre = spawnSync(
    'psql',
    [
      dbUrl,
      '-t',
      '-A',
      '-c',
      `SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('trg_pharmacy_branding_identity','trg_pharmacy_settings_identity');
SELECT pg_get_expr(polqual, polrelid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='pharmacies' AND polname='pharmacies_update';`,
    ],
    { encoding: 'utf8' }
  );
  const preLines = (pre.stdout || '').trim().split(/\n/).filter(Boolean);
  const triggerCount = Number(preLines[0] || 0);
  const pol = preLines.slice(1).join(' ');
  if (triggerCount < 2 || !pol.includes("platform.pharmacies.write") || pol.includes('settings.update')) {
    fail(
      `SQL identity v1 no aplicado aún (triggers=${triggerCount}, policy tiene settings.update=${pol.includes('settings.update')}). Autoriza staging_pharmacy_identity_rls_v1.sql primero.`
    );
  }
  record('precondition triggers+policy', true, `triggers=${triggerCount}`);

  const { data: beforePh } = await admin
    .from('pharmacies')
    .select('name,cif,address_line')
    .eq('id', PHARMACY_ID)
    .single();
  const { data: beforeBr } = await admin
    .from('pharmacy_branding')
    .select('logo_url,primary_color')
    .eq('pharmacy_id', PHARMACY_ID)
    .single();
  const { data: beforeSt } = await admin
    .from('pharmacy_settings')
    .select('visible_name,schedule')
    .eq('pharmacy_id', PHARMACY_ID)
    .maybeSingle();

  // Ensure settings row
  if (!beforeSt) {
    await admin.from('pharmacy_settings').upsert({
      pharmacy_id: PHARMACY_ID,
      timezone: 'Europe/Madrid',
    });
  }

  for (const [role, email] of Object.entries(USERS)) {
    const c = await asUser(email);
    const expectAllow = role === 'sa';

    const nameTry = await c
      .from('pharmacies')
      .update({ name: `HACK-${role}` })
      .eq('id', PHARMACY_ID)
      .select('id');
    const nameChanged =
      (
        await admin
          .from('pharmacies')
          .select('name')
          .eq('id', PHARMACY_ID)
          .single()
      ).data.name !== beforePh.name;
    if (nameChanged) {
      await admin
        .from('pharmacies')
        .update({ name: beforePh.name })
        .eq('id', PHARMACY_ID);
    }
    record(
      `${role} pharmacies.name`,
      expectAllow ? nameChanged : !nameChanged,
      `err=${nameTry.error?.message || null} changed=${nameChanged}`
    );

    const logoTry = await c
      .from('pharmacy_branding')
      .update({ logo_url: `https://evil.example/${role}` })
      .eq('pharmacy_id', PHARMACY_ID)
      .select('pharmacy_id');
    const logoAfter = (
      await admin
        .from('pharmacy_branding')
        .select('logo_url')
        .eq('pharmacy_id', PHARMACY_ID)
        .single()
    ).data.logo_url;
    const logoChanged = logoAfter !== beforeBr.logo_url;
    if (logoChanged) {
      await admin
        .from('pharmacy_branding')
        .update({ logo_url: beforeBr.logo_url })
        .eq('pharmacy_id', PHARMACY_ID);
    }
    record(
      `${role} branding.logo_url`,
      expectAllow ? logoChanged || Boolean(logoTry.error) === false && logoChanged : !logoChanged,
      `err=${logoTry.error?.message || null} changed=${logoChanged}`
    );

    const visTry = await c
      .from('pharmacy_settings')
      .update({ visible_name: `HACK-VIS-${role}` })
      .eq('pharmacy_id', PHARMACY_ID)
      .select('pharmacy_id');
    const visAfter = (
      await admin
        .from('pharmacy_settings')
        .select('visible_name')
        .eq('pharmacy_id', PHARMACY_ID)
        .single()
    ).data.visible_name;
    const visChanged = visAfter !== (beforeSt?.visible_name ?? null);
    if (visChanged) {
      await admin
        .from('pharmacy_settings')
        .update({ visible_name: beforeSt?.visible_name ?? null })
        .eq('pharmacy_id', PHARMACY_ID);
    }
    record(
      `${role} settings.visible_name`,
      expectAllow ? visChanged : !visChanged,
      `err=${visTry.error?.message || null} changed=${visChanged}`
    );

    await c.auth.signOut();
  }

  // Operational: owner schedule + branding color
  const owner = await asUser(USERS.owner);
  const schedMarker = `smoke-${Date.now()}`;
  const { error: schedErr } = await owner
    .from('pharmacy_settings')
    .update({ schedule: schedMarker })
    .eq('pharmacy_id', PHARMACY_ID);
  const schedOk = (
    await admin
      .from('pharmacy_settings')
      .select('schedule')
      .eq('pharmacy_id', PHARMACY_ID)
      .single()
  ).data.schedule === schedMarker;
  record('owner settings.schedule (ops)', schedOk && !schedErr, schedErr?.message || 'ok');
  await admin
    .from('pharmacy_settings')
    .update({ schedule: beforeSt?.schedule ?? null })
    .eq('pharmacy_id', PHARMACY_ID);

  const colorMarker = '#112233';
  const { error: colorErr } = await owner
    .from('pharmacy_branding')
    .update({ primary_color: colorMarker })
    .eq('pharmacy_id', PHARMACY_ID);
  const colorOk = (
    await admin
      .from('pharmacy_branding')
      .select('primary_color')
      .eq('pharmacy_id', PHARMACY_ID)
      .single()
  ).data.primary_color === colorMarker;
  record('owner branding.primary_color (ops)', colorOk && !colorErr, colorErr?.message || 'ok');
  await admin
    .from('pharmacy_branding')
    .update({ primary_color: beforeBr.primary_color })
    .eq('pharmacy_id', PHARMACY_ID);
  await owner.auth.signOut();

  // Ops tables policies untouched (spot-check names still exist)
  const spot = spawnSync(
    'psql',
    [
      dbUrl,
      '-t',
      '-A',
      '-c',
      `SELECT COUNT(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('pharmacy_assistant_settings') AND polname LIKE '%update%';`,
    ],
    { encoding: 'utf8' }
  );
  record(
    'assistant_settings update policy intact',
    Number((spot.stdout || '').trim()) >= 1,
    `count=${(spot.stdout || '').trim()}`
  );

  mkdirSync('tmp', { recursive: true });
  const failed = results.filter((r) => !r.pass);
  writeFileSync(
    'tmp/staging-pharmacy-identity-rls-smoke.json',
    JSON.stringify({ at: new Date().toISOString(), failed: failed.length, results }, null, 2)
  );
  if (failed.length) {
    console.error(failed);
    process.exit(2);
  }
  console.log('[identity-smoke] ALL PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
