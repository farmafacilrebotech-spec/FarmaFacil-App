import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CustomerShell } from '@/components/customer/customer-shell';
import { PendingPharmacyBanner } from '@/components/customer/pending-pharmacy-banner';
import { SavedPharmaciesList } from '@/components/customer/saved-pharmacies-list';
import { Button } from '@/components/ui/button';
import { getCustomerProfile } from '@/lib/customer/queries';
import { listSavedPharmacies } from '@/lib/customer/saved-pharmacies';

export const dynamic = 'force-dynamic';

export default async function MisFarmaciasPage() {
  const customer = await getCustomerProfile();
  if (!customer.ok) {
    if (customer.code === 'unauthenticated') {
      redirect('/cuenta/entrar');
    }
    redirect('/cuenta');
  }

  const saved = await listSavedPharmacies();

  return (
    <CustomerShell title="Mis farmacias">
      <div className="space-y-4">
        <PendingPharmacyBanner />
        <p className="text-sm text-muted-foreground">
          Hola{customer.profile.firstName ? `, ${customer.profile.firstName}` : ''}
          . Elige una farmacia guardada para abrir su catálogo o cuenta.
        </p>
        {saved.ok ? (
          <SavedPharmaciesList items={saved.items} />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {saved.error}
          </div>
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          Perfil, direcciones y pedidos siguen en «Mi cuenta» dentro de cada
          farmacia (abre una guardada o el QR). Quitar una farmacia no borra tu
          cuenta ni tus pedidos.
        </p>
        {saved.ok && saved.items[0] ? (
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href={`/e/${saved.items[0].publicId}/cuenta`}>
              Ir a Mi cuenta
            </Link>
          </Button>
        ) : null}
      </div>
    </CustomerShell>
  );
}
