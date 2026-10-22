'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, ArrowLeft, CheckCircle2, Send } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import {
  RECOVERY_REQUEST_SUCCESS_MESSAGE,
  buildPasswordRecoveryRedirectTo,
  isValidRecoveryEmail,
  mapPasswordRecoveryAuthError,
} from '@/lib/auth/password-recovery-shared';

/**
 * Pantalla de SOLICITUD de recuperación.
 * No exige token ni sesión previa. Los errores ?error=recovery_* solo informan
 * de un enlace anterior inválido; el formulario sigue siendo usable.
 */
function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState('');
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const linkError = searchParams.get('error');
  const linkErrorMessage =
    linkError === 'recovery_invalid'
      ? 'El enlace de recuperación no es válido o ha caducado. Puedes solicitar uno nuevo aquí.'
      : linkError === 'recovery_missing'
        ? 'No se encontró un enlace de recuperación válido en la URL. Si llegaste desde el correo, solicita uno nuevo. Esta pantalla no requiere un enlace previo.'
        : null;

  React.useEffect(() => {
    // Limpia ?error= de la barra al montar para no confundir una nueva solicitud.
    if (linkError) {
      router.replace('/forgot-password', { scroll: false });
    }
    // Solo al montar / cuando cambia el error entrante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalized = email.trim().toLowerCase();
    if (!isValidRecoveryEmail(normalized)) {
      setLoading(false);
      setError('El email no es válido.');
      setSentMessage(null);
      return;
    }

    try {
      // Cliente browser: PKCE + redirectTo = origen de esta pestaña (127.0.0.1:3010).
      const supabase = createClient();
      const redirectTo = buildPasswordRecoveryRedirectTo(window.location.origin);
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        normalized,
        { redirectTo }
      );

      if (authError) {
        const mapped = mapPasswordRecoveryAuthError(authError.message);
        setError(mapped.error);
        setSentMessage(null);
        setLoading(false);
        return;
      }

      setSentMessage(RECOVERY_REQUEST_SUCCESS_MESSAGE);
    } catch {
      setError(
        'No se ha podido iniciar la recuperación de contraseña. Inténtalo de nuevo más tarde.'
      );
      setSentMessage(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={96} showTagline />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        {!sentMessage ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Recuperar contraseña
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Te enviaremos un enlace para restablecer tu contraseña
              </p>
            </div>

            {(error || linkErrorMessage) && (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error ?? linkErrorMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.es"
                    className="h-11 pl-9"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full gap-1.5"
                size="lg"
                disabled={loading}
              >
                <Send className="h-4 w-4" />
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              Revisa tu correo
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {sentMessage}
            </p>
            <Button
              variant="outline"
              className="mt-6 gap-1.5"
              onClick={() => {
                setSentMessage(null);
                setError(null);
              }}
            >
              Volver a enviar
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="animate-slide-up">
          <div className="mb-8 flex justify-center">
            <BrandLogo size={96} showTagline />
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
            <p className="text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          </div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </React.Suspense>
  );
}
