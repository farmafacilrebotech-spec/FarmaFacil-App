import { signOutAction } from '@/app/auth/actions';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import type { PharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { displayNameFromIdentity } from '@/lib/format';

function PharmacyAvatar({
  name,
  logoUrl,
  logoColor,
}: {
  name: string;
  logoUrl: string | null;
  logoColor: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className="h-12 w-12 rounded-xl object-cover ring-1 ring-border"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold text-white"
      style={{ backgroundColor: logoColor || '#0d9488' }}
      aria-hidden
    >
      {initials || 'F'}
    </div>
  );
}

export function PharmacyTenantShell({
  context,
  children,
}: {
  context: PharmacyTenantContext;
  children: React.ReactNode;
}) {
  const userLabel = displayNameFromIdentity(
    context.profile.fullName,
    context.profile.email
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <PharmacyAvatar
              name={context.pharmacy.name}
              logoUrl={context.pharmacy.logoUrl}
              logoColor={context.pharmacy.logoColor}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {context.pharmacy.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {context.membership.roleName} · {userLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <BrandLogo size={28} />
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
