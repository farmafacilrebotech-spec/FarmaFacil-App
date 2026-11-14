/**
 * HTML final entregado al proveedor (Resend).
 * Siempre con URLs HTTPS públicas; nunca origin de preview/localhost.
 */

import {
  applySignaturePolicy,
  htmlHasEmbeddedSignature,
  stripManagedSignature,
} from './signature';
import type { CorporateSenderKey } from './senders';
import { getCorporateSender } from './senders';
import {
  htmlHasNonPublicImageSrc,
  rewriteEmailHtmlAssetsForProvider,
} from './provider-assets';
import { stripLegacyTemplateSignature } from './content-validation';

export type ProviderHtmlInput = {
  htmlBody: string;
  textBody: string;
  fromKey?: CorporateSenderKey | string | null;
  /** Debe ser true solo si el usuario marcó «Incluir firma». */
  includeSignature: boolean;
  /**
   * Si true, elimina firmas legacy embebidas en plantilla y aplica la dinámica
   * (EMAIL-05). Por defecto true cuando includeSignature.
   */
  migrateEmbeddedSignature?: boolean;
};

export type ProviderHtmlResult = {
  html: string;
  text: string;
  signatureApplied: boolean;
  hasEmbeddedSignature: boolean;
  signatureLabel: string | null;
  /** true si el HTML final incluye firma (aplicada o embebida). */
  signaturePresent: boolean;
  assetsRewritten: boolean;
};

/**
 * Construye el payload HTML/text que se envía a Resend y se guarda como snapshot.
 */
export function buildProviderEmailHtml(
  input: ProviderHtmlInput
): ProviderHtmlResult {
  let htmlBody = input.htmlBody || '';
  let textBody = input.textBody || '';
  const migrate =
    input.migrateEmbeddedSignature !== false &&
    input.includeSignature === true;

  // EMAIL-05: si vamos a aplicar firma dinámica, quitar la antigua embebida
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

  // EMAIL-01: preview localhost/relativos → HTTPS públicos
  const hadLocal = htmlHasNonPublicImageSrc(withSig.html);
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
    assetsRewritten: hadLocal || html !== withSig.html,
  };
}
