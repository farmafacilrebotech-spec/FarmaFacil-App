import { NextResponse, type NextRequest } from 'next/server';
import { appUrlFromHeaders } from '@/lib/auth/request-origin';
import { assertSameOriginPath } from '@/lib/auth/relative-redirect-path';

/**
 * Redirect de middleware conservando el Host del navegador.
 *
 * Next.js (NextURL) normaliza 127.0.0.1 → localhost al absolutizar. Eso rompe
 * cookies host-only. Estrategia:
 * 1) Construir URL absoluta desde el header Host (no desde nextUrl).
 * 2) Fijar Location manualmente (sin NextResponse.redirect).
 * 3) Arrancar el server con __NEXT_NO_MIDDLEWARE_URL_NORMALIZE=1 para que el
 *    adapter no reescriba la cabecera Location.
 */
export function middlewareRedirect(
  request: NextRequest,
  pathWithOptionalQuery: string
): NextResponse {
  const path = assertSameOriginPath(pathWithOptionalQuery);
  const absolute = appUrlFromHeaders(
    request.headers,
    // Fallback only if Host missing; prefer literal from headers.
    `http://${request.headers.get('host') || '127.0.0.1'}`,
    path
  );
  const response = new NextResponse(null, { status: 307 });
  response.headers.set('Location', absolute.href);
  return response;
}
