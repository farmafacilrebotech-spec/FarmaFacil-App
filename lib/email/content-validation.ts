/**
 * Validación de contenido redactado (EMAIL-04).
 * La firma automática / embebida NO cuenta como cuerpo.
 *
 * IMPORTANTE: stripLegacyTemplateSignature solo elimina tablas-innermost
 * compactas de firma. Nunca debe borrar el layout exterior de una plantilla
 * (regresión P0: el regex antiguo coincidía con el <table> raíz y borraba ~95%).
 */

import {
  htmlHasEmbeddedSignature,
  stripManagedSignature,
} from './signature';
import { htmlToPlainText } from './html-sanitize';
import { EMAIL_EMPTY_BODY_ERROR } from './content-messages';

export { EMAIL_EMPTY_BODY_ERROR } from './content-messages';

/** Texto plano máximo de una tabla que aún consideramos «solo firma». */
const SIGNATURE_TABLE_PLAIN_MAX = 800;

function plainFromHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quita bloques de firma legacy típicos (foto + Pilar / pie de firma).
 * Solo tablas innermost (sin <table> anidado) y de tamaño compacto.
 */
export function stripLegacyTemplateSignature(html: string): string {
  let out = stripManagedSignature(html || '');

  // Innermost: no nested <table inside the match.
  const innermostSigTable =
    /<table\b[^>]*>((?:(?!<table\b)[\s\S])*?Pilar Reyes Bononat(?:(?!<table\b)[\s\S])*?Fundadora y Directora(?:(?!<table\b)[\s\S])*?)<\/table>/gi;

  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(innermostSigTable, (full) => {
      const plain = plainFromHtml(full);
      if (plain.length <= SIGNATURE_TABLE_PLAIN_MAX) return '';
      return full;
    });
  }

  // Filas vacías que quedaron tras quitar la firma
  out = out.replace(/<tr\b[^>]*>\s*<td\b[^>]*>\s*<\/td>\s*<\/tr>/gi, '');
  return out.trim();
}

/**
 * Texto «escrito por el usuario» excluyendo firma.
 */
export function authoredPlainTextFromHtml(html: string): string {
  let body = html || '';
  if (htmlHasEmbeddedSignature(body) || /data-ff-corporate-signature/i.test(body)) {
    body = stripLegacyTemplateSignature(body);
  } else {
    body = stripManagedSignature(body);
  }
  return htmlToPlainText(body)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasAuthoredEmailContent(input: {
  htmlBody: string;
  textBody?: string | null;
}): boolean {
  const fromHtml = authoredPlainTextFromHtml(input.htmlBody);
  if (fromHtml.length >= 2) return true;
  const text = (input.textBody || '').trim();
  if (!text) return false;
  // textBody a veces incluye bloque de firma (--\nPilar...)
  const withoutSig = text
    .replace(/\n--\n[\s\S]*$/m, '')
    .replace(/Pilar Reyes Bononat[\s\S]*farmafacil\.solutions/i, '')
    .trim();
  return withoutSig.length >= 2;
}

export type ContentGateResult =
  | { ok: true }
  | {
      ok: false;
      code: 'empty_body' | 'attachments_only';
      error: string;
    };

/**
 * Impide envío accidental sin texto.
 * Si hay adjuntos y no hay texto → advertencia attachments_only.
 * Una plantilla íntegra (sin nota) cuenta como contenido válido.
 */
export function assertEmailHasAuthoredContent(input: {
  htmlBody: string;
  textBody?: string | null;
  attachmentCount?: number;
}): ContentGateResult {
  if (hasAuthoredEmailContent(input)) return { ok: true };
  const n = input.attachmentCount ?? 0;
  if (n > 0) {
    return {
      ok: false,
      code: 'attachments_only',
      error:
        'El mensaje no tiene texto redactado (la firma no cuenta). Hay adjuntos: escribe al menos un párrafo o confirma que quieres enviar solo archivos.',
    };
  }
  return {
    ok: false,
    code: 'empty_body',
    error: EMAIL_EMPTY_BODY_ERROR,
  };
}
