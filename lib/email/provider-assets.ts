/**
 * Reescritura de assets de imagen para HTML enviado a Resend.
 *
 * Causa EMAIL-01: el compositor carga plantillas en imageMode=preview
 * (localhost / rutas relativas). Gmail no puede resolverlas.
 *
 * Destinos estables (HTTP 200 verificados):
 * - Foto / logo: https://www.farmafacil.solutions/...
 * - Iconos módulo: https://app.farmafacil.solutions/images/kiosk/...
 */

export const FF_EMAIL_WWW_ORIGIN = 'https://www.farmafacil.solutions';
export const FF_EMAIL_APP_ORIGIN = 'https://app.farmafacil.solutions';

const PHOTO_PUBLIC = `${FF_EMAIL_WWW_ORIGIN}/images/email/firma-pilar.png`;
const LOGO_PUBLIC = `${FF_EMAIL_WWW_ORIGIN}/images/logo/farmafacil-logo.png`;

const PATH_MAP: Record<string, string> = {
  '/images/email/firma-pilar.png': PHOTO_PUBLIC,
  '/images/logo/farmafacil-logo.png': LOGO_PUBLIC,
  // mark local no existe en www → logo circular oficial
  '/images/logos/farmafacil-mark.png': LOGO_PUBLIC,
  '/images/kiosk/kiosk-qr.png': `${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-qr.png`,
  '/images/kiosk/kiosk-cart.png': `${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-cart.png`,
  '/images/kiosk/kiosk-search.png': `${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-search.png`,
  '/images/kiosk/kiosk-ai.png': `${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-ai.png`,
};

function normalizePath(pathname: string): string {
  const p = pathname.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) return `/${p}`;
  return p;
}

/** Resuelve una URL/ruta de imagen a HTTPS público estable. */
export function resolveProviderAssetUrl(src: string): string {
  const raw = (src || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('data:image/')) return raw;

  // Ruta relativa de la app
  if (raw.startsWith('/images/')) {
    const mapped = PATH_MAP[normalizePath(raw)];
    if (mapped) return mapped;
    // Resto de /images/* → origen app (estáticos Next públicos)
    return `${FF_EMAIL_APP_ORIGIN}${normalizePath(raw)}`;
  }

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const path = normalizePath(u.pathname);

    // Preferir www para foto/logo (los que ya funcionan en Gmail)
    if (path === '/images/email/firma-pilar.png') return PHOTO_PUBLIC;
    if (path === '/images/logo/farmafacil-logo.png') return LOGO_PUBLIC;
    if (path === '/images/logos/farmafacil-mark.png') return LOGO_PUBLIC;

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local')
    ) {
      const mapped = PATH_MAP[path];
      if (mapped) return mapped;
      if (path.startsWith('/images/')) {
        return `${FF_EMAIL_APP_ORIGIN}${path}`;
      }
      return raw;
    }

    // Preview :3065 u otros orígenes de la app → públicos
    if (
      path.startsWith('/images/') &&
      (host.includes('farmafacil') || /^\d+\.\d+\.\d+\.\d+$/.test(host))
    ) {
      const mapped = PATH_MAP[path];
      if (mapped) return mapped;
      return `${FF_EMAIL_APP_ORIGIN}${path}`;
    }

    return raw;
  } catch {
    return raw;
  }
}

/**
 * Reescribe todos los src de <img> a URLs HTTPS públicas.
 * No toca enlaces href (salvo que sean img).
 */
export function rewriteEmailHtmlAssetsForProvider(html: string): string {
  return (html || '').replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_m, pre: string, quote: string, src: string) => {
      const next = resolveProviderAssetUrl(src);
      return `${pre}${quote}${next}${quote}`;
    }
  );
}

/** true si el HTML aún tiene assets no enviables (relativos o localhost). */
export function htmlHasNonPublicImageSrc(html: string): boolean {
  const srcs = Array.from(
    (html || '').matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)
  ).map((m) => m[1]);
  return srcs.some((src) => {
    if (src.startsWith('data:image/')) return false;
    if (src.startsWith('/')) return true;
    try {
      const u = new URL(src);
      return (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.protocol === 'http:'
      );
    } catch {
      return true;
    }
  });
}
