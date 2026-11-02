import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { authFlowDiag } from '@/lib/auth/auth-flow-diag';
import { appUrlFromHeaders } from '@/lib/auth/request-origin';
import { redirectRelative } from '@/lib/auth/relative-redirect';
import { classifyAuthCallbackError } from '@/lib/pharmacies/invite-auth-logic';

function appUrl(request: NextRequest, pathWithOptionalQuery: string): URL {
  return appUrlFromHeaders(
    request.headers,
    request.nextUrl.origin,
    pathWithOptionalQuery
  );
}

/** Prefer relative Location so Edge/Node cannot rewrite 127.0.0.1 → localhost. */
function redirectToPath(pathWithOptionalQuery: string): NextResponse {
  return redirectRelative(pathWithOptionalQuery);
}

/**
 * Destinos internos permitidos tras el callback de Auth (allowlist).
 * Nunca redirigir a URLs absolutas ni a rutas arbitrarias vía ?next=.
 */
const ALLOWED_NEXT = new Set(['/first-access', '/auth/invitations']);

/** Rutas de cuenta cliente tras confirmar email (allowlist cerrada). */
const ALLOWED_CUSTOMER_NEXT = new Set([
  '/cuenta',
  '/cuenta/mis-farmacias',
  '/cuenta/entrar',
]);

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

  if (ALLOWED_CUSTOMER_NEXT.has(pathOnly)) {
    return pathOnly;
  }
  // /e/{publicId}/cuenta — contexto farmacia tras confirmar registro
  if (/^\/e\/[a-z0-9][a-z0-9\-]{2,63}\/cuenta$/.test(pathOnly)) {
    return pathOnly;
  }

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

function loginPathForNext(nextPath: string): string {
  if (
    nextPath === '/cuenta' ||
    nextPath.startsWith('/cuenta/') ||
    /^\/e\/[^/]+\/cuenta$/.test(nextPath)
  ) {
    const m = nextPath.match(/^(\/e\/[^/]+)\/cuenta$/);
    return m ? `${m[1]}/cuenta/entrar` : '/cuenta/entrar';
  }
  return '/login';
}

function redirectToLogin(
  _request: NextRequest,
  errorCode: string,
  nextPath = '/first-access'
) {
  const base = loginPathForNext(nextPath);
  return redirectToPath(`${base}?error=${encodeURIComponent(errorCode)}`);
}

function createCallbackClient(request: NextRequest, nextPath: string) {
  let response = redirectToPath(nextPath);

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
          response = redirectToPath(nextPath);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, getResponse: () => response };
}

const ALLOWED_OTP: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'email',
];

/**
 * Callback Auth SSR.
 *
 * Usuario NUEVO (generateLink invite + Resend):
 *   ?token_hash=...&type=invite&next=/first-access
 *
 * Usuario EXISTENTE (magic link FarmaFácil, token_hash SSR):
 *   ?token_hash=...&type=magiclink|email&next=/auth/invitations?for=email
 *
 * PKCE (legacy / redirect Supabase):
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
  authFlowDiag('callback_enter', {
    path: url.pathname,
    otp_param_present: Boolean(tokenHash),
    has_code: Boolean(code),
    otp_type: otpType,
    next_path: nextPath,
    request_host: request.headers.get('host'),
    public_origin_host: appUrl(request, '/').host,
  });

  if (tokenHash && otpType) {
    if (!ALLOWED_OTP.includes(otpType as EmailOtpType)) {
      authFlowDiag('callback_redirect', {
        reason: 'otp_type_not_allowed',
        otp_type: otpType,
        redirect_to: '/login',
        error_code: 'auth_callback',
      });
      return redirectToLogin(request, 'auth_callback', nextPath);
    }

    const { supabase, getResponse } = createCallbackClient(request, nextPath);
    // Evitar signOut previo: en SSR regenera Set-Cookie vacíos que compiten con
    // la sesión nueva; verifyOtp ya sustituye la sesión del navegador.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });

    if (error) {
      console.error('[auth/callback] verifyOtp', error.message);
      const { code: errorCode } = classifyAuthCallbackError(error.message);
      const failLogin = loginPathForNext(nextPath);
      authFlowDiag('callback_redirect', {
        reason: 'verify_otp_failed',
        otp_type: otpType,
        verify_ok: false,
        error_code: errorCode,
        redirect_to: failLogin,
        has_session: false,
        redirect_host: appUrl(request, failLogin).host,
      });
      return redirectToLogin(request, errorCode, nextPath);
    }

    authFlowDiag('callback_redirect', {
      reason: 'verify_otp_ok',
      otp_type: otpType,
      verify_ok: true,
      has_session: true,
      redirect_to: nextPath,
      location_style: 'relative',
      request_host: request.headers.get('host'),
    });
    return getResponse();
  }

  if (code) {
    const { supabase, getResponse } = createCallbackClient(request, nextPath);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession', error.message);
      const { code: errorCode } = classifyAuthCallbackError(error.message);
      authFlowDiag('callback_redirect', {
        reason: 'exchange_code_failed',
        verify_ok: false,
        error_code: errorCode,
        redirect_to: loginPathForNext(nextPath),
        has_session: false,
      });
      return redirectToLogin(request, errorCode, nextPath);
    }

    authFlowDiag('callback_redirect', {
      reason: 'exchange_code_ok',
      verify_ok: true,
      has_session: true,
      redirect_to: nextPath,
      redirect_host: appUrl(request, nextPath).host,
    });
    return getResponse();
  }

  authFlowDiag('callback_redirect', {
    reason: 'missing_token_and_code',
    redirect_to: loginPathForNext(nextPath),
    error_code: 'missing_code',
    has_session: false,
  });
  return redirectToLogin(request, 'missing_code', nextPath);
}
