import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AccessDenied } from '@/components/auth/access-denied';
import { AuthError } from '@/components/auth/auth-error';
import { resolvePlatformAccess } from '@/lib/auth/platform';
import { displayNameFromIdentity } from '@/lib/format';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await resolvePlatformAccess();

  // Sin sesión → login. Nunca enviar aquí a quien ya tiene sesión.
  if (access.status === 'unauthenticated') {
    redirect('/login');
  }

  // Sesión válida pero fallo al cargar perfil/RBAC → error controlado (no /login).
  if (access.status === 'error') {
    return <AuthError message={access.message} email={access.email} />;
  }

  // Sesión válida sin PLATFORM_SUPERADMIN → denegado (no /login).
  if (access.status === 'forbidden') {
    return <AccessDenied email={access.profile.email} />;
  }

  const profile = access.profile;
  // Fallback visual: no escribe en Supabase. Si no hay full_name, usa local-part del email.
  const displayName = displayNameFromIdentity(
    profile.fullName,
    profile.email
  );

  return (
    <AppShell
      user={{
        name: displayName,
        email: profile.email,
      }}
    >
      {children}
    </AppShell>
  );
}
