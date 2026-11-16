import { CustomerShell } from '@/components/customer/customer-shell';
import { customerOrderListPresentation } from '@/lib/customer/order-display';
import { listCustomerOrders } from '@/lib/customer/queries';
import { requireCustomerForPublicId } from '@/lib/customer/require-customer';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function CustomerOrdersPage({
  params,
}: {
  params: { publicId: string };
}) {
  const publicId = params.publicId;
  const entry = await resolvePublicEntrypoint(publicId);
  const pharmacyLabel = entry.ok ? entry.pharmacyName : null;
  const pharmacyLogoUrl = entry.ok ? entry.logoUrl : null;
  await requireCustomerForPublicId(publicId);

  const orders = await listCustomerOrders();

  return (
    <CustomerShell
      publicId={publicId}
      pharmacyLabel={pharmacyLabel}
      pharmacyLogoUrl={pharmacyLogoUrl}
      title="Mis pedidos"
      showInstallHint={false}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Solo aparecen pedidos vinculados a tu cuenta. Las solicitudes hechas
        como invitado (solo teléfono) no se asocian automáticamente al perfil.
      </p>

      {!orders.ok ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {orders.error}
        </p>
      ) : orders.orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no tienes pedidos vinculados a tu cuenta.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.orders.map((o) => {
            const { statusLabel, amountLabel } = customerOrderListPresentation(o);
            const counts =
              o.productCount != null && o.unitCount != null
                ? `${o.productCount} ${o.productCount === 1 ? 'producto' : 'productos'} · ${o.unitCount} ${o.unitCount === 1 ? 'unidad' : 'unidades'}`
                : null;
            return (
              <li
                key={o.id}
                className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  {o.pharmacyLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.pharmacyLogoUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain ring-1 ring-slate-100"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {o.pharmacyName || pharmacyLabel || 'Farmacia'}
                        </p>
                        <p className="font-semibold text-foreground">
                          #{o.displayNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {statusLabel}
                      </span>
                    </div>
                    {counts ? (
                      <p className="mt-1 text-xs text-muted-foreground">{counts}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {amountLabel}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CustomerShell>
  );
}
