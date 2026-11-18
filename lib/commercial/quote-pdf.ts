/**
 * PDF corporativo de presupuesto comercial (A4, servidor).
 * PRE-05B: misma plantilla HTML aprobada que Imprimir / Descargar HTML,
 * renderizada a PDF con Chromium (Vercel: @sparticuz/chromium).
 */

import { buildQuoteDocumentHtml } from '@/lib/commercial/quote-document';
import type { CommercialQuoteSnapshot } from '@/lib/commercial/quote-types';
import { renderHtmlToPdf } from '@/lib/pdf/html-to-pdf';

export type CommercialQuotePdfInput = {
  referenceCode: string;
  createdAt: string;
  snapshot: CommercialQuoteSnapshot;
};

export type CommercialQuotePdfResult = {
  bytes: Uint8Array;
  filename: string;
  mimeType: 'application/pdf';
  /** Origen del documento (auditoría / tests). */
  source: 'html-template';
};

/**
 * Genera el PDF A4 del presupuesto a partir del snapshot inmutable
 * usando la plantilla HTML corporativa PRE-05.
 */
export async function buildCommercialQuotePdf(
  input: CommercialQuotePdfInput
): Promise<CommercialQuotePdfResult> {
  const ref = input.referenceCode.trim() || 'sin-ref';
  const html = buildQuoteDocumentHtml({
    referenceCode: ref,
    createdAt: input.createdAt,
    snapshot: input.snapshot,
  });

  const pdf = await renderHtmlToPdf(html, {
    format: 'A4',
    printBackground: true,
  });

  const safeRef = ref.replace(/[^\w.-]+/g, '_').slice(0, 48) || 'sin-ref';
  return {
    bytes: pdf.bytes,
    filename: `presupuesto-${safeRef}.pdf`,
    mimeType: 'application/pdf',
    source: 'html-template',
  };
}

export function pdfBytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
