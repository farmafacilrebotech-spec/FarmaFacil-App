import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve('supabase/drafts/063_public_qr_quote_rate_limit_v1.sql'),
  'utf8'
);
const need = [
  'pharmacy_order_quote_rate_limits',
  'ff_public_qr_quote_rate_allow_v1',
  'ff_public_qr_quote_rate_cleanup_v1',
  'SECURITY DEFINER',
  'attempt_count',
  'blocked_until',
  'TO anon, authenticated, service_role',
  'TO service_role',
];
let fail = false;
for (const n of need) {
  if (!sql.includes(n)) {
    console.error('[063] missing', n);
    fail = true;
  }
}
console.log(fail ? '[063] FAIL' : `[063] OK static (${sql.length} chars)`);
process.exit(fail ? 1 : 0);
