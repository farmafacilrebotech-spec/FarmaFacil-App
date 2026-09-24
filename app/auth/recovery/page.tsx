'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Callback de recovery compatible con los tres formatos que puede emitir Auth:
 *   A) ?code=...                         (PKCE)
 *   B) ?token_hash=...&type=recovery
 *   C) #access_token=...&type=recovery   (fragment; NUNCA llega a un Route Handler)
 *
 * Importante:
 * - No hacer signOut antes de exchangeCodeForSession: borraría el code_verifier PKCE.
 * - setSession / exchange sustituyen la sesión previa (usuario B) por la de recovery (A).
 */
export default function AuthRecoveryPage() {
  const [message] = React.useState('Validando enlace de recuperación…');

  React.useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const tokenHash =
        url.searchParams.get('token_hash') ?? url.searchParams.get('tokenHash');
      const otpType = url.searchParams.get('type');

      const hashParams = new URLSearchParams(
        window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash
      );
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashType = hashParams.get('type');

      try {
        if (code) {
          // PKCE: el verifier está en cookies. No tocar signOut antes.
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[auth/recovery] exchangeCodeForSession', error.message);
            throw error;
          }
        } else if (tokenHash && (!otpType || otpType === 'recovery')) {
          // token_hash no depende del verifier: sí podemos limpiar sesión B antes.
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) {
            console.error('[auth/recovery] verifyOtp', error.message);
            throw error;
          }
        } else if (accessToken && refreshToken) {
          if (hashType && hashType !== 'recovery') {
            console.error('[auth/recovery] unexpected hash type', hashType);
            throw new Error(`unexpected hash type: ${hashType}`);
          }
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('[auth/recovery] setSession', error.message);
            throw error;
          }
        } else {
          // createBrowserClient puede haber consumido el hash vía detectSessionInUrl.
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            if (!cancelled) {
              window.location.replace('/forgot-password?error=recovery_missing');
            }
            return;
          }
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error(
            '[auth/recovery] getUser after recovery',
            userError?.message ?? 'no user'
          );
          if (!cancelled) {
            window.location.replace('/forgot-password?error=recovery_invalid');
          }
          return;
        }

        if (!cancelled) {
          window.location.replace('/reset-password');
        }
      } catch (err) {
        console.error('[auth/recovery] failed', err);
        if (!cancelled) {
          window.location.replace('/forgot-password?error=recovery_invalid');
        }
      }
    }

    void establishRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        Si no avanzas en unos segundos, solicita un nuevo enlace.
      </p>
    </div>
  );
}
