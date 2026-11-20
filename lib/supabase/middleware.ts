import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function readSupabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  // Vercel a veces muestra/almacena sobres eyJ2Ijoi…; una URL real debe ser https://
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    return null;
  }
  // Anon key JWT típico (eyJhbG…), no sobre cifrado eyJ2Ijoi…
  if (!anonKey.startsWith('eyJ') || anonKey.startsWith('eyJ2Ijoi')) {
    return null;
  }
  if (anonKey.split('.').length < 3) {
    return null;
  }
  return { url, anonKey };
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const env = readSupabasePublicEnv();
  if (!env) {
    // No tumbar Edge con throw: MIDDLEWARE_INVOCATION_FAILED.
    console.error(
      '[middleware] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY ausentes o con formato inválido'
    );
    return { supabaseResponse, user: null };
  }

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Importante: getUser() revalida el JWT; no usar solo getSession() aquí.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabaseResponse, user };
  } catch (err) {
    console.error(
      '[middleware] updateSession failed',
      err instanceof Error ? err.message : err
    );
    return {
      supabaseResponse: NextResponse.next({ request }),
      user: null,
    };
  }
}
