import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Destinos internos permitidos tras el callback de Auth (allowlist).
 * Nunca redirigir a URLs absolutas ni a rutas arbitrarias vía ?next=.
 */
const ALLOWED_NEXT = new Set(['/first-access']);

function safeNextPath(raw: string | null): string {
  const fallback = '/first-access';
  if (!raw) return fallback;

  // Solo rutas relativas de la app.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }

  const pathOnly = raw.split('?')[0]?.split('#')[0] ?? fallback;
  if (!ALLOWED_NEXT.has(pathOnly)) {
    return fallback;
  }

  return pathOnly;
}

/**
 * Callback PKCE de Supabase Auth (@supabase/ssr fuerza flowType=pkce).
 * El email de invitación redirige aquí con ?code=...; se intercambia por
 * sesión y se escriben cookies SSR antes de ir a /first-access.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextPath = safeNextPath(url.searchParams.get('next'));

  if (!code) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.redirect(new URL(nextPath, request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.redirect(new URL(nextPath, request.url));
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession', error.message);
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('error', 'auth_callback');
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
