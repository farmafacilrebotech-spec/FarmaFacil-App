import { redirect } from 'next/navigation';

import { CustomerRegisterForm } from '@/components/customer/customer-register-form';
import { CustomerShell } from '@/components/customer/customer-shell';
import { getCustomerProfile } from '@/lib/customer/queries';

export const dynamic = 'force-dynamic';

export default async function CustomerGlobalRegisterPage() {
  const customer = await getCustomerProfile();
  if (customer.ok) {
    redirect('/cuenta/mis-farmacias');
  }

  return (
    <CustomerShell variant="auth" title="Crear cuenta de cliente">
      <CustomerRegisterForm
        redirectTo="/cuenta/mis-farmacias"
        title="Crear cuenta de cliente"
        subtitle="Cuenta global FarmaFácil para clientes. No es el acceso del personal de la farmacia."
      />
    </CustomerShell>
  );
}
