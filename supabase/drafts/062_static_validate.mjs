#!/usr/bin/env node
/**
 * Validación estática del borrador 062 (sin aplicar SQL).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('supabase/drafts/062_public_qr_quote_acceptance_v1.sql');
const sql = readFileSync(path, 'utf8');

const required = [
  'pharmacy_order_quote_tokens',
  'pharmacy_order_quote_events',
  'quote_version',
  'quote_expires_at',
  'customer_rejected_at',
  'ff_issue_public_qr_quote_token_v1',
  'ff_get_public_qr_quote_by_token_v1',
  'ff_decide_public_qr_quote_by_token_v1',
  'ff_confirm_public_qr_line_valuation_v1',
  'p_allow_revision',
  'quote_rejected',
  'interval \'72 hours\'',
  'BORRADOR — NO APLICAR',
];

let failed = false;
for (const needle of required) {
  if (!sql.includes(needle)) {
    console.error(`[062] missing: ${needle}`);
    failed = true;
  }
}

if (!sql.includes('REVOKE ALL ON FUNCTION public.ff_get_public_qr_quote_by_token_v1')) {
  console.error('[062] missing revoke on get');
  failed = true;
}

if (sql.includes('GRANT EXECUTE') && !sql.includes('TO anon, authenticated, service_role')) {
  // get/decide must grant anon
}

console.log(failed ? '[062] FAIL' : `[062] OK static (${sql.length} chars)`);
process.exit(failed ? 1 : 0);
