import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { middlewareRedirect } from '@/lib/auth/middleware-redirect';

const AUTH_ROUTES = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/first-access',
  '/auth/callback',
  '/auth/invite-open',
  '/auth/recovery',
]);

function isPublicLegalRoute(pathname: string): boolean {
  return pathname === '/legal' || pathname.startsWith('/legal/');
}

function isPublicKioskRoute(pathname: string): boolean {
  return pathname === '/k' || pathname.startsWith('/k/');
}

function isPublicEntrypointRoute(pathname: string): boolean {
  return pathname === '/e' || pathname.startsWith('/e/');
}

/**
 * Área cliente FarmaFácil (PWA /cuenta).
 * Nunca redirigir al login del panel de farmacia (/login).
 * Cada página aplica su propio gate de cliente (entrar / Mis farmacias).
 */
function isPublicCustomerAccountRoute(pathname: string): boolean {
  return pathname === '/cuenta' || pathname.startsWith('/cuenta/');
}

/** Presupuesto público R4: /q/[token] — sin sesión. */
function isPublicQuoteRoute(pathname: string): boolean {
  return pathname === '/q' || pathname.startsWith('/q/');
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const isPublicRoute =
    isAuthRoute ||
    isPublicLegalRoute(pathname) ||
    isPublicKioskRoute(pathname) ||
    isPublicEntrypointRoute(pathname) ||
    isPublicCustomerAccountRoute(pathname) ||
    isPublicQuoteRoute(pathname);

  // Sin sesión en ruta protegida → login del panel (farmacia/plataforma).
  // /cuenta y /e/* son públicos: no usar /login ahí.
  // PRE-05C: Location absoluta desde Host + arranque con
  // __NEXT_NO_MIDDLEWARE_URL_NORMALIZE=1 (si no, Next reescribe 127.0.0.1→localhost
  // y las Server Actions fallan con Failed to fetch / CORS).
  // Location relativa no sirve en middleware Next 13.5 (Invalid URL en adapter).
  if (!user && !isPublicRoute) {
    const params = new URLSearchParams();
    // Nunca poner tokens (/q/...) ni secretos en ?next=
    // Tampoco devolver al área cliente vía ?next= del login de farmacia.
    const safeNext = pathname.startsWith('/q/')
      ? '/q'
      : pathname.startsWith('/cuenta')
        ? '/'
        : pathname;
    params.set('next', safeNext);
    const response = middlewareRedirect(
      request,
      `/login?${params.toString()}`
    );
    // Next 13.5 / Edge: set name+value+options (no pasar el objeto crudo).
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value);
    });
    return response;
  }

  // Presupuesto público: sin caché CDN/navegador (el token va en la URL).
  if (isPublicQuoteRoute(pathname)) {
    supabaseResponse.headers.set(
      'Cache-Control',
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
    supabaseResponse.headers.set('Referrer-Policy', 'no-referrer');
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  // Staging permanente: noindex en todas las rutas HTML.
  const stagingEnv =
    (process.env.FF_APP_ENV ?? '').trim().toLowerCase() === 'staging';
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (
    stagingEnv ||
    host === 'staging.farmafacil.solutions' ||
    host.includes('farmafacil-staging')
  ) {
    supabaseResponse.headers.set(
      'X-Robots-Tag',
      'noindex, nofollow, noarchive'
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Excluir estáticos PWA/cliente: no deben pasar por auth ni acabar en /login.
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|fonts/|icons/|manifest\\.webmanifest|sw-customer\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)',
  ],
};
