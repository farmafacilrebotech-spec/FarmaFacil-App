import type { PharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { displayNameFromIdentity } from '@/lib/format';

export function PharmacyTenantDashboard({
  context,
}: {
  context: PharmacyTenantContext;
}) {
  const userLabel = displayNameFromIdentity(
    context.profile.fullName,
    context.profile.email
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Panel de {context.pharmacy.name}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Acceso verificado a esta farmacia. El catálogo, clientes y pedidos
          llegarán en siguientes fases.
        </p>
      </div>

      <dl className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
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
          <dd className="mt-1 text-sm font-medium text-foreground">
            {context.membership.roleName}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              ({context.membership.roleKey})
            </span>
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
    </div>
  );
}
