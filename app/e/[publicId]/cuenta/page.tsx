import Link from 'next/link';

import { CustomerShell } from '@/components/customer/customer-shell';
import { Button } from '@/components/ui/button';
import { getCustomerProfile } from '@/lib/customer/queries';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

export default async function CustomerAccountHubPage({
  params,
}: {
  params: { publicId: string };
}) {
  const publicId = params.publicId;
  const entry = await resolvePublicEntrypoint(publicId);
  const pharmacyLabel = entry.ok ? entry.pharmacyName : null;

  const customer = await getCustomerProfile();

  return (
    <CustomerShell
      publicId={publicId}
      pharmacyLabel={pharmacyLabel || null}
      title="Mi cuenta"
    >
      {!customer.ok ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">
            Puedes consultar el catálogo sin registrarte. Crea una cuenta FarmaFácil
            para guardar tus datos y consultar pedidos vinculados a tu perfil.
          </p>
          {customer.code === 'not_customer' ? (
            <p className="text-sm text-amber-800">
              Has iniciado sesión con una cuenta de personal/plataforma. Usa una
              cuenta de cliente para esta área.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={`/e/${publicId}/cuenta/entrar`}>Iniciar sesión</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/e/${publicId}/cuenta/registro`}>Crear cuenta</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-sm text-muted-foreground">Sesión iniciada como</p>
            <p className="mt-1 font-medium text-foreground">
              {customer.profile.fullName || customer.profile.email}
            </p>
            <p className="text-sm text-muted-foreground">{customer.profile.email}</p>
          </div>
          <nav className="grid gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href={`/e/${publicId}/cuenta/perfil`}>Perfil</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href={`/e/${publicId}/cuenta/direcciones`}>Direcciones</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href={`/e/${publicId}/cuenta/pedidos`}>Mis pedidos</Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start">
              <Link href={`/e/${publicId}/catalogo`}>Seguir comprando</Link>
            </Button>
          </nav>
        </div>
      )}
    </CustomerShell>
  );
}
