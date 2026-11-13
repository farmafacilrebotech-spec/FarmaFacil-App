import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applySignaturePolicy,
  htmlHasEmbeddedSignature,
  buildCorporateSignatureHtml,
} from './signature.ts';

describe('signature policy', () => {
  it('detecta firma embebida de plantilla', () => {
    assert.equal(
      htmlHasEmbeddedSignature(
        '<p>Hola</p><img src="https://x/firma-pilar.png" /><a href="mailto:a@b.c">x</a>'
      ),
      true
    );
    assert.equal(htmlHasEmbeddedSignature('<p>Solo texto</p>'), false);
  });

  it('no añade firma gestionada si plantilla trae foto firma', () => {
    const body =
      '<p>Hola</p><img src="/images/email/firma-pilar.png" width="80" />';
    const r = applySignaturePolicy({
      htmlBody: body,
      textBody: 'Hola',
      fromKey: 'pilar',
      includeSignature: true,
    });
    assert.equal(r.applied, false);
    assert.equal(r.html.includes('data-ff-corporate-signature'), false);
  });

  it('añade firma pilar cuando includeSignature y cuerpo limpio', () => {
    const r = applySignaturePolicy({
      htmlBody: '<p>Hola</p>',
      textBody: 'Hola',
      fromKey: 'pilar',
      includeSignature: true,
    });
    assert.equal(r.applied, true);
    assert.ok(r.html.includes('Fundadora y Directora'));
    assert.ok(r.html.includes('+34 711 520 218'));
  });

  it('firma departamental usa identidad del equipo', () => {
    const html = buildCorporateSignatureHtml({ fromKey: 'ventas' });
    assert.ok(html.includes('Equipo de Ventas'));
    assert.ok(
      html.includes('farmafacil-mark') || html.includes('farmafacil-logo')
    );
  });

  it('includeSignature false no añade', () => {
    const r = applySignaturePolicy({
      htmlBody: '<p>Hola</p>',
      textBody: 'Hola',
      fromKey: 'pilar',
      includeSignature: false,
    });
    assert.equal(r.applied, false);
    assert.equal(r.html.includes('data-ff-corporate-signature'), false);
  });
});
