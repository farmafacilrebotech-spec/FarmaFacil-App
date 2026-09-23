import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Destinos internos permitidos tras el callback de Auth (allowlist).
 * Nunca redirigir a URLs absolutas ni a rutas arbitrarias vía ?next=.
 */
const ALLOWED_NEXT = new Set(['/first-access', '/auth/invitations']);

/**
 * Devuelve path allowlisted. Para /auth/invitations permite ?for=email
 * solo como ayuda UX (no autoriza).
 */
function safeNextPath(raw: string | null): string {
  const fallback = '/first-access';
  if (!raw) return fallback;

  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }

  const pathOnly = raw.split('?')[0]?.split('#')[0] ?? fallback;
  if (!ALLOWED_NEXT.has(pathOnly)) {
    return fallback;
  }

  if (pathOnly === '/auth/invitations') {
    const qIndex = raw.indexOf('?');
    if (qIndex !== -1) {
      const params = new URLSearchParams(raw.slice(qIndex + 1).split('#')[0]);
      const forEmail = (params.get('for') ?? '').trim().toLowerCase();
      if (forEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forEmail)) {
        return `/auth/invitations?for=${encodeURIComponent(forEmail)}`;
      }
    }
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

const ALLOWED_OTP: EmailOtpType[] = ['invite', 'magiclink', 'email'];

/**
 * Callback Auth SSR.
 *
 * Usuario NUEVO (inviteUserByEmail):
 *   ?token_hash=...&type=invite&next=/first-access
 *
 * Usuario EXISTENTE (magic link FarmaFácil, token_hash SSR):
 *   ?token_hash=...&type=magiclink|email&next=/auth/invitations?for=email
 *
 * PKCE:
 *   ?code=... → exchangeCodeForSession
 *
 * No trata recovery aquí: recovery no está en la allowlist de OTP.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  const code = url.searchParams.get('code');
  const nextPath = safeNextPath(url.searchParams.get('next'));

  if (tokenHash && otpType) {
    if (!ALLOWED_OTP.includes(otpType as EmailOtpType)) {
      // p.ej. type=recovery no debe entrar por este callback de invitaciones.
      return redirectToLogin(request, 'auth_callback');
    }

    const { supabase, getResponse } = createCallbackClient(request, nextPath);
    // Asegura que la nueva sesión sustituya cualquier sesión previa del navegador.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });

    if (error) {
      console.error('[auth/callback] verifyOtp', error.message);
      return redirectToLogin(request, 'auth_callback');
    }

    return getResponse();
  }

  if (code) {
    const { supabase, getResponse } = createCallbackClient(request, nextPath);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession', error.message);
      return redirectToLogin(request, 'auth_callback');
    }

    return getResponse();
  }

  return redirectToLogin(request, 'missing_code');
}
