import { CustomerProfileForm } from '@/components/customer/customer-profile-form';
import { CustomerShell } from '@/components/customer/customer-shell';
import { requireCustomerForPublicId } from '@/lib/customer/require-customer';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

export default async function CustomerProfilePage({
  params,
}: {
  params: { publicId: string };
}) {
  const publicId = params.publicId;
  const entry = await resolvePublicEntrypoint(publicId);
  const pharmacyLabel = entry.ok ? entry.pharmacyName : null;
  const profile = await requireCustomerForPublicId(publicId);

  return (
    <CustomerShell
      publicId={publicId}
      pharmacyLabel={pharmacyLabel}
      title="Perfil"
    >
      <CustomerProfileForm publicId={publicId} profile={profile} />
    </CustomerShell>
  );
}
