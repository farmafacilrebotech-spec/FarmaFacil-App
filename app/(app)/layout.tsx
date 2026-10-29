import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AccessDenied } from '@/components/auth/access-denied';
import { AuthError } from '@/components/auth/auth-error';
import { Toaster } from '@/components/ui/sonner';
import { resolvePlatformAccess } from '@/lib/auth/platform';
import { displayNameFromIdentity } from '@/lib/format';
import { navItemsForPlatformScope } from '@/lib/navigation';
import { listPharmacies } from '@/lib/pharmacies/queries';
import type { ShellPharmacyOption } from '@/lib/pharmacies/shell-pharmacies';

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

  // Sesión válida sin SuperAdmin ni soporte inventario → denegado (no /login).
  if (access.status === 'forbidden') {
    return <AccessDenied email={access.profile.email} />;
  }

  const profile = access.profile;
  const platformScope = access.platformScope;
  // Fallback visual: no escribe en Supabase. Si no hay full_name, usa local-part del email.
  const displayName = displayNameFromIdentity(
    profile.fullName,
    profile.email
  );

  // Solo farmacias reales (RLS plataforma). Sin mocks.
  let pharmacies: ShellPharmacyOption[] = [];
  try {
    const rows = await listPharmacies();
    pharmacies = rows.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      province: p.province,
      logoColor: p.logo_color,
    }));
  } catch (err) {
    console.error('[app-layout] listPharmacies', err);
  }

  const shellNav = navItemsForPlatformScope(platformScope);

  return (
    <>
      <AppShell
        user={{
          name: displayName,
          email: profile.email,
        }}
        pharmacies={pharmacies}
        navItems={shellNav}
      >
        {children}
      </AppShell>
      <Toaster richColors closeButton position="top-right" />
    </>
  );
}
