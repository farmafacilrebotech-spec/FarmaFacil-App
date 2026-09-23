import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { redirect } from 'next/navigation';

import {
  destinationForAppAccess,
  resolveAppAccess,
} from '@/lib/auth/access';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * Acceso denegado fuera del layout SuperAdmin.
 * Evita confundir usuarios de farmacia con el panel de plataforma.
 */
export default async function AccessDeniedPage() {
  const access = await resolveAppAccess();

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }
  if (access.status === 'platform') {
    redirect('/dashboard');
  }
  if (access.status === 'pharmacy') {
    redirect(`/f/${access.membership.pharmacyId}/dashboard`);
  }
  if (access.status === 'invited') {
    redirect(destinationForAppAccess(access));
  }
  if (access.status === 'multiple_pharmacies') {
    redirect('/auth/select-pharmacy');
  }

  const email =
    access.status === 'forbidden' || access.status === 'error'
      ? access.status === 'forbidden'
        ? access.profile.email
        : access.email
      : undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={44} showTagline />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          Acceso no autorizado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La cuenta{email ? ` (${email})` : ''} no tiene un acceso activo
          válido a FarmaFácil en este momento.
        </p>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" className="w-full">
            Cerrar sesión
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}
