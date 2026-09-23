import { displayNameFromIdentity } from '@/lib/format';
import { pharmacyRoleLabel } from '@/lib/pharmacies/role-labels';
import type { PharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { PageHeader } from '@/components/shared/page-header';
import { PharmacyLogo } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export function PharmacyTenantSettings({
  context,
}: {
  context: PharmacyTenantContext;
}) {
  const userLabel = displayNameFromIdentity(
    context.profile.fullName,
    context.profile.email
  );
  const roleLabel = pharmacyRoleLabel(context.membership.roleKey);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Configuración"
        description="Información de tu farmacia y de tu acceso"
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-6 py-5">
          <PharmacyLogo
            name={context.pharmacy.name}
            logoUrl={context.pharmacy.logoUrl}
            logoColor={context.pharmacy.logoColor || '#0d9488'}
            size={56}
            rounded="2xl"
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {context.pharmacy.name}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Panel de farmacia FarmaFácil
            </p>
          </div>
        </div>

        <dl className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Farmacia
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {context.pharmacy.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tu rol
            </dt>
            <dd className="mt-1">
              <Badge variant="secondary">{roleLabel}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Usuario
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {userLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {context.profile.email}
            </dd>
          </div>
        </dl>

        <p className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
          La edición de branding, datos de contacto y otros ajustes se
          habilitará en una fase posterior.
        </p>
      </Card>
    </div>
  );
}
