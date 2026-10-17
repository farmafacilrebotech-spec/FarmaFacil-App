import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Comprueba identidad visual Brand Book en la plantilla (sin enviar email).
 * Lee el fuente para no exportar HTML de producción a tests.
 */
describe('pharmacy invitation email brand', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(dir, 'pharmacy-invitation.ts'), 'utf8');

  it('uses Brand Book hex tokens (not legacy teal)', () => {
    assert.match(source, /#2EC4C7/);
    assert.match(source, /#26B1B3/);
    assert.match(source, /#111827/);
    assert.match(source, /#F8FAFC/);
    assert.match(source, /#E7EEF3/);
    assert.doesNotMatch(source, /#0d9488/);
  });

  it('marks template version v4 and uses absolute logo on canonical host', () => {
    assert.match(source, /ff-pharmacy-invite-v4/);
    assert.match(
      source,
      /images\/logos\/farmafacil-mark\.png/
    );
    assert.match(source, /CANONICAL_PRODUCTION_APP_URL/);
  });

  it('keeps functional CTA labels and does not log tokens', () => {
    assert.match(source, /Ver invitación/);
    assert.match(source, /Completar acceso/);
    assert.doesNotMatch(source, /console\.(log|error|warn).*hashedToken/);
    assert.doesNotMatch(source, /console\.(log|error|warn).*token_hash/);
  });
});
