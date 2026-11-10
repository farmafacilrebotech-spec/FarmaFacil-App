#!/usr/bin/env node
/**
 * Seed DEMO idempotente (solo staging) para el comparador de presupuestos.
 *
 *   node scripts/staging-seed-demo-quote-compare.mjs
 *
 * Crea 3 proveedores FICTICIOS + presupuestos/líneas comparables.
 * No crea pedidos confirmados, facturas ni emails.
 * No toca proveedores reales (filtra por tax_id DEMO-PR21-*).
 *
 * Limpieza: ver docs/pr21-demo-quote-compare-cleanup.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const PROD = 'gsnohwsvjxpjfcsstnfd';
const STAGING = 'dazfdcjscnpfvhcyjddt';
const ENV_FILE = '.env.staging.local';
const MARKER = 'DEMO-PR21-COMPARE';

function fail(msg) {
  console.error(`[demo-seed] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[demo-seed] OK: ${msg}`);
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
    fail(`psql error: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return (r.stdout || '').trim();
}

const saId = psql(`
SELECT pur.profile_id::text
FROM platform_user_roles pur
JOIN platform_roles r ON r.id = pur.platform_role_id
WHERE r.key = 'PLATFORM_SUPERADMIN'
LIMIT 1;
`);
if (!saId) fail('no PLATFORM_SUPERADMIN');

const suppliers = [
  {
    taxId: 'DEMO-PR21-ALPHA',
    legalName: '[DEMO] Merchandising Alpha Ficticio SL',
    tradeName: 'DEMO Alpha Merch',
    // Unitario más bajo en bolsas, transporte alto → no siempre gana en coste real
    bags: { qty: 100, unit: 85, vat: 2100, lead: 21 },
    pens: { qty: 250, unit: 55, vat: 2100, lead: 14 },
    flyers: { qty: 500, unit: 18, vat: 2100, lead: 10 },
    shipping: 4500, // 45 €
    notes: `${MARKER} · transporte alto; plazos medios`,
  },
  {
    taxId: 'DEMO-PR21-BETA',
    legalName: '[DEMO] Merchandising Beta Inventada SA',
    tradeName: 'DEMO Beta Print',
    // Unitario medio, transporte bajo → suele ganar en coste real c/ transporte
    bags: { qty: 100, unit: 98, vat: 2100, lead: 12 },
    pens: { qty: 250, unit: 58, vat: 2100, lead: 7 },
    flyers: { qty: 500, unit: 20, vat: 1000, lead: 5 },
    shipping: 800, // 8 €
    notes: `${MARKER} · transporte bajo; plazos cortos`,
  },
  {
    taxId: 'DEMO-PR21-GAMMA',
    legalName: '[DEMO] Merchandising Gamma Simulada SCP',
    tradeName: 'DEMO Gamma Promo',
    // Mejor unitario en bolígrafos/flyers; plazos largos
    bags: { qty: 100, unit: 92, vat: 2100, lead: 30 },
    pens: { qty: 250, unit: 49, vat: 2100, lead: 25 },
    flyers: { qty: 500, unit: 15, vat: 2100, lead: 28 },
    shipping: 2200, // 22 €
    notes: `${MARKER} · unitarios mixtos; plazos largos`,
  },
];

const sql = `
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${saId}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

${suppliers
  .map((s) => {
    const quoteId = randomUUID();
    const warnQuoteId = randomUUID();
    return `
-- Supplier ${s.taxId}
INSERT INTO platform_suppliers (
  legal_name, trade_name, tax_id, category, email, notes, status, created_by, updated_by
)
SELECT
  '${s.legalName.replace(/'/g, "''")}',
  '${s.tradeName.replace(/'/g, "''")}',
  '${s.taxId}',
  'merchandising',
  NULL,
  '${s.notes.replace(/'/g, "''")}',
  'active',
  '${saId}'::uuid,
  '${saId}'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM platform_suppliers WHERE tax_id = '${s.taxId}'
);

WITH sid AS (
  SELECT id FROM platform_suppliers WHERE tax_id = '${s.taxId}' LIMIT 1
),
ins_q AS (
  INSERT INTO platform_supplier_quotes (
    id, supplier_id, title, quote_number, status, shipping_cents, notes,
    created_by, updated_by
  )
  SELECT
    '${quoteId}'::uuid,
    sid.id,
    '[DEMO] Pack merchandising corporativo 2026',
    'DEMO-${s.taxId.slice(-5)}',
    'recibido',
    ${s.shipping},
    '${s.notes.replace(/'/g, "''")}',
    '${saId}'::uuid,
    '${saId}'::uuid
  FROM sid
  WHERE NOT EXISTS (
    SELECT 1 FROM platform_supplier_quotes q
    JOIN platform_suppliers p ON p.id = q.supplier_id
    WHERE p.tax_id = '${s.taxId}'
      AND q.title = '[DEMO] Pack merchandising corporativo 2026'
  )
  RETURNING id
),
qid AS (
  SELECT id FROM ins_q
  UNION ALL
  SELECT q.id
  FROM platform_supplier_quotes q
  JOIN platform_suppliers p ON p.id = q.supplier_id
  WHERE p.tax_id = '${s.taxId}'
    AND q.title = '[DEMO] Pack merchandising corporativo 2026'
  LIMIT 1
)
INSERT INTO platform_supplier_quote_lines (
  quote_id, material_key, description, quantity, unit, unit_price_cents, vat_bps, lead_days, sort_order
)
SELECT qid.id, v.material_key, v.description, v.quantity, 'ud', v.unit_price_cents, v.vat_bps, v.lead_days, v.sort_order
FROM qid
CROSS JOIN (VALUES
  ('bolsas-corp-negras', 'Bolsas corporativas negras', ${s.bags.qty}, ${s.bags.unit}, ${s.bags.vat}, ${s.bags.lead}, 1),
  ('boligrafos-corp', 'Bolígrafos corporativos', ${s.pens.qty}, ${s.pens.unit}, ${s.pens.vat}, ${s.pens.lead}, 2),
  ('flyers-a5', 'Flyers A5', ${s.flyers.qty}, ${s.flyers.unit}, ${s.flyers.vat}, ${s.flyers.lead}, 3)
) AS v(material_key, description, quantity, unit_price_cents, vat_bps, lead_days, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM platform_supplier_quote_lines l WHERE l.quote_id = qid.id
);

-- Presupuesto con cantidad distinta (solo Alpha) para avisos de no equivalencia
${
  s.taxId === 'DEMO-PR21-ALPHA'
    ? `
WITH sid AS (
  SELECT id FROM platform_suppliers WHERE tax_id = '${s.taxId}' LIMIT 1
)
INSERT INTO platform_supplier_quotes (
  id, supplier_id, title, quote_number, status, shipping_cents, notes,
  created_by, updated_by
)
SELECT
  '${warnQuoteId}'::uuid,
  sid.id,
  '[DEMO] Bolsas corporativas negras — cantidad distinta',
  'DEMO-WARN-QTY',
  'recibido',
  1500,
  '${MARKER} · cantidad 150 (no equivalente a 100)',
  '${saId}'::uuid,
  '${saId}'::uuid
FROM sid
WHERE NOT EXISTS (
  SELECT 1 FROM platform_supplier_quotes q
  JOIN platform_suppliers p ON p.id = q.supplier_id
  WHERE p.tax_id = '${s.taxId}'
    AND q.title = '[DEMO] Bolsas corporativas negras — cantidad distinta'
);

WITH qid AS (
  SELECT q.id
  FROM platform_supplier_quotes q
  JOIN platform_suppliers p ON p.id = q.supplier_id
  WHERE p.tax_id = '${s.taxId}'
    AND q.title = '[DEMO] Bolsas corporativas negras — cantidad distinta'
  LIMIT 1
)
INSERT INTO platform_supplier_quote_lines (
  quote_id, material_key, description, quantity, unit, unit_price_cents, vat_bps, lead_days, sort_order
)
SELECT qid.id, 'bolsas-corp-negras', 'Bolsas corporativas negras', 150, 'ud', 84, 2100, 18, 1
FROM qid
WHERE NOT EXISTS (
  SELECT 1 FROM platform_supplier_quote_lines l WHERE l.quote_id = qid.id
);
`
    : ''
}
`;
  })
  .join('\n')}

COMMIT;
`;

psql(sql);

const summary = psql(`
SELECT p.tax_id || '|' || p.legal_name || '|' || count(q.id)::text
FROM platform_suppliers p
LEFT JOIN platform_supplier_quotes q ON q.supplier_id = p.id
WHERE p.tax_id LIKE 'DEMO-PR21-%'
GROUP BY p.tax_id, p.legal_name
ORDER BY p.tax_id;
`);

ok('seed DEMO aplicado (idempotente)');
for (const line of summary.split('\n').filter(Boolean)) {
  const [tax, name, n] = line.split('|');
  console.log(`  ${tax}: ${name} · presupuestos=${n}`);
}
ok(`marcador ${MARKER}`);
ok('limpieza: docs/pr21-demo-quote-compare-cleanup.md');
