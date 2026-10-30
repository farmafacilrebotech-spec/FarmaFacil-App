import { CustomerAddressesPanel } from '@/components/customer/customer-addresses-panel';
import { CustomerShell } from '@/components/customer/customer-shell';
import { listCustomerAddresses } from '@/lib/customer/queries';
import { requireCustomerForPublicId } from '@/lib/customer/require-customer';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

export default async function CustomerAddressesPage({
  params,
}: {
  params: { publicId: string };
}) {
  const publicId = params.publicId;
  const entry = await resolvePublicEntrypoint(publicId);
  const pharmacyLabel = entry.ok ? entry.pharmacyName : null;
  await requireCustomerForPublicId(publicId);

  const addresses = await listCustomerAddresses();

  return (
    <CustomerShell
      publicId={publicId}
      pharmacyLabel={pharmacyLabel}
      title="Direcciones"
    >
      {!addresses.ok ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {addresses.error}
        </p>
      ) : (
        <CustomerAddressesPanel
          publicId={publicId}
          addresses={addresses.addresses}
        />
      )}
    </CustomerShell>
  );
}
