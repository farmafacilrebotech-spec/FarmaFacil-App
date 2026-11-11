#!/usr/bin/env node
/**
 * Smoke staff_hide (staging): STAFF no puede leer customer_profile_id;
 * Owner/Admin/Farmacéutico conservan RPC de clientes; pedidos ops OK.
 *
 *   node scripts/staging-staff-hide-customer-profile-id-smoke.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const STAGING = 'dazfdcjscnpfvhcyjddt';
const PROD = 'gsnohwsvjxpjfcsstnfd';
const PHARMACY_ID = '98ea2742-5b57-4271-8448-b132cae70598';
const OTHER_PHARMACY = '00000000-0000-4000-8000-000000000099';
const TEMP_PASSWORD = `FfStaffHide_${Date.now()}!aA1`;

const USERS = {
  owner: 'catalog.owner.074@farmafacil.test',
  admin: 'catalog.admin.074@farmafacil.test',
  pharmacist: 'catalog.pharmacist.074@farmafacil.test',
  staff: 'catalog.staff.074@farmafacil.test',
};

function fail(m) {
  console.error(`[staff-hide-smoke] FAIL: ${m}`);
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
  console.log(`[staff-hide-smoke] ${pass ? 'PASS' : 'FAIL'} — ${name}: ${detail}`);
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

function errText(error) {
  if (!error) return '';
  return `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
}

async function main() {
  const pre = spawnSync(
    'psql',
    [
      dbUrl,
      '-t',
      '-A',
      '-c',
      `SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN (
         'ff_pharmacy_can_view_linked_clients',
         'ff_list_pharmacy_linked_clients_v1',
         'ff_get_pharmacy_linked_client_v1'
       );
       SELECT has_column_privilege('authenticated','public.pharmacy_orders','customer_profile_id','SELECT')::text;
       SELECT has_table_privilege('authenticated','public.pharmacy_orders','SELECT')::text;`,
    ],
    { encoding: 'utf8' }
  );
  if (pre.status !== 0) fail(`precheck psql: ${pre.stderr}`);
  const lines = (pre.stdout || '').trim().split(/\n/).filter(Boolean);
  const rpcCount = Number(lines[0] || 0);
  const colPriv = lines[1] === 't';
  const tablePriv = lines[2] === 't';
  if (rpcCount < 3) fail(`RPCs staff_hide ausentes (count=${rpcCount})`);
  if (colPriv) fail('authenticated AÚN tiene SELECT customer_profile_id');
  record(
    'precondition RPCs+grants',
    true,
    `rpcs=${rpcCount} col_priv=${colPriv} table_priv=${tablePriv}`
  );

  const staff = await asUser(USERS.staff);
  const owner = await asUser(USERS.owner);
  const adminUser = await asUser(USERS.admin);
  const pharmacist = await asUser(USERS.pharmacist);

  // STAFF: direct PostgREST select of customer_profile_id must fail
  {
    const { data, error } = await staff
      .from('pharmacy_orders')
      .select('customer_profile_id')
      .eq('pharmacy_id', PHARMACY_ID)
      .limit(5);
    const blocked =
      Boolean(error) ||
      (Array.isArray(data) &&
        data.every((r) => !Object.prototype.hasOwnProperty.call(r, 'customer_profile_id')));
    // Prefer hard error (permission denied / column)
    const hard =
      Boolean(error) &&
      /permission|42501|column|customer_profile_id|not accept/i.test(errText(error));
    record(
      'staff PostgREST customer_profile_id',
      hard || (blocked && (!data || data.length === 0 || hard)),
      hard
        ? `blocked err=${error?.message || error?.code}`
        : `data=${JSON.stringify(data)?.slice(0, 120)} err=${error?.message || null}`
    );
    if (!(hard || blocked)) fail('STAFF pudo seleccionar customer_profile_id');
  }

  // STAFF: select * must not expose the column either
  {
    const { data, error } = await staff
      .from('pharmacy_orders')
      .select('*')
      .eq('pharmacy_id', PHARMACY_ID)
      .limit(3);
    const exposed = Array.isArray(data)
      ? data.some((r) =>
          Object.prototype.hasOwnProperty.call(r || {}, 'customer_profile_id')
        )
      : false;
    record(
      'staff PostgREST select * sin customer_profile_id',
      !exposed,
      exposed
        ? 'EXPOSED'
        : `ok rows=${data?.length ?? 0} err=${error?.message || null}`
    );
    if (exposed) fail('STAFF vio customer_profile_id en select *');
  }

  // STAFF: operational order fields still readable
  {
    const { data, error } = await staff
      .from('pharmacy_orders')
      .select('id,customer_name,customer_phone,status')
      .eq('pharmacy_id', PHARMACY_ID)
      .limit(3);
    record(
      'staff pedidos ops (nombre/tel/status)',
      !error,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  // STAFF RPC forbidden
  for (const [label, client] of [
    ['staff', staff],
  ]) {
    const { data, error } = await client.rpc('ff_list_pharmacy_linked_clients_v1', {
      p_pharmacy_id: PHARMACY_ID,
      p_limit: 10,
    });
    const status = data?.status || (error ? 'error' : 'unknown');
    record(
      `${label} RPC list clients`,
      status === 'forbidden',
      `status=${status} err=${error?.message || null}`
    );
  }

  // Owner/Admin/Pharmacist RPC ok or empty ok
  for (const [role, client] of [
    ['owner', owner],
    ['admin', adminUser],
    ['pharmacist', pharmacist],
  ]) {
    const { data, error } = await client.rpc('ff_list_pharmacy_linked_clients_v1', {
      p_pharmacy_id: PHARMACY_ID,
      p_limit: 10,
    });
    const status = data?.status;
    const ok = !error && (status === 'ok' || status === 'forbidden' === false) && status === 'ok';
    // allowed roles must not get forbidden
    const pass = !error && status === 'ok';
    record(
      `${role} RPC list clients`,
      pass,
      `status=${status} count=${data?.clients?.length ?? 0} err=${error?.message || null}`
    );

    // Isolation: other pharmacy → forbidden
    const other = await client.rpc('ff_list_pharmacy_linked_clients_v1', {
      p_pharmacy_id: OTHER_PHARMACY,
      p_limit: 5,
    });
    record(
      `${role} RPC other pharmacy`,
      other.data?.status === 'forbidden',
      `status=${other.data?.status}`
    );
  }

  // Owner still cannot SELECT customer_profile_id via PostgREST (RPC only)
  {
    const { error } = await owner
      .from('pharmacy_orders')
      .select('customer_profile_id')
      .eq('pharmacy_id', PHARMACY_ID)
      .limit(1);
    const hard =
      Boolean(error) &&
      /permission|42501|column|customer_profile_id|not accept/i.test(errText(error));
    record(
      'owner PostgREST customer_profile_id denegado (vía RPC)',
      hard,
      error?.message || 'no error'
    );
  }

  // Customer area: RPC my orders (v1c)
  {
    const preCust = spawnSync(
      'psql',
      [
        dbUrl,
        '-t',
        '-A',
        '-c',
        `SELECT o.customer_profile_id::text||'|'||u.email
         FROM public.pharmacy_orders o
         JOIN auth.users u ON u.id = o.customer_profile_id
         WHERE o.customer_profile_id IS NOT NULL
         LIMIT 1;`,
      ],
      { encoding: 'utf8' }
    );
    const line = (preCust.stdout || '').trim();
    if (!line) {
      record('customer RPC my orders', false, 'no linked customer in staging');
    } else {
      const [pid, email] = line.split('|');
      await admin.auth.admin.updateUserById(pid, { password: TEMP_PASSWORD });
      const cust = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: loginErr } = await cust.auth.signInWithPassword({
        email,
        password: TEMP_PASSWORD,
      });
      if (loginErr) fail(`customer login: ${loginErr.message}`);
      const { data, error } = await cust.rpc('ff_list_my_customer_orders_v1', {
        p_limit: 20,
      });
      const pass = !error && data?.status === 'ok' && Array.isArray(data.orders);
      record(
        'customer RPC my orders',
        pass,
        `status=${data?.status} count=${data?.orders?.length ?? 0} err=${error?.message || null}`
      );
      const leak = await cust
        .from('pharmacy_orders')
        .select('customer_profile_id')
        .limit(1);
      const blocked =
        Boolean(leak.error) &&
        /permission|42501|column|customer_profile_id|not accept/i.test(
          errText(leak.error)
        );
      record(
        'customer PostgREST customer_profile_id denegado',
        blocked,
        leak.error?.message || 'no error'
      );
    }
  }

  const failed = results.filter((r) => !r.pass);
  mkdirSync('tmp', { recursive: true });
  const out = {
    at: new Date().toISOString(),
    failed: failed.length,
    results,
  };
  writeFileSync(
    resolve('tmp/staging-staff-hide-customer-profile-id-smoke.json'),
    JSON.stringify(out, null, 2)
  );
  if (failed.length) {
    console.error(`[staff-hide-smoke] FAILED ${failed.length}`);
    process.exit(1);
  }
  console.log('[staff-hide-smoke] ALL PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
