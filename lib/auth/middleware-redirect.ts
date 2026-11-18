import { NextResponse, type NextRequest } from 'next/server';
import { appUrlFromHeaders } from '@/lib/auth/request-origin';
import { assertSameOriginPath } from '@/lib/auth/relative-redirect-path';

/**
 * Redirect de middleware conservando el Host del navegador.
 *
 * PRE-05C / Next 13.5:
 * - `NextResponse.redirect(new URL(...))` y el adapter reescriben
 *   `127.0.0.1` → `localhost` en Location absoluta (rompe cookies host-only
 *   y provoca Failed to fetch / CORS en Server Actions).
 * - Location relativa (`/login`) provoca `Invalid URL` en el adapter al
 *   hacer `new NextURL(redirect)` (siempre, incluso con el flag).
 *
 * Estrategia correcta:
 * 1) URL absoluta desde el header Host (appUrlFromHeaders).
 * 2) Fijar Location manualmente (sin NextResponse.redirect).
 * 3) Arrancar con `__NEXT_NO_MIDDLEWARE_URL_NORMALIZE=1` para que el
 *    adapter no reescriba la cabecera Location.
 */
export function middlewareRedirect(
  request: NextRequest,
  pathWithOptionalQuery: string
): NextResponse {
  const path = assertSameOriginPath(pathWithOptionalQuery);
  const absolute = appUrlFromHeaders(
    request.headers,
    `http://${request.headers.get('host') || '127.0.0.1'}`,
    path
  );
  const response = new NextResponse(null, { status: 307 });
  response.headers.set('Location', absolute.href);
  return response;
}
