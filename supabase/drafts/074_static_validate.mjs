#!/usr/bin/env node
/**
 * Validación estática de 074_catalog_role_permissions_v1.sql (sin aplicar).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(
  join(root, 'migrations/074_catalog_role_permissions_v1.sql'),
  'utf8'
);

const must = [
  'catalog.view',
  'catalog.manage',
  'catalog.stock.update',
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
  'pharmacy_products_insert',
  'pharmacy_products_update',
  'ff_pharmacy_products_enforce_catalog_write_',
  'NEW.price IS DISTINCT FROM OLD.price',
];

let failed = false;
for (const needle of must) {
  if (!sql.includes(needle)) {
    console.error('MISSING:', needle);
    failed = true;
  }
}

// STAFF must not get catalog.manage in the same INSERT block as view-only
const staffBlock = sql.match(
  /r\.key = 'STAFF'[\s\S]*?ON CONFLICT DO NOTHING;/
);
if (!staffBlock) {
  console.error('MISSING: STAFF role_permissions block');
  failed = true;
} else if (staffBlock[0].includes('catalog.manage')) {
  console.error('STAFF must not receive catalog.manage');
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('074_static_validate: OK');
