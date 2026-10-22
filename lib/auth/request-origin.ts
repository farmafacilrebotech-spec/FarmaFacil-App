/**
 * Origen público de la petición (Host / X-Forwarded-*).
 *
 * Next puede reescribir `127.0.0.1` → `localhost` al usar
 * `new URL(path, request.url)`. Las cookies Auth son host-only: si Set-Cookie
 * se emite en 127.0.0.1 y Location apunta a localhost, /first-access llega
 * sin sesión («Enlace de invitación requerido»).
 */

export type RequestOriginHeaders = {
  get(name: string): string | null;
};

export function requestPublicOriginFromHeaders(
  headers: RequestOriginHeaders,
  fallbackOrigin: string
): string {
  const host =
    headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headers.get('host')?.trim() ||
    '';

  if (!host) {
    return fallbackOrigin.replace(/\/$/, '');
  }

  const forwardedProto = headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();

  let proto = forwardedProto;
  if (!proto) {
    try {
      proto = new URL(fallbackOrigin).protocol.replace(':', '') || 'http';
    } catch {
      proto = 'http';
    }
  }

  return `${proto}://${host}`;
}

export function appUrlFromHeaders(
  headers: RequestOriginHeaders,
  fallbackOrigin: string,
  pathWithOptionalQuery: string
): URL {
  return new URL(
    pathWithOptionalQuery,
    requestPublicOriginFromHeaders(headers, fallbackOrigin)
  );
}
