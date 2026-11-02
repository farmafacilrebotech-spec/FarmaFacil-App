import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CustomerShell } from '@/components/customer/customer-shell';
import { EnableCustomerForm } from '@/components/customer/enable-customer-form';
import { PendingPharmacyBanner } from '@/components/customer/pending-pharmacy-banner';
import { Button } from '@/components/ui/button';
import { getCurrentProfile } from '@/lib/auth/platform';
import { getCustomerProfile } from '@/lib/customer/queries';

export const dynamic = 'force-dynamic';

/**
 * Destino PWA (start_url): perfil/hub si no hay sesión;
 * con sesión cliente redirige a Mis farmacias;
 * staff autenticado ve activación de Cliente.
 */
export default async function CustomerGlobalHubPage() {
  const customer = await getCustomerProfile();

  if (customer.ok) {
    redirect('/cuenta/mis-farmacias');
  }

  const staffNeedsEnable =
    customer.code === 'staff_needs_enable' ||
    customer.code === 'not_customer';

  let staffDefaults: {
    firstName?: string | null;
    lastName?: string | null;
  } = {};
  if (staffNeedsEnable) {
    const { profile } = await getCurrentProfile();
    if (profile) {
      const parts = (profile.fullName ?? '').trim().split(/\s+/);
      staffDefaults = {
        firstName: parts[0] || null,
        lastName: parts.slice(1).join(' ') || null,
      };
    }
  }

  return (
    <CustomerShell title="Mi cuenta">
      <div className="space-y-4">
        <PendingPharmacyBanner />
        {staffNeedsEnable ? (
          <EnableCustomerForm
            redirectTo="/cuenta/mis-farmacias"
            defaultFirstName={staffDefaults.firstName}
            defaultLastName={staffDefaults.lastName}
          />
        ) : (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-sm text-muted-foreground">
              Acceso de cliente FarmaFácil: consulta Mis farmacias, tu perfil y
              tus pedidos. Si ya eres personal de una farmacia, inicia sesión y
              activa Cliente sin crear otra cuenta.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/cuenta/entrar">Acceso cliente</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/cuenta/registro">Crear cuenta de cliente</Link>
              </Button>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          ¿Tienes el QR de tu farmacia? Escanéalo o abre su enlace y usa
          «Guardar en Mis farmacias».
        </p>
      </div>
    </CustomerShell>
  );
}
