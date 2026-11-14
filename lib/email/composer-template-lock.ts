/**
 * Plantilla corporativa bloqueada en el compositor.
 *
 * Causa raíz (pérdida de contenido): contentEditable destruye tablas/HTML
 * complejo al teclear. Solución: la plantilla vive en un bloque
 * contenteditable=false; el usuario solo edita una nota opcional encima.
 */

export const FF_COMPOSER_NOTE_ATTR = 'data-ff-composer-note';
export const FF_TEMPLATE_LOCKED_ATTR = 'data-ff-template-locked';

const NOTE_HINT =
  'Escribe aquí un mensaje adicional (opcional). La plantilla corporativa de debajo se conserva intacta.';

/** Sanitizado mínimo local (evita dependencia circular en tests Node). */
function sanitizeEmailHtml(raw: string): string {
  let html = raw || '';
  html = html.replace(
    /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|svg|math)[^>]*>/gi,
    ''
  );
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return html;
}

export function isComposerHintParagraph(html: string): boolean {
  const t = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !t || t === NOTE_HINT;
}

/** HTML del shell del editor: nota editable + plantilla bloqueada. */
export function buildComposerShellHtml(
  noteHtml: string,
  lockedTemplateHtml: string
): string {
  const note = sanitizeEmailHtml(noteHtml || '') || `<p><br/></p>`;
  const locked = sanitizeEmailHtml(lockedTemplateHtml || '');
  const showHint = isComposerHintParagraph(note);
  const noteInner = showHint
    ? `<p><br/></p><p style="margin:0;color:#6B7280;font-size:12px;line-height:1.4;">${NOTE_HINT}</p>`
    : note;

  return `<div ${FF_COMPOSER_NOTE_ATTR}="1" style="outline:none;">${noteInner}</div>
<div ${FF_TEMPLATE_LOCKED_ATTR}="1" contenteditable="false" style="margin-top:16px;padding-top:16px;border-top:1px solid #E7EEF3;user-select:text;-webkit-user-select:text;">${locked}</div>`;
}

/** Extrae la nota del shell (ignora el hint vacío). */
export function extractComposerNoteHtml(shellHtml: string): string {
  const html = shellHtml || '';
  const re = new RegExp(
    `<div\\b[^>]*${FF_COMPOSER_NOTE_ATTR}="1"[^>]*>([\\s\\S]*?)</div>\\s*<div\\b[^>]*${FF_TEMPLATE_LOCKED_ATTR}`,
    'i'
  );
  const m = html.match(re);
  if (!m) {
    // Sin shell: todo es nota/cuerpo libre
    return sanitizeEmailHtml(html);
  }
  const note = sanitizeEmailHtml(m[1] || '');
  if (isComposerHintParagraph(note)) return '<p><br/></p>';
  return note;
}

export function shellHasLockedTemplate(shellHtml: string): boolean {
  return new RegExp(`${FF_TEMPLATE_LOCKED_ATTR}="1"`, 'i').test(shellHtml || '');
}

const TEMPLATE_SEND_SEP = '<!-- ff-template-separator -->';

/**
 * Extrae solo la nota editable cuando hay plantilla bloqueada.
 * Evita tratar el HTML íntegro de la plantilla como nota (duplicaba el cuerpo).
 */
export function extractNoteAgainstLockedTemplate(
  bodyHtml: string,
  lockedTemplateHtml: string
): string {
  const body = bodyHtml || '';
  const locked = lockedTemplateHtml || '';
  if (!locked) return extractComposerNoteHtml(body);

  if (shellHasLockedTemplate(body)) {
    return extractComposerNoteHtml(body);
  }

  if (body.includes(TEMPLATE_SEND_SEP)) {
    const note = sanitizeEmailHtml(body.split(TEMPLATE_SEND_SEP)[0] || '');
    return isComposerHintParagraph(note) ? '<p><br/></p>' : note;
  }

  const noteMark = body.match(
    /<div\b[^>]*data-ff-user-note="1"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (noteMark) {
    const note = sanitizeEmailHtml(noteMark[1] || '');
    return isComposerHintParagraph(note) ? '<p><br/></p>' : note;
  }

  const trimmedBody = body.trim();
  const trimmedLocked = locked.trim();
  if (!trimmedBody || trimmedBody === trimmedLocked) {
    return '<p><br/></p>';
  }

  // composeTemplateSendBody sin nota: body === locked
  // con nota: noteHtml + '\n' + locked (o prefijo antes del locked)
  const probe = trimmedLocked.slice(0, Math.min(160, trimmedLocked.length));
  if (probe && trimmedBody.includes(probe)) {
    const idx = trimmedBody.indexOf(probe);
    if (idx <= 0) return '<p><br/></p>';
    const note = sanitizeEmailHtml(trimmedBody.slice(0, idx));
    return isComposerHintParagraph(note) ? '<p><br/></p>' : note;
  }

  return extractComposerNoteHtml(body);
}

/**
 * Une nota + plantilla bloqueada para el envío.
 * Preferir `lockedTemplateHtml` del estado React (no el DOM, que puede degradarse).
 */
export function composeTemplateSendBody(input: {
  noteHtml: string;
  lockedTemplateHtml: string;
}): string {
  const locked = sanitizeEmailHtml(input.lockedTemplateHtml || '');
  const note = sanitizeEmailHtml(input.noteHtml || '');
  if (!locked) return note || '<p><br/></p>';
  if (!note || isComposerHintParagraph(note)) return locked;

  // Nota al inicio, separador invisible para reducir clip de Gmail
  return `<div data-ff-user-note="1" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111827;margin:0 0 20px;">${note}</div>
${TEMPLATE_SEND_SEP}
${locked}`;
}
