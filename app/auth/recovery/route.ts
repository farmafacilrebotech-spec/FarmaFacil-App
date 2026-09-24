import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Callback dedicado a recovery de contraseña.
 * Separado de /auth/callback (invitaciones) para no mezclar OTP types.
 *
 * Entradas:
 *   ?token_hash=...&type=recovery
 *   ?code=...   (PKCE)
 *
 * Destino fijo: /reset-password (sin open redirect).
 */
function createRecoveryClient(request: NextRequest) {
  const nextPath = '/reset-password';
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

function redirectToForgotPassword(request: NextRequest, errorCode: string) {
  const url = request.nextUrl.clone();
  url.pathname = '/forgot-password';
  url.search = '';
  url.searchParams.set('error', errorCode);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  const code = url.searchParams.get('code');

  if (tokenHash && otpType) {
    if (otpType !== 'recovery') {
      console.error('[auth/recovery] unexpected otp type', otpType);
      return redirectToForgotPassword(request, 'recovery_invalid');
    }

    const { supabase, getResponse } = createRecoveryClient(request);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });

    if (error) {
      console.error('[auth/recovery] verifyOtp', error.message);
      return redirectToForgotPassword(request, 'recovery_invalid');
    }

    return getResponse();
  }

  if (code) {
    const { supabase, getResponse } = createRecoveryClient(request);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/recovery] exchangeCodeForSession', error.message);
      return redirectToForgotPassword(request, 'recovery_invalid');
    }

    return getResponse();
  }

  return redirectToForgotPassword(request, 'recovery_missing');
}
