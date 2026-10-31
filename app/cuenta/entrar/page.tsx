import { redirect } from 'next/navigation';

import { CustomerLoginForm } from '@/components/customer/customer-login-form';
import { CustomerShell } from '@/components/customer/customer-shell';
import { getCustomerProfile } from '@/lib/customer/queries';

export const dynamic = 'force-dynamic';

export default async function CustomerGlobalLoginPage() {
  const customer = await getCustomerProfile();
  if (customer.ok) {
    redirect('/cuenta/mis-farmacias');
  }

  return (
    <CustomerShell variant="auth" title="Acceso cliente">
      <CustomerLoginForm
        redirectTo="/cuenta/mis-farmacias"
        title="Acceso cliente"
        subtitle="Entra con tu cuenta de cliente FarmaFácil. El acceso de profesionales de la farmacia está en otra pantalla."
      />
    </CustomerShell>
  );
}
