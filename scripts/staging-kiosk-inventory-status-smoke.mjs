#!/usr/bin/env node
/**
 * Smoke inventario kioskos (081) en staging DEMO.
 * Pedido 10 → pendientes virtuales; recepción 6+4; reintento; estados; sin prod.
 *
 *   node scripts/staging-kiosk-inventory-status-smoke.mjs
 *   node scripts/staging-kiosk-inventory-status-smoke.mjs --apply-081
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const PROD = 'gsnohwsvjxpjfcsstnfd';
const STAGING = 'dazfdcjscnpfvhcyjddt';
const ENV_FILE = '.env.staging.local';
const MARKER = `inv081-demo-${Date.now()}`;
const apply081 = process.argv.includes('--apply-081');

function fail(msg) {
  console.error(`[inv081-smoke] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[inv081-smoke] OK: ${msg}`);
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

if (apply081) {
  const mig = resolve(
    process.cwd(),
    'supabase/migrations/081_kiosk_inventory_ui_statuses_v1.sql'
  );
  if (!existsSync(mig)) fail('missing 081 migration');
  ok('aplicando 081 en staging…');
  psql('', { file: mig });
  ok('081 aplicada');
}

const hasExhibition = psql(`
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'kiosk_assets_status_chk'
    AND pg_get_constraintdef(oid) ILIKE '%exhibition%'
) THEN 'yes' ELSE 'no' END;
`);
if (hasExhibition !== 'yes') fail('CHECK exhibition no presente (aplica 081)');

const hasEvents = psql(`
SELECT CASE WHEN to_regclass('public.kiosk_asset_status_events') IS NOT NULL
  THEN 'yes' ELSE 'no' END;
`);
if (hasEvents !== 'yes') fail('tabla kiosk_asset_status_events ausente');

const saId = psql(`
SELECT pur.profile_id::text
FROM platform_user_roles pur
JOIN platform_roles r ON r.id = pur.platform_role_id
WHERE r.key = 'PLATFORM_SUPERADMIN'
LIMIT 1;
`);
if (!saId) fail('no PLATFORM_SUPERADMIN');

const pharmacyId = psql(`
SELECT id::text FROM pharmacies ORDER BY created_at NULLS LAST LIMIT 1;
`);
if (!pharmacyId) fail('no pharmacy for assign test');

let supplierId = psql(`
SELECT id::text FROM platform_suppliers
WHERE tax_id = 'DEMO-INV081-SUP'
   OR legal_name ILIKE '%DEMO%INV081%'
   OR trade_name ILIKE '%DEMO%INV081%'
ORDER BY created_at DESC NULLS LAST
LIMIT 1;
`);

const generalPoId = randomUUID();
const kioskPoId = randomUUID();
const orderNumber = `DEMO-INV081-${Date.now().toString().slice(-8)}`;

ok(`DEMO PO ${orderNumber} qty=10`);

psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO platform_suppliers (
  legal_name, trade_name, tax_id, category, notes, status, created_by, updated_by
)
SELECT
  '[DEMO] Proveedor Inventario INV081 SL',
  'DEMO INV081 Kiosk',
  'DEMO-INV081-SUP',
  'kioskos',
  '${MARKER}',
  'active',
  '${saId}'::uuid,
  '${saId}'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM platform_suppliers WHERE tax_id = 'DEMO-INV081-SUP'
);
`);

supplierId = psql(`
SELECT id::text FROM platform_suppliers WHERE tax_id = 'DEMO-INV081-SUP' LIMIT 1;
`);
if (!supplierId) fail('no se pudo crear/obtener proveedor DEMO');

psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO platform_supplier_purchase_orders (
  id, supplier_id, category, title, order_number, status, ordered_at,
  notes, created_by, updated_by
) VALUES (
  '${generalPoId}'::uuid,
  '${supplierId}'::uuid,
  'kioskos',
  '[DEMO] Pedido inventario INV081 (10 ud)',
  '${orderNumber}',
  'pedido',
  CURRENT_DATE,
  '${MARKER}',
  '${saId}'::uuid,
  '${saId}'::uuid
);

INSERT INTO kiosk_purchase_orders (
  id, general_purchase_order_id, supplier_id, supplier_name, order_number, model,
  quantity, received_quantity, status, ordered_at, notes, created_by, updated_by
) VALUES (
  '${kioskPoId}'::uuid,
  '${generalPoId}'::uuid,
  '${supplierId}'::uuid,
  'DEMO INV081 Kiosk',
  '${orderNumber}',
  'FarmaFácil Kiosk DEMO',
  10,
  0,
  'pedido',
  CURRENT_DATE,
  '${MARKER}',
  '${saId}'::uuid,
  '${saId}'::uuid
);
`);

function remaining() {
  return Number(
    psql(`
SELECT (quantity - received_quantity)::text
FROM kiosk_purchase_orders WHERE id = '${kioskPoId}'::uuid;
`)
  );
}

function assetCount() {
  return Number(
    psql(`
SELECT count(*)::text FROM kiosk_assets
WHERE purchase_order_id = '${kioskPoId}'::uuid;
`)
  );
}

function statusCounts() {
  return psql(`
SELECT status || '=' || count(*)::text
FROM kiosk_assets
WHERE purchase_order_id = '${kioskPoId}'::uuid
GROUP BY status
ORDER BY status;
`);
}

if (remaining() !== 10) fail(`remaining esperado 10, got ${remaining()}`);
if (assetCount() !== 0) fail('confirmación no debe crear activos');
ok('10 pendientes virtuales (received=0, assets=0)');

const recv6 = psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.ff_kiosk_purchase_receive_v1(
  '${kioskPoId}'::uuid, 6, CURRENT_DATE, NULL, '${MARKER} recv6'
)::text;
`);
if (!recv6.includes('"status": "ok"') && !recv6.includes('"status":"ok"')) {
  fail(`recv6: ${recv6.slice(0, 300)}`);
}
if (assetCount() !== 6 || remaining() !== 4) {
  fail(`tras recv6: assets=${assetCount()} rem=${remaining()}`);
}
ok('recepción parcial 6 → 6 activos, 4 pendientes');

const recv4 = psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.ff_kiosk_purchase_receive_v1(
  '${kioskPoId}'::uuid, 4, CURRENT_DATE, NULL, '${MARKER} recv4'
)::text;
`);
if (!recv4.includes('"status": "ok"') && !recv4.includes('"status":"ok"')) {
  fail(`recv4: ${recv4.slice(0, 300)}`);
}
if (assetCount() !== 10 || remaining() !== 0) {
  fail(`tras recv4: assets=${assetCount()} rem=${remaining()}`);
}
ok('recepción resto 4 → 10 activos');

const retry = psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.ff_kiosk_purchase_receive_v1(
  '${kioskPoId}'::uuid, 1, CURRENT_DATE, NULL, '${MARKER} retry'
)::text;
`);
if (
  !retry.includes('exceeds_remaining') &&
  !retry.includes('"status": "exceeds_remaining"')
) {
  fail(`reintento debía fallar: ${retry.slice(0, 300)}`);
}
if (assetCount() !== 10) fail('reintento creó duplicados');
ok('reintento recepción → sin duplicados');

const assetIds = psql(`
SELECT id::text FROM kiosk_assets
WHERE purchase_order_id = '${kioskPoId}'::uuid
ORDER BY asset_code
LIMIT 5;
`).split('\n').filter(Boolean);

if (assetIds.length < 5) fail('faltan activos para transiciones');

const [a0, a1, a2, a3, a4] = assetIds;

psql(`
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.ff_kiosk_inventory_assign_v1('${a0}'::uuid, '${pharmacyId}'::uuid);
SELECT public.ff_kiosk_inventory_set_status_v1('${a1}'::uuid, 'exhibition', 'DEMO expo');
SELECT public.ff_kiosk_inventory_set_status_v1('${a2}'::uuid, 'repair', 'DEMO repair');
SELECT public.ff_kiosk_inventory_set_status_v1('${a3}'::uuid, 'retired', 'DEMO retire');
SELECT public.ff_kiosk_inventory_set_status_v1('${a2}'::uuid, 'warehouse', 'DEMO recover');
`);

const a0Status = psql(`SELECT status FROM kiosk_assets WHERE id='${a0}'::uuid;`);
const a1Status = psql(`SELECT status FROM kiosk_assets WHERE id='${a1}'::uuid;`);
const a2Status = psql(`SELECT status FROM kiosk_assets WHERE id='${a2}'::uuid;`);
const a3Status = psql(`SELECT status FROM kiosk_assets WHERE id='${a3}'::uuid;`);
const a4Status = psql(`SELECT status FROM kiosk_assets WHERE id='${a4}'::uuid;`);

if (a0Status !== 'assigned') fail(`assign → ${a0Status}`);
if (a1Status !== 'exhibition') fail(`exhibition → ${a1Status}`);
if (a2Status !== 'warehouse') fail(`recover repair → ${a2Status}`);
if (a3Status !== 'retired') fail(`retired → ${a3Status}`);
if (!['warehouse', 'pending_identification'].includes(a4Status)) {
  fail(`recibido → ${a4Status}`);
}
ok('transiciones assign/expo/repair/recover/retire');

const events = Number(
  psql(`
SELECT count(*)::text FROM kiosk_asset_status_events
WHERE asset_id IN ('${a0}'::uuid,'${a1}'::uuid,'${a2}'::uuid,'${a3}'::uuid);
`)
);
if (events < 4) fail(`pocos eventos de estado: ${events}`);
ok(`auditoría status_events=${events}`);

const retiredLast = psql(`
WITH ranked AS (
  SELECT asset_code, status,
    CASE WHEN status = 'retired' THEN 1 ELSE 0 END AS retired_rank
  FROM kiosk_assets
  WHERE purchase_order_id = '${kioskPoId}'::uuid
)
SELECT CASE
  WHEN max(CASE WHEN status='retired' THEN retired_rank END) = 1
   AND bool_and(CASE WHEN status='retired' THEN true ELSE retired_rank=0 END)
  THEN 'ok' ELSE 'bad'
END
FROM ranked;
`);
if (retiredLast !== 'ok') fail('orden retirados');
ok('retirados marcados para ir al final del listado');

const codes = psql(`
SELECT asset_code FROM kiosk_assets
WHERE purchase_order_id = '${kioskPoId}'::uuid
ORDER BY asset_code LIMIT 3;
`);
ok(`códigos KSK DEMO: ${codes.replace(/\n/g, ', ')}`);
ok(`estados: ${statusCounts().replace(/\n/g, '; ')}`);
ok(`marker=${MARKER} (limpieza manual si se desea; no borra prod)`);

console.log(
  JSON.stringify(
    {
      ok: true,
      staging: STAGING,
      marker: MARKER,
      orderNumber,
      kioskPoId,
      assets: assetCount(),
      remaining: remaining(),
      statuses: statusCounts().split('\n'),
    },
    null,
    2
  )
);
