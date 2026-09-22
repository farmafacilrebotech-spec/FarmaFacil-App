'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/auth/actions';

/**
 * Error controlado cuando hay sesión pero falla la carga de perfil/RBAC.
 * No redirige a /login (evita bucles con el middleware).
 */
export function AuthError({
  message,
  email,
}: {
  message: string;
  email?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={44} showTagline />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          No se ha podido verificar el acceso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {email ? (
            <>
              Hay una sesión activa{email ? ` (${email})` : ''}, pero ha fallado
              la consulta de perfil o permisos.
            </>
          ) : (
            <>
              Hay una sesión activa, pero ha fallado la consulta de perfil o
              permisos.
            </>
          )}
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {message}
          </p>
        )}
        <form action={signOutAction} className="mt-6">
          <Button type="submit" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
