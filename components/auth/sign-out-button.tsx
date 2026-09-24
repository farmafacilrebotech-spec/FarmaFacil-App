'use client';

import * as React from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { signOutAction } from '@/app/auth/actions';
import { cn } from '@/lib/utils';

type SignOutControlProps = {
  className?: string;
  /** Contenido visible del botón. Por defecto icono + «Cerrar sesión». */
  children?: React.ReactNode;
  /** Solo icono (p.ej. sidebar colapsado). */
  iconOnly?: boolean;
  'aria-label'?: string;
};

/**
 * Logout fiable: limpia sesión del browser client y luego server action
 * (revoke + cookies SSR + redirect /login).
 */
export function SignOutButton({
  className,
  children,
  iconOnly = false,
  'aria-label': ariaLabel = 'Cerrar sesión',
}: SignOutControlProps) {
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    // redirect() de la server action lanza NEXT_REDIRECT: no envolver en try/catch.
    await signOutAction();
  }

  return (
    <button
      type="button"
      className={cn(className)}
      aria-label={ariaLabel}
      disabled={pending}
      onClick={() => void handleSignOut()}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : children ? (
        children
      ) : iconOnly ? (
        <LogOut className="h-4 w-4" />
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </>
      )}
    </button>
  );
}
