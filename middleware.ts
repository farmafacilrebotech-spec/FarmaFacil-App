import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const AUTH_ROUTES = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/first-access',
  // Auth callback: token_hash/invite o ?code= sin sesión previa.
  '/auth/callback',
  // Recovery de contraseña (separado de invitaciones).
  '/auth/recovery',
]);

/** Documentos legales públicos (sin sesión). */
function isPublicLegalRoute(pathname: string): boolean {
  return pathname === '/legal' || pathname.startsWith('/legal/');
}

/**
 * Runtime kiosko (tablet): sin login de usuario humano.
 * La sesión de dispositivo va en cookie HttpOnly propia; NO autoriza /f ni panel.
 */
function isPublicKioskRoute(pathname: string): boolean {
  return pathname === '/k' || pathname.startsWith('/k/');
}

/** Destino público del QR de farmacia (no autentica). */
function isPublicEntrypointRoute(pathname: string): boolean {
  return pathname === '/e' || pathname.startsWith('/e/');
}

/**
 * Cualquier redirect debe preservar las cookies que updateSession
 * acaba de refrescar. Si se pierden, el Server Component no ve sesión
 * y el layout redirige a /login → bucle con este middleware.
 */
function redirectWithSession(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
  clearSearch = false
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (clearSearch) {
    url.search = '';
  }
  const response = NextResponse.redirect(url);
  // Conservar cookies de sesión (incl. refresh) que updateSession acaba de escribir.
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const isPublicRoute =
    isAuthRoute ||
    isPublicLegalRoute(pathname) ||
    isPublicKioskRoute(pathname) ||
    isPublicEntrypointRoute(pathname);

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  // Con sesión en /login → resolver destino (plataforma vs farmacia).
  // Nunca forzar /dashboard: los usuarios de farmacia no son SuperAdmin.
  // /first-access, /reset-password y /forgot-password NO se redirigen aquí
  // (están en AUTH_ROUTES; recovery debe poder completar el cambio de clave).
  if (user && pathname === '/login') {
    return redirectWithSession(request, '/auth/continue', supabaseResponse, true);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Excluye estáticos y assets públicos.
     * Rutas /k/* son públicas (sesión de dispositivo, no de usuario).
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
