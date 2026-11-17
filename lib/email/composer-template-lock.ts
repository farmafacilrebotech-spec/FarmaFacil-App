/**
 * Plantilla corporativa bloqueada en el compositor.
 *
 * Causa raíz (pérdida de contenido): contentEditable destruye tablas/HTML
 * complejo al teclear. Solución: la plantilla vive en un bloque
 * contenteditable=false; el usuario solo edita una nota opcional encima.
 */

export const FF_COMPOSER_NOTE_ATTR = 'data-ff-composer-note';
export const FF_TEMPLATE_LOCKED_ATTR = 'data-ff-template-locked';

/** Placeholder UI del área de nota — nunca debe viajar a Resend. */
export const COMPOSER_NOTE_HINT =
  'Escribe aquí un mensaje adicional (opcional). La plantilla corporativa de debajo se conserva intacta.';

/** Textos de ayuda exclusivos de la UI del compositor (no contenido del mensaje). */
export const COMPOSER_UI_HINTS: readonly string[] = [
  COMPOSER_NOTE_HINT,
  'Escribe solo en la zona superior. El HTML original de la plantilla no se modifica al cambiar asunto, destinatario o firma.',
  'Nota adicional (editable) · Plantilla corporativa bloqueada debajo',
];

/** @deprecated usar COMPOSER_NOTE_HINT */
const NOTE_HINT = COMPOSER_NOTE_HINT;

function normalizeHintText(raw: string): string {
  return (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownComposerUiHintText(text: string): boolean {
  const t = normalizeHintText(text);
  if (!t) return true;
  return COMPOSER_UI_HINTS.some((h) => t === h);
}

/**
 * Elimina párrafos/bloques cuyo texto es solo ayuda del compositor.
 * Conserva la nota real del usuario aunque el hint haya quedado como hermano.
 */
export function stripComposerUiHints(html: string): string {
  let out = sanitizeEmailHtml(html || '');
  // Párrafos (con o sin style) cuyo texto coincide con un hint conocido
  out = out.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (block) => {
    return isKnownComposerUiHintText(block) ? '' : block;
  });
  // Texto suelto del hint (sin envolver) si el DOM lo aplastó
  for (const hint of COMPOSER_UI_HINTS) {
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), '');
  }
  out = out.replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>');
  const plain = normalizeHintText(out);
  if (!plain) {
    return '<p><br/></p>';
  }
  return out.trim() || '<p><br/></p>';
}

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
  const stripped = stripComposerUiHints(html);
  return isKnownComposerUiHintText(stripped);
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
  return stripComposerUiHints(m[1] || '');
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
    return stripComposerUiHints(body.split(TEMPLATE_SEND_SEP)[0] || '');
  }

  const noteMark = body.match(
    /<div\b[^>]*data-ff-user-note="1"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (noteMark) {
    return stripComposerUiHints(noteMark[1] || '');
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
    return stripComposerUiHints(trimmedBody.slice(0, idx));
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
  const note = stripComposerUiHints(input.noteHtml || '');
  if (!locked) return isComposerHintParagraph(note) ? '<p><br/></p>' : note;
  if (isComposerHintParagraph(note)) return locked;

  // Nota al inicio, separador invisible para reducir clip de Gmail
  return `<div data-ff-user-note="1" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111827;margin:0 0 20px;">${note}</div>
${TEMPLATE_SEND_SEP}
${locked}`;
}
