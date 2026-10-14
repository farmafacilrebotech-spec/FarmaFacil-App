'use client';

import { LogOut } from 'lucide-react';
import { signOutAction } from '@/app/auth/actions';
import { cn } from '@/lib/utils';

type SignOutControlProps = {
  className?: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
  'aria-label'?: string;
};

/**
 * Logout fiable vía form action (server):
 * signOut + clear cookies SSR + redirect('/login').
 * No hace signOut en el browser client antes (evita carrera de cookies).
 */
export function SignOutButton({
  className,
  children,
  iconOnly = false,
  'aria-label': ariaLabel = 'Cerrar sesión',
}: SignOutControlProps) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={cn(className)}
        aria-label={ariaLabel}
      >
        {children ? (
          children
        ) : iconOnly ? (
          <LogOut className="h-4 w-4" />
        ) : (
          <>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </>
        )}
      </button>
    </form>
  );
}
