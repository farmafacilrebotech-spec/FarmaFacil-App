import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const AUTH_ROUTES = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/first-access',
  '/invite',
]);

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

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  if (user && pathname === '/login') {
    return redirectWithSession(request, '/dashboard', supabaseResponse, true);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Excluye estáticos y assets públicos.
     * No anticipa rutas públicas QR/kiosco futuras.
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
