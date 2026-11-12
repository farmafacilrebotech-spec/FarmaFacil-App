/**
 * Sanitización HTML para compositor / plantillas (sin dependencias).
 * Bloquea scripts, handlers y contenido activo.
 */

const BLOCKED_TAGS =
  /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|svg|math)[^>]*>/gi;

const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const DANGEROUS_URL =
  /\s+(href|src|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]*)/gi;

/** Quita marcado peligroso; conserva formato visual básico. */
export function sanitizeEmailHtml(raw: string): string {
  let html = raw || '';
  html = html.replace(BLOCKED_TAGS, '');
  html = html.replace(EVENT_ATTRS, '');
  html = html.replace(DANGEROUS_URL, '');
  // data: excepto imágenes png/jpeg/gif/webp
  html = html.replace(
    /\s+src\s*=\s*(?:"(data:(?!image\/(?:png|jpeg|jpg|gif|webp))[^"]*)"|'(data:(?!image\/(?:png|jpeg|jpg|gif|webp))[^']*)')/gi,
    ''
  );
  return html;
}

/** Texto plano a partir de HTML (alternativa MIME). */
export function htmlToPlainText(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Proxy de imágenes remotas en lectura: por defecto no cargar tracking.
 * En compositor usamos src locales o data:; remotas se marcan data-ff-remote.
 */
export function markRemoteImagesAsBlocked(html: string): string {
  return (html || '').replace(
    /<img\b([^>]*?)\bsrc\s*=\s*("https?:\/\/[^"]*"|'https?:\/\/[^']*')([^>]*)>/gi,
    (_m, pre, src, post) =>
      `<img${pre}data-ff-remote-src=${src} src="" alt="Imagen remota bloqueada"${post}>`
  );
}

/** Extrae el interior de <body> para editar sin DOCTYPE/head. */
export function extractComposerEditableHtml(raw: string): string {
  const html = raw || '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return sanitizeEmailHtml(bodyMatch[1].trim() || '<p><br/></p>');
  }
  return sanitizeEmailHtml(html.trim() || '<p><br/></p>');
}

/**
 * Si el contenido ya es documento completo, se respeta (sanitizado).
 * Si es fragmento del editor, se envuelve en cáscara corporativa mínima.
 */
export function wrapComposerHtmlForSend(editableHtml: string): string {
  const cleaned = sanitizeEmailHtml(editableHtml || '');
  if (/<html[\s>]/i.test(cleaned) || /<!DOCTYPE/i.test(cleaned)) {
    return cleaned;
  }
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>FarmaFácil</title></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F8FAFC;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#FFFFFF;border:1px solid #E7EEF3;border-radius:12px;">
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111827;">
              ${cleaned}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
