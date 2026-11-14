import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applySignaturePolicy,
  htmlHasEmbeddedSignature,
  stripManagedSignature,
} from './signature.ts';
import { getCorporateSender } from './senders.ts';
import {
  rewriteEmailHtmlAssetsForProvider,
  htmlHasNonPublicImageSrc,
} from './provider-assets.ts';
import { stripLegacyTemplateSignature } from './content-validation.ts';

function buildProviderEmailHtml(input: {
  htmlBody: string;
  textBody: string;
  fromKey: string;
  includeSignature: boolean;
  migrateEmbeddedSignature?: boolean;
}) {
  let htmlBody = input.htmlBody || '';
  let textBody = input.textBody || '';
  const migrate =
    input.migrateEmbeddedSignature !== false &&
    input.includeSignature === true;
  if (migrate && htmlHasEmbeddedSignature(htmlBody)) {
    htmlBody = stripLegacyTemplateSignature(htmlBody);
    htmlBody = stripManagedSignature(htmlBody);
  }
  const withSig = applySignaturePolicy({
    htmlBody,
    textBody,
    fromKey: input.fromKey,
    previewOrigin: null,
    includeSignature: input.includeSignature === true,
  });
  const html = rewriteEmailHtmlAssetsForProvider(withSig.html);
  const hasEmbedded = htmlHasEmbeddedSignature(html);
  const signaturePresent = withSig.applied || hasEmbedded;
  let signatureLabel: string | null = null;
  if (withSig.applied) {
    signatureLabel = getCorporateSender(input.fromKey).signatureName;
  } else if (hasEmbedded) {
    signatureLabel = 'Incorporada en la plantilla';
  }
  return {
    html,
    text: withSig.text,
    signatureApplied: withSig.applied,
    hasEmbeddedSignature: hasEmbedded,
    signatureLabel,
    signaturePresent,
  };
}

describe('buildProviderEmailHtml (payload Resend)', () => {
  it('con firma: incluye exactamente una firma gestionada y URLs https públicas', () => {
    const r = buildProviderEmailHtml({
      htmlBody: '<p>Cuerpo de prueba</p>',
      textBody: 'Cuerpo de prueba',
      fromKey: 'pilar',
      includeSignature: true,
    });
    assert.equal(r.signatureApplied, true);
    assert.equal(r.signaturePresent, true);
    assert.equal(r.signatureLabel, 'Pilar Reyes Bononat');
    assert.ok(r.html.includes('data-ff-corporate-signature'));
    assert.ok(r.html.includes('Fundadora y Directora'));
    assert.equal(r.html.includes('localhost'), false);
    assert.equal(htmlHasNonPublicImageSrc(r.html), false);
  });

  it('reescribe iconos preview localhost a HTTPS públicos', () => {
    const r = buildProviderEmailHtml({
      htmlBody:
        '<p>Lanzadera</p><img src="http://127.0.0.1:3065/images/kiosk/kiosk-qr.png" width="44" />',
      textBody: 'Lanzadera',
      fromKey: 'pilar',
      includeSignature: false,
    });
    assert.equal(htmlHasNonPublicImageSrc(r.html), false);
    assert.ok(
      r.html.includes(
        'https://app.farmafacil.solutions/images/kiosk/kiosk-qr.png'
      )
    );
  });

  it('migra firma embebida a dinámica (sin duplicar)', () => {
    const body = `<p>Hola Lanzadera</p>
      <table><tr><td><img src="/images/email/firma-pilar.png" width="80" />
      <div>Pilar Reyes Bononat</div>
      <div>Fundadora y Directora | FarmaFácil</div>
      </td></tr></table>`;
    const r = buildProviderEmailHtml({
      htmlBody: body,
      textBody: 'Hola Lanzadera',
      fromKey: 'pilar',
      includeSignature: true,
    });
    assert.equal(r.signatureApplied, true);
    assert.equal(
      (r.html.match(/data-ff-corporate-signature/g) || []).length,
      1
    );
    assert.equal(htmlHasNonPublicImageSrc(r.html), false);
  });

  it('sin firma: no añade bloque gestionado', () => {
    const r = buildProviderEmailHtml({
      htmlBody: '<p>Sin firma</p>',
      textBody: 'Sin firma',
      fromKey: 'soporte',
      includeSignature: false,
    });
    assert.equal(r.signatureApplied, false);
    assert.equal(r.html.includes('data-ff-corporate-signature'), false);
  });
});
