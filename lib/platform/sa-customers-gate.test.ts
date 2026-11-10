/**
 * node --experimental-strip-types --test lib/platform/sa-customers-gate.test.ts
 *
 * Documenta el contrato de autorización: datos personales de clientes
 * solo con PLATFORM_SUPERADMIN (no pharmacies.read / SUPPORT).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'sa-customers.ts'), 'utf8');

describe('sa-customers authorization contract', () => {
  it('exige SuperAdmin Total, no pharmacies.read', () => {
    assert.match(source, /hasPlatformSuperAdminRole/);
    assert.doesNotMatch(source, /platform\.pharmacies\.read/);
    assert.match(
      source,
      /Solo SuperAdmin Total puede consultar datos personales de clientes/
    );
  });

  it('filtra account_kind customer|both (no personal FarmaFácil)', () => {
    assert.match(source, /\['customer',\s*'both'\]/);
  });
});
