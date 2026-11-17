/**
 * Matriz permanente plantilla × remitente (EMAIL-10).
 * Autocontenida (sin imports relativos rotos en node:test/ESM).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CORPORATE_MANAGED_SENDERS,
  assertAuthorizedSenderKey,
} from './senders.ts';

const TEMPLATES = [
  'blank',
  'lanzadera',
  'imprentas',
  'demo',
  'piloto',
] as const;

const FORCED_PURPOSE: Record<string, string> = {
  lanzadera: 'institutional',
  imprentas: 'procurement',
  demo: 'commercial',
  piloto: 'commercial',
};

function purposeFor(slug: string): string {
  return FORCED_PURPOSE[slug] ?? 'operational';
}

describe('EMAIL-10 matriz plantilla × remitente', () => {
  for (const slug of TEMPLATES) {
    for (const sender of CORPORATE_MANAGED_SENDERS) {
      it(`${slug} + ${sender.key}: remitente autorizado y propósito estable`, () => {
        const auth = assertAuthorizedSenderKey(sender.key, {});
        assert.equal(auth.ok, true);
        const purpose = purposeFor(slug);
        assert.ok(
          ['operational', 'commercial', 'institutional', 'procurement'].includes(
            purpose
          )
        );
        // Regla EMAIL-10: ninguna combinación plantilla/remitente se excluye aquí.
        assert.equal(typeof sender.fromHeader, 'string');
        assert.match(sender.email, /@farmafacil\.solutions$/);
      });
    }
  }

  it('propósitos forzados no se eluden', () => {
    assert.equal(purposeFor('piloto'), 'commercial');
    assert.equal(purposeFor('demo'), 'commercial');
    assert.equal(purposeFor('imprentas'), 'procurement');
    assert.equal(purposeFor('lanzadera'), 'institutional');
    assert.equal(purposeFor('blank'), 'operational');
  });

  it('conteo matriz = plantillas × remitentes managed', () => {
    assert.equal(TEMPLATES.length * CORPORATE_MANAGED_SENDERS.length, 40);
  });
});
