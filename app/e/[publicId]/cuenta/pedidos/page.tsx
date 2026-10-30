import { CustomerShell } from '@/components/customer/customer-shell';
import { listCustomerOrders } from '@/lib/customer/queries';
import { requireCustomerForPublicId } from '@/lib/customer/require-customer';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

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
  await requireCustomerForPublicId(publicId);

  const orders = await listCustomerOrders();

  return (
    <CustomerShell
      publicId={publicId}
      pharmacyLabel={pharmacyLabel}
      title="Mis pedidos"
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
          {orders.orders.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    #{o.displayNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(o.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">
                  {o.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatMoney(o.totalAmount, o.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </CustomerShell>
  );
}
