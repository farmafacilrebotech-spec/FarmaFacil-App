import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  assertEmailHasAuthoredContent,
  authoredPlainTextFromHtml,
  hasAuthoredEmailContent,
  stripLegacyTemplateSignature,
} from './content-validation.ts';

describe('content-validation EMAIL-04', () => {
  it('firma sola no cuenta como contenido', () => {
    const html = `<p></p><table data-ff-corporate-signature="1"><tr><td>Pilar Reyes Bononat</td></tr></table>`;
    assert.equal(hasAuthoredEmailContent({ htmlBody: html }), false);
  });

  it('texto + firma sí cuenta', () => {
    const html = `<p>Hola equipo</p><table data-ff-corporate-signature="1"><tr><td>Pilar</td></tr></table>`;
    assert.equal(hasAuthoredEmailContent({ htmlBody: html }), true);
    assert.match(authoredPlainTextFromHtml(html), /Hola equipo/);
  });

  it('solo adjuntos → attachments_only', () => {
    const r = assertEmailHasAuthoredContent({
      htmlBody: '<p></p>',
      attachmentCount: 1,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'attachments_only');
  });

  it('stripLegacy no destruye layout exterior de plantilla (P0)', () => {
    const nested = `<table role="presentation" width="100%">
  <tr><td>
    <table role="presentation"><tr><td>Invitación al programa piloto FarmaFácil contenido principal completo</td></tr></table>
    <table><tr><td>
      <div>Pilar Reyes Bononat</div>
      <div>Fundadora y Directora | FarmaFácil</div>
    </td></tr></table>
  </td></tr>
</table>`;
    const stripped = stripLegacyTemplateSignature(nested);
    assert.match(stripped, /Invitación al programa piloto/);
    assert.match(stripped, /contenido principal completo/);
    assert.equal(/Pilar Reyes Bononat/i.test(stripped), false);
  });

  it('plantilla staging íntegra sigue contando como contenido tras strip seguro', () => {
    const file = path.join(
      process.cwd(),
      'tmp/template-backup-2026-11-14/system-piloto.html'
    );
    if (!fs.existsSync(file)) {
      // Skip silencioso si no hay backup local
      return;
    }
    const html = fs.readFileSync(file, 'utf8');
    const stripped = stripLegacyTemplateSignature(html);
    assert.ok(stripped.length > 5000, `expected large body, got ${stripped.length}`);
    assert.equal(hasAuthoredEmailContent({ htmlBody: stripped }), true);
    assert.match(authoredPlainTextFromHtml(stripped), /piloto/i);
  });
});
