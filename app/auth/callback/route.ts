import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Destinos internos permitidos tras el callback de Auth (allowlist).
 * Nunca redirigir a URLs absolutas ni a rutas arbitrarias vía ?next=.
 */
const ALLOWED_NEXT = new Set(['/first-access', '/auth/invitations']);

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

function redirectToLogin(request: NextRequest, errorCode: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('error', errorCode);
  return NextResponse.redirect(loginUrl);
}

function createCallbackClient(request: NextRequest, nextPath: string) {
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

  return { supabase, getResponse: () => response };
}

/**
 * Callback Auth SSR.
 *
 * Flujo invitación usuario NUEVO (Admin inviteUserByEmail):
 *   ?token_hash=...&type=invite&next=/first-access → verifyOtp → /first-access
 *
 * Flujo usuario EXISTENTE (magic link FarmaFácil):
 *   ?token_hash=...&type=magiclink|email&next=/auth/invitations → verifyOtp → /auth/invitations
 *
 * Flujo opcional PKCE:
 *   ?code=... → exchangeCodeForSession → next allowlisted
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  const code = url.searchParams.get('code');
  const nextPath = safeNextPath(url.searchParams.get('next'));

  // 1) OTP por token_hash (invite Auth o magiclink).
  if (tokenHash && otpType) {
    const allowedOtp =
      otpType === 'invite' ||
      otpType === 'magiclink' ||
      otpType === 'email';
    if (!allowedOtp) {
      return redirectToLogin(request, 'auth_callback');
    }

    const { supabase, getResponse } = createCallbackClient(request, nextPath);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (error) {
      console.error('[auth/callback] verifyOtp', error.message);
      return redirectToLogin(request, 'auth_callback');
    }

    return getResponse();
  }

  // 2) PKCE code exchange (otros flujos Auth que sí envían ?code=).
  if (code) {
    const { supabase, getResponse } = createCallbackClient(request, nextPath);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession', error.message);
      return redirectToLogin(request, 'auth_callback');
    }

    return getResponse();
  }

  // Sin token_hash ni code: enlace incompleto / plantilla incorrecta / ya consumido sin params.
  return redirectToLogin(request, 'missing_code');
}
