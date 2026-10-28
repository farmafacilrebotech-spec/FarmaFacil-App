/**
 * Validación estática del borrador 060 (sin aplicar SQL).
 * node supabase/drafts/060_static_validate.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(dir, '060_public_qr_line_valuation_v1.sql'),
  'utf8'
);

const checks = [
  {
    name: 'header NO APLICAR',
    ok: /NO APLICAR/.test(sql),
  },
  {
    name: 'columnas lines_valued / customer_accepted',
    ok:
      /lines_valued_at/.test(sql) &&
      /customer_accepted_at/.test(sql) &&
      /availability_status/.test(sql),
  },
  {
    name: 'RPC ff_confirm_public_qr_line_valuation_v1',
    ok: /CREATE OR REPLACE FUNCTION public\.ff_confirm_public_qr_line_valuation_v1/.test(
      sql
    ),
  },
  {
    name: 'exige orders.manage',
    ok: /orders\.manage/.test(sql),
  },
  {
    name: 'FOR UPDATE del pedido',
    ok: /FOR UPDATE/.test(sql),
  },
  {
    name: 'total servidor sin p_amount del cliente',
    ok:
      /ff_confirm_public_qr_line_valuation_v1\(\s*p_pharmacy_id uuid,\s*p_order_id uuid,\s*p_lines jsonb/.test(
        sql
      ) &&
      !/ff_confirm_public_qr_line_valuation_v1\([^)]*p_amount/.test(sql) &&
      /v_total := v_total \+ round\(v_unit \* v_item\.quantity, 2\)/.test(sql),
  },
  {
    name: 'MVP precio disponible > 0',
    ok: /v_unit <= 0/.test(sql),
  },
  {
    name: 'concurrent_modification',
    ok: /concurrent_modification/.test(sql),
  },
  {
    name: 'no cobro automático (unpaid)',
    ok: /v_new_payment := 'unpaid'/.test(sql) && !/:= 'paid'/.test(sql),
  },
  {
    name: 'valoración ≠ aceptación cliente',
    ok:
      /awaiting_customer_acceptance/.test(sql) &&
      /No tocar customer_accepted/.test(sql),
  },
  {
    name: 'gate preparing quote_awaiting_customer_acceptance',
    ok:
      /ff_public_qr_may_enter_preparing_v1/.test(sql) &&
      /quote_awaiting_customer_acceptance/.test(sql) &&
      /valuation_required/.test(sql),
  },
  {
    name: 'legacy sellado quote_legacy_total_only',
    ok: /quote_legacy_total_only/.test(sql),
  },
  {
    name: '058 rechaza public_qr (use_line_valuation)',
    ok: /use_line_valuation/.test(sql) && /source = 'public_qr'/.test(sql),
  },
  {
    name: 'kiosk backfill available',
    ok: /source IS DISTINCT FROM 'public_qr'/.test(sql),
  },
  {
    name: 'sin DELETE masivo de pedidos',
    ok: !/DELETE\s+FROM\s+public\.pharmacy_orders/i.test(sql),
  },
  {
    name: 'REVOKE PUBLIC en RPC valoración',
    ok: /REVOKE ALL ON FUNCTION public\.ff_confirm_public_qr_line_valuation_v1/.test(
      sql
    ),
  },
];

let failed = 0;
for (const c of checks) {
  const mark = c.ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${c.name}`);
  if (!c.ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n060 static validate: ${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\n060 static validate: ${checks.length} checks passed`);
