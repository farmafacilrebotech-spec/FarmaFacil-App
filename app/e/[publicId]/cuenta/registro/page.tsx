import { redirect } from 'next/navigation';

import { CustomerRegisterForm } from '@/components/customer/customer-register-form';
import { CustomerShell } from '@/components/customer/customer-shell';
import { getCustomerProfile } from '@/lib/customer/queries';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

export default async function CustomerRegisterPage({
  params,
}: {
  params: { publicId: string };
}) {
  const publicId = params.publicId;
  const entry = await resolvePublicEntrypoint(publicId);
  const pharmacyLabel = entry.ok ? entry.pharmacyName : null;

  const customer = await getCustomerProfile();
  if (customer.ok) {
    redirect(`/e/${publicId}/cuenta`);
  }

  return (
    <CustomerShell
      variant="auth"
      publicId={publicId}
      pharmacyLabel={pharmacyLabel}
      title="Crear cuenta"
    >
      <CustomerRegisterForm
        publicId={publicId}
        redirectTo={`/e/${publicId}/cuenta`}
        title="Crear cuenta"
        subtitle="Crea tu cuenta de cliente FarmaFácil."
      />
    </CustomerShell>
  );
}
