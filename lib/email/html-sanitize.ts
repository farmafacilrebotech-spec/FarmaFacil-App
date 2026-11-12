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
