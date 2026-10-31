import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CustomerShell } from '@/components/customer/customer-shell';
import { PendingPharmacyBanner } from '@/components/customer/pending-pharmacy-banner';
import { Button } from '@/components/ui/button';
import { getCustomerProfile } from '@/lib/customer/queries';

export const dynamic = 'force-dynamic';

/**
 * Destino PWA (start_url): perfil/hub si no hay sesión;
 * con sesión redirige a Mis farmacias.
 */
export default async function CustomerGlobalHubPage() {
  const customer = await getCustomerProfile();

  if (customer.ok) {
    redirect('/cuenta/mis-farmacias');
  }

  return (
    <CustomerShell title="Mi cuenta">
      <div className="space-y-4">
        <PendingPharmacyBanner />
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">
            Acceso de cliente FarmaFácil: consulta Mis farmacias, tu perfil y
            tus pedidos. No uses el acceso de profesionales de la farmacia.
          </p>
          {customer.code === 'not_customer' ? (
            <p className="text-sm text-amber-800">
              Has iniciado sesión con una cuenta de personal/plataforma. Cierra
              esa sesión e inicia con una cuenta de cliente para esta área.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/cuenta/entrar">Acceso cliente</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/cuenta/registro">Crear cuenta de cliente</Link>
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          ¿Tienes el QR de tu farmacia? Escanéalo o abre su enlace y usa
          «Guardar en Mis farmacias».
        </p>
      </div>
    </CustomerShell>
  );
}
