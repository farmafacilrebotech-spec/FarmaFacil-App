/**
 * URL pública canónica de la app (auth, emails, callbacks).
 * No usar previews de Vercel/Netlify: las cookies de sesión no son intercambiables.
 */

export const CANONICAL_PRODUCTION_APP_URL =
  'https://app.farmafacil.solutions';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLocalHost(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Hosts de despliegue efímero: no válidos para enlaces de Auth en producción. */
export function isEphemeralDeployHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    host === 'vercel.app' ||
    host === 'netlify.app'
  );
}

/**
 * URL base para redirects Auth / emails.
 * Producción: NEXT_PUBLIC_APP_URL | APP_URL si es estable; si falta o es
 * preview (*.vercel.app), usa el dominio canónico.
 * Desarrollo: configurada o http://localhost:3000.
 */
export function getAppBaseUrl(): string | null {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    ''
  ).replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    if (configured && !isLocalHost(configured)) {
      try {
        const host = new URL(configured).hostname;
        if (!isEphemeralDeployHost(host)) {
          return stripTrailingSlash(configured);
        }
        console.warn(
          '[app-url] URL de preview ignorada para Auth; se usa el dominio canónico',
          host
        );
      } catch {
        console.warn('[app-url] URL de app inválida; se usa el dominio canónico');
      }
    } else if (!configured) {
      console.warn(
        '[app-url] NEXT_PUBLIC_APP_URL/APP_URL ausente; se usa el dominio canónico'
      );
    } else {
      console.error('[app-url] URL localhost no permitida en producción');
      return null;
    }
    return CANONICAL_PRODUCTION_APP_URL;
  }

  if (configured) return stripTrailingSlash(configured);
  return 'http://localhost:3000';
}
