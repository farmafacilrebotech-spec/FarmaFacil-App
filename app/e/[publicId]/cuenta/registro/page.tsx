import Link from 'next/link';

import { CustomerRegisterForm } from '@/components/customer/customer-register-form';
import { CustomerShell } from '@/components/customer/customer-shell';
import { getCustomerProfile } from '@/lib/customer/queries';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';
import { redirect } from 'next/navigation';

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
      publicId={publicId}
      pharmacyLabel={pharmacyLabel}
      title="Crear cuenta"
    >
      <CustomerRegisterForm publicId={publicId} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href={`/e/${publicId}/cuenta`} className="hover:underline">
          Volver a Mi cuenta
        </Link>
      </p>
    </CustomerShell>
  );
}
