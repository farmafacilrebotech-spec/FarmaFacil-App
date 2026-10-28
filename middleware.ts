import type { NextRequest, NextResponse } from 'next/server';
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
    isPublicQuoteRoute(pathname);

  // Sin sesión en ruta protegida → login.
  // Nota: Next Edge puede normalizar 127.0.0.1→localhost en Location absoluta.
  // El flujo invite (callback→first-access) usa Location relativa y no pasa por aquí.
  // La redirección login→continue se hace en login/page.tsx con redirect() relativo.
  if (!user && !isPublicRoute) {
    const params = new URLSearchParams();
    // Nunca poner tokens (/q/...) ni secretos en ?next=
    const safeNext = pathname.startsWith('/q/') ? '/q' : pathname;
    params.set('next', safeNext);
    const response = middlewareRedirect(
      request,
      `/login?${params.toString()}`
    );
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
