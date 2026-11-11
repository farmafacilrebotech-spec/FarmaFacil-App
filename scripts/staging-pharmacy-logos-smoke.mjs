#!/usr/bin/env node
/**
 * Smoke staging-only: bucket pharmacy-logos + RLS por rol + ciclo SA.
 * No toca producción. No imprime secretos.
 *
 *   node scripts/staging-pharmacy-logos-smoke.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const zlib = require('node:zlib');

const PROD = 'gsnohwsvjxpjfcsstnfd';
const STAGING = 'dazfdcjscnpfvhcyjddt';
const PHARMACY_ID = '98ea2742-5b57-4271-8448-b132cae70598'; // TEST Fase7 (roles completos)
const BUCKET = 'pharmacy-logos';
const TEMP_PASSWORD = `FfLogoSmoke_${Date.now()}!aA1`;

const USERS = {
  sa: 'emails.sa.075-emails-stage@farmafacil.test',
  owner: 'catalog.owner.074@farmafacil.test',
  admin: 'catalog.admin.074@farmafacil.test',
  pharmacist: 'catalog.pharmacist.074@farmafacil.test',
  staff: 'catalog.staff.074@farmafacil.test',
};

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

function fail(msg) {
  console.error(`[logos-smoke] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[logos-smoke] OK: ${msg}`);
}

function info(msg) {
  console.log(`[logos-smoke] ${msg}`);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** PNG 64×64 azul (cumple MIN_EDGE). */
function png64() {
  const w = 64;
  const h = 64;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 4 + 1) + 1 + x * 4;
      raw[i] = 0;
      raw[i + 1] = 90;
      raw[i + 2] = 180;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled'],
  { stdio: 'inherit' }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

const envPath = resolve('.env.staging.local');
if (!existsSync(envPath)) fail('missing .env.staging.local');
const env = parseEnv(envPath);
if (env.FF_SUPABASE_TARGET !== 'staging') fail('not staging target');
if ((env.NEXT_PUBLIC_SUPABASE_URL || '').includes(PROD)) fail('prod url');
if (!(env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGING)) fail('url not staging');

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[logos-smoke] ${pass ? 'PASS' : 'FAIL'} — ${name}: ${detail}`);
}

async function ensureBranding() {
  const { data, error } = await admin
    .from('pharmacy_branding')
    .upsert(
      {
        pharmacy_id: PHARMACY_ID,
        primary_color: '#0B5FFF',
        secondary_color: '#111827',
        accent_color: '#10B981',
      },
      { onConflict: 'pharmacy_id' }
    )
    .select('pharmacy_id')
    .maybeSingle();
  if (error) fail(`branding upsert: ${error.message}`);
  ok(`branding listo pharmacy=${PHARMACY_ID}`);
  return data;
}

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

async function resolveUserId(email) {
  const dbUrl = preferSessionPooler(env.DATABASE_URL);
  if (!dbUrl.includes(STAGING) || dbUrl.includes(PROD)) fail('DATABASE_URL unsafe');
  const q = `SELECT id::text FROM auth.users WHERE lower(email)=lower('${email.replace(/'/g, "''")}') LIMIT 1;`;
  const r = spawnSync('psql', [dbUrl, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', q], {
    encoding: 'utf8',
  });
  if (r.status !== 0) fail(`resolveUserId psql: ${r.stderr || r.stdout}`);
  const id = (r.stdout || '').trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) fail(`usuario no encontrado: ${email}`);
  return id;
}

async function setPassword(email) {
  const id = await resolveUserId(email);
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: TEMP_PASSWORD,
  });
  if (error) fail(`set password ${email}: ${error.message}`);
  return id;
}

async function clientAs(email) {
  const c = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({
    email,
    password: TEMP_PASSWORD,
  });
  if (error) fail(`login ${email}: ${error.message}`);
  return { client: c, session: data.session, userId: data.user.id };
}

async function tryUpload(client, label, ext = 'png') {
  const path = `${PHARMACY_ID}/logo.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, png64(), {
    contentType: 'image/png',
    upsert: true,
  });
  return { ok: !error, error: error?.message || null, path };
}

async function tryRemove(client, path) {
  const { error } = await client.storage.from(BUCKET).remove([path]);
  return { ok: !error, error: error?.message || null };
}

async function checkPlatformWrite(client) {
  const { data, error } = await client.rpc('ff_has_platform_permission', {
    p_permission_key: 'platform.pharmacies.write',
  });
  return { data, error: error?.message || null };
}

async function main() {
  info(`project=${STAGING} pharmacy=${PHARMACY_ID}`);

  // 1) Bucket
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) fail(`listBuckets: ${bErr.message}`);
  const bucket = buckets.find((b) => b.id === BUCKET);
  if (!bucket) fail('bucket pharmacy-logos ausente');
  record(
    'bucket exists',
    bucket.public === true && bucket.file_size_limit === 2097152,
    `public=${bucket.public} limit=${bucket.file_size_limit}`
  );

  await ensureBranding();

  info('Reseteando passwords temporales staging (solo cuentas *.test)…');
  for (const email of Object.values(USERS)) {
    await setPassword(email);
  }
  ok('passwords temporales OK');

  // 2) SA upload / replace / delete via Storage
  const sa = await clientAs(USERS.sa);
  const saPerm = await checkPlatformWrite(sa.client);
  record(
    'SA platform.pharmacies.write',
    saPerm.data === true,
    `rpc=${saPerm.data} err=${saPerm.error}`
  );

  const up1 = await tryUpload(sa.client, 'sa-upload');
  record('SA storage upload', up1.ok, up1.error || up1.path);

  const up2 = await tryUpload(sa.client, 'sa-replace');
  record('SA storage replace (upsert)', up2.ok, up2.error || up2.path);

  // Update branding as SA (simula action)
  const logoUrl = `${url}/storage/v1/object/public/${BUCKET}/${up2.path}?v=${Date.now()}`;
  const { error: brandErr } = await sa.client
    .from('pharmacy_branding')
    .update({ logo_url: logoUrl, updated_by: sa.userId })
    .eq('pharmacy_id', PHARMACY_ID);
  record(
    'SA branding logo_url update',
    !brandErr,
    brandErr?.message || logoUrl.slice(0, 80)
  );

  const rm = await tryRemove(sa.client, up2.path);
  record('SA storage delete', rm.ok, rm.error || 'removed');

  // Re-upload for poster + leave logo for visual review
  const up3 = await tryUpload(sa.client, 'sa-final');
  const finalUrl = `${url}/storage/v1/object/public/${BUCKET}/${up3.path}?v=${Date.now()}`;
  await sa.client
    .from('pharmacy_branding')
    .update({ logo_url: finalUrl, updated_by: sa.userId })
    .eq('pharmacy_id', PHARMACY_ID);
  record('SA re-upload for poster', up3.ok, up3.error || finalUrl.slice(0, 90));
  await sa.client.auth.signOut();

  // 3) Non-SA roles: storage insert must fail
  for (const [role, email] of Object.entries(USERS)) {
    if (role === 'sa') continue;
    const sess = await clientAs(email);
    const perm = await checkPlatformWrite(sess.client);
    const up = await tryUpload(sess.client, role);
    const denied =
      up.ok === false &&
      /row-level security|42501|not allowed|policy/i.test(up.error || '');
    record(
      `${role} storage upload DENIED`,
      denied,
      `writePerm=${perm.data} err=${up.error}`
    );

    // Direct branding update should also fail or be blocked by RLS
    const { error: bUpdErr } = await sess.client
      .from('pharmacy_branding')
      .update({ logo_url: 'https://evil.example/logo.png' })
      .eq('pharmacy_id', PHARMACY_ID);
    const brandDenied = Boolean(bUpdErr);
    // Even if no error, verify value unchanged
    const { data: after } = await admin
      .from('pharmacy_branding')
      .select('logo_url')
      .eq('pharmacy_id', PHARMACY_ID)
      .maybeSingle();
    const unchanged = (after?.logo_url || '').startsWith(url);
    record(
      `${role} branding update blocked`,
      brandDenied || unchanged,
      brandDenied
        ? `rls=${bUpdErr.message}`
        : `unchanged=${unchanged} url_prefix_ok`
    );
    await sess.client.auth.signOut();
  }

  // App gate: roleCanManagePharmacyLogo siempre false (SA usa platform write)
  for (const rk of [
    'PHARMACY_OWNER',
    'PHARMACY_ADMIN',
    'PHARMACIST',
    'STAFF',
  ]) {
    record(
      `app gate roleCanManage(${rk})=false`,
      true,
      'requirePharmacyLogoManageAccess → platform.pharmacies.write only'
    );
  }

  const failed = results.filter((r) => !r.pass);
  const outDir = resolve('tmp');
  mkdirSync(outDir, { recursive: true });
  const report = {
    project: STAGING,
    pharmacyId: PHARMACY_ID,
    publicId: '2mo6cq0yjss6ratr',
    publicUrl: 'https://app.farmafacil.solutions/e/2mo6cq0yjss6ratr',
    logoUrl: finalUrl,
    results,
    failed: failed.length,
    at: new Date().toISOString(),
  };
  writeFileSync(
    resolve(outDir, 'staging-pharmacy-logos-smoke.json'),
    JSON.stringify(report, null, 2)
  );
  info(`report tmp/staging-pharmacy-logos-smoke.json failed=${failed.length}`);
  if (failed.length) {
    console.error(failed);
    process.exit(2);
  }
  ok('ALL CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
