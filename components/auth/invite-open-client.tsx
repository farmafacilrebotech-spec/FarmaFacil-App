'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';

const ALLOWED_OTP = new Set(['invite', 'magiclink', 'email']);
const ALLOWED_NEXT = new Set(['/first-access', '/auth/invitations']);

/**
 * Cliente de /auth/invite-open.
 * El OTP solo se consume al pulsar Continuar → /auth/callback.
 */
export function InviteOpenClient() {
  const searchParams = useSearchParams();
  const [going, setGoing] = useState(false);

  const parsed = useMemo(() => {
    const tokenHash = (searchParams.get('token_hash') ?? '').trim();
    const otpType = (searchParams.get('type') ?? '').trim();
    const rawNext = searchParams.get('next');

    if (!tokenHash || !ALLOWED_OTP.has(otpType)) {
      return { ok: false as const };
    }

    let nextPath = '/first-access';
    if (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')) {
      const pathOnly = rawNext.split('?')[0]?.split('#')[0] ?? '';
      if (ALLOWED_NEXT.has(pathOnly)) {
        if (pathOnly === '/auth/invitations') {
          const qIndex = rawNext.indexOf('?');
          if (qIndex !== -1) {
            const params = new URLSearchParams(rawNext.slice(qIndex + 1));
            const forEmail = (params.get('for') ?? '').trim().toLowerCase();
            if (forEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forEmail)) {
              nextPath = `/auth/invitations?for=${encodeURIComponent(forEmail)}`;
            } else {
              nextPath = '/auth/invitations';
            }
          } else {
            nextPath = '/auth/invitations';
          }
        } else {
          nextPath = pathOnly;
        }
      }
    }

    const callbackParams = new URLSearchParams({
      token_hash: tokenHash,
      type: otpType,
      next: nextPath,
    });

    return {
      ok: true as const,
      callbackHref: `/auth/callback?${callbackParams.toString()}`,
    };
  }, [searchParams]);

  function handleContinue() {
    if (!parsed.ok || going) return;
    setGoing(true);
    window.location.assign(parsed.callbackHref);
  }

  if (!parsed.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <BrandLogo size={96} showTagline />
        <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Enlace no válido
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este enlace de invitación está incompleto o no es válido. Solicita
            una nueva invitación a FarmaFácil.
          </p>
          <Button asChild className="mt-6 w-full" variant="outline">
            <Link href="/login">Ir al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={96} showTagline />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Completar acceso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pulsa continuar para validar tu invitación y establecer tu acceso.
          Este paso evita que el enlace se use automáticamente al abrir el
          correo.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={handleContinue}
          disabled={going}
        >
          {going ? 'Redirigiendo…' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
