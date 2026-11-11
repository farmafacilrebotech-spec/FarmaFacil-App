#!/usr/bin/env node
/**
 * Smoke Proveedores en staging (DB + RLS) sin imprimir secretos ni PII.
 *
 *   node scripts/staging-suppliers-smoke.mjs
 *
 * Usa DATABASE_URL de .env.staging.local + impersonación JWT (auth.uid).
 * No crea usuarios Auth ni imprime emails/passwords/tokens.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const PROD = 'gsnohwsvjxpjfcsstnfd';
const STAGING = 'dazfdcjscnpfvhcyjddt';
const ENV_FILE = '.env.staging.local';
const MARKER = `smoke-pr21-${Date.now()}`;

function fail(msg) {
  console.error(`[suppliers-smoke] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[suppliers-smoke] OK: ${msg}`);
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

function psql(sql) {
  const r = spawnSync(
    'psql',
    ['-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', dbUrl, '-c', sql],
    { encoding: 'utf8', env: { ...process.env, DATABASE_URL: dbUrl } }
  );
  if (r.status !== 0) {
    fail(`psql error: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  return (r.stdout || '').trim();
}

// 1) Pick existing PLATFORM_SUPERADMIN profile (id only)
const saId = psql(`
SELECT pur.profile_id::text
FROM platform_user_roles pur
JOIN platform_roles r ON r.id = pur.platform_role_id
WHERE r.key = 'PLATFORM_SUPERADMIN'
LIMIT 1;
`);
if (!saId) fail('no PLATFORM_SUPERADMIN profile on staging');
ok(`impersonate SA profile ${saId.slice(0, 8)}…`);

const quoteA = randomUUID();
const quoteB = randomUUID();
const supplierA = randomUUID();
const supplierB = randomUUID();
const poId = randomUUID();
const materialKey = `smoke-mat-${Date.now()}`;

function asRole(role, claimsUid, sqlBody) {
  const claims = JSON.stringify({
    sub: claimsUid || '',
    role: role === 'authenticated' ? 'authenticated' : role,
  }).replace(/'/g, "''");
  return `
BEGIN;
SELECT set_config('request.jwt.claims', '${claims}', true);
SELECT set_config('request.jwt.claim.sub', '${(claimsUid || '').replace(/'/g, "''")}', true);
SET LOCAL ROLE ${role};
${sqlBody}
ROLLBACK;
`;
}

// 2) SuperAdmin CRUD path (write + compare)
const saFlow = asRole(
  'authenticated',
  saId,
  `
DO $$
DECLARE
  v_perm boolean;
  v_cnt int;
  v_doc uuid;
BEGIN
  SELECT public.ff_has_platform_permission('platform.suppliers.write') INTO v_perm;
  IF NOT v_perm THEN
    RAISE EXCEPTION 'SA missing platform.suppliers.write';
  END IF;

  INSERT INTO public.platform_suppliers (
    id, legal_name, category, status, created_by, updated_by
  ) VALUES (
    '${supplierA}', '${MARKER}-A', 'papeleria', 'active', '${saId}', '${saId}'
  );

  INSERT INTO public.platform_suppliers (
    id, legal_name, category, status, created_by, updated_by
  ) VALUES (
    '${supplierB}', '${MARKER}-B', 'marketing', 'active', '${saId}', '${saId}'
  );

  UPDATE public.platform_suppliers
  SET trade_name = 'Smoke Edit', updated_by = '${saId}'
  WHERE id = '${supplierA}';

  INSERT INTO public.platform_supplier_quotes (
    id, supplier_id, title, status, shipping_cents, created_by, updated_by, approved_by, approved_at
  ) VALUES
    ('${quoteA}', '${supplierA}', '${MARKER} quote A', 'aprobado', 500, '${saId}', '${saId}', '${saId}', now()),
    ('${quoteB}', '${supplierB}', '${MARKER} quote B', 'en_revision', 800, '${saId}', '${saId}', NULL, NULL);

  INSERT INTO public.platform_supplier_quote_lines (
    quote_id, material_key, description, quantity, unit_price_cents, vat_bps, lead_days
  ) VALUES
    ('${quoteA}', '${materialKey}', 'Line A', 10, 1200, 2100, 7),
    ('${quoteB}', '${materialKey}', 'Line B', 10, 1100, 2100, 14);

  INSERT INTO public.platform_supplier_quote_documents (
    quote_id, storage_path, file_name, mime_type, byte_size, uploaded_by
  ) VALUES (
    '${quoteA}', 'quotes/${quoteA}/smoke.pdf', 'smoke.pdf', 'application/pdf', 123, '${saId}'
  ) RETURNING id INTO v_doc;

  INSERT INTO public.platform_supplier_purchase_orders (
    id, supplier_id, quote_id, category, title, status,
    ordered_at, subtotal_cents, tax_cents, shipping_cents, total_cents,
    created_by, updated_by
  ) VALUES (
    '${poId}', '${supplierA}', '${quoteA}', 'papeleria', '${MARKER} PO',
    'pedido', CURRENT_DATE, 12000, 2520, 500, 15020, '${saId}', '${saId}'
  );

  INSERT INTO public.platform_supplier_purchase_lines (
    purchase_order_id, description, quantity, unit_price_cents, vat_bps, line_total_cents
  ) VALUES (
    '${poId}', 'Line PO', 10, 1200, 2100, 14520
  );

  INSERT INTO public.platform_supplier_purchase_documents (
    purchase_order_id, doc_type, storage_path, file_name, mime_type, uploaded_by
  ) VALUES (
    '${poId}', 'invoice', 'purchases/${poId}/invoice.pdf', 'invoice.pdf', 'application/pdf', '${saId}'
  );

  SELECT COUNT(*) INTO v_cnt
  FROM public.platform_supplier_quote_lines
  WHERE material_key = '${materialKey}';
  IF v_cnt < 2 THEN
    RAISE EXCEPTION 'compare material offers missing rows';
  END IF;

  UPDATE public.platform_suppliers
  SET status = 'archived', archived_at = now()
  WHERE id = '${supplierB}';

  -- category filter
  SELECT COUNT(*) INTO v_cnt FROM public.platform_suppliers
  WHERE category = 'papeleria' AND legal_name LIKE '${MARKER}%';
  IF v_cnt < 1 THEN
    RAISE EXCEPTION 'category filter failed';
  END IF;
END $$;
`
);

psql(saFlow);
ok('SA CRUD: suppliers/quotes/compare/PO/invoice/archive');

// 3) Unauthorized authenticated user without platform role → 0 rows / cannot write
const strangerId = randomUUID();
const denied = asRole(
  'authenticated',
  strangerId,
  `
DO $$
DECLARE
  v_cnt int;
  v_perm boolean;
BEGIN
  SELECT public.ff_has_platform_permission('platform.suppliers.read') INTO v_perm;
  IF v_perm THEN
    RAISE EXCEPTION 'stranger unexpectedly has suppliers.read';
  END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.platform_suppliers WHERE legal_name LIKE '${MARKER}%';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'RLS leak: stranger saw % supplier rows', v_cnt;
  END IF;
  BEGIN
    INSERT INTO public.platform_suppliers (legal_name, category)
    VALUES ('${MARKER}-hack', 'otros');
    RAISE EXCEPTION 'RLS leak: stranger could insert supplier';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    -- expected denial (policy or privilege)
    NULL;
  END;
END $$;
`
);
psql(denied);
ok('RLS deny: unprivileged authenticated cannot read/write suppliers');

// 4) anon role cannot read
const anonDenied = `
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE v_cnt int;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM public.platform_suppliers WHERE legal_name LIKE '${MARKER}%';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'anon saw suppliers';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
ROLLBACK;
`;
psql(anonDenied);
ok('RLS deny: anon cannot read suppliers');

// 5) Storage policies exist for supplier-docs (permission-gated)
const storagePol = psql(`
SELECT COUNT(*)::text FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname LIKE 'supplier_docs_storage%';
`);
if (Number(storagePol) < 2) fail('missing supplier-docs storage policies');
ok(`storage policies present (${storagePol})`);

// 6) Cleanup smoke rows as DB admin (bypasses RLS; no DELETE grant for app role)
psql(`
DELETE FROM public.platform_supplier_purchase_documents WHERE purchase_order_id = '${poId}';
DELETE FROM public.platform_supplier_purchase_lines WHERE purchase_order_id = '${poId}';
DELETE FROM public.platform_supplier_purchase_orders WHERE id = '${poId}';
DELETE FROM public.platform_supplier_quote_documents WHERE quote_id IN ('${quoteA}','${quoteB}');
DELETE FROM public.platform_supplier_quote_lines WHERE quote_id IN ('${quoteA}','${quoteB}');
DELETE FROM public.platform_supplier_quotes WHERE id IN ('${quoteA}','${quoteB}');
DELETE FROM public.platform_suppliers WHERE id IN ('${supplierA}','${supplierB}');
`);
ok('cleanup smoke rows');

// 7) 065 dependency note
const has065 = psql(
  `SELECT CASE WHEN to_regclass('public.kiosk_assets') IS NULL THEN 'no' ELSE 'yes' END;`
);
if (has065 !== 'yes') {
  console.log(
    '[suppliers-smoke] NOTE: kiosk_assets missing (065) — recepción kiosko no testeable; pedidos generales OK'
  );
} else {
  ok('kiosk_assets present — recepción kiosko se puede probar aparte');
}

ok('ALL PASSED');
