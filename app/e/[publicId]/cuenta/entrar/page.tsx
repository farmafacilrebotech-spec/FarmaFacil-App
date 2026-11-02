import { redirect } from 'next/navigation';

import { CustomerLoginForm } from '@/components/customer/customer-login-form';
import { CustomerShell } from '@/components/customer/customer-shell';
import { getCustomerProfile } from '@/lib/customer/queries';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

export default async function CustomerLoginPage({
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
      title="Iniciar sesión"
    >
      <CustomerLoginForm
        publicId={publicId}
        redirectTo={`/e/${publicId}/cuenta`}
        title="Iniciar sesión"
        subtitle="Accede a tu cuenta de cliente FarmaFácil."
      />
    </CustomerShell>
  );
}
