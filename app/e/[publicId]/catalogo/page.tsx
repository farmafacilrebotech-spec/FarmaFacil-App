import Link from 'next/link';

import { BrandLogo } from '@/components/brand';
import { CustomerPwaRegister } from '@/components/customer/customer-pwa-register';
import { SavePharmacyButton } from '@/components/customer/save-pharmacy-button';
import { PharmacyPublicIdentity } from '@/components/kiosk/pharmacy-public-identity';
import { PublicCatalogRequestClient } from '@/components/kiosk/public-catalog-request-client';
import { getCustomerProfile } from '@/lib/customer/queries';
import { isPharmacySaved } from '@/lib/customer/saved-pharmacies';
import { listPublicCatalog } from '@/lib/kiosk/public-catalog';
import { buildPublicQrCheckoutPrefill } from '@/lib/kiosk/public-qr-customer-link';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

/**
 * Catálogo público del QR de farmacia.
 * Respeta catalog_mode. Solicitudes → pharmacy_orders (source=public_qr).
 */
export default async function PublicPharmacyCatalogPage({
  params,
}: {
  params: { publicId: string };
  searchParams?: { q?: string };
}) {
  // Carga el catálogo completo: el filtro de búsqueda es client-side
  // para no remount/vaciar el carrito al buscar.
  const [catalog, entry] = await Promise.all([
    listPublicCatalog({
      publicId: params.publicId,
      // Catálogo genérico estándar: hasta 100 productos (RPC acota).
      limit: 100,
    }),
    resolvePublicEntrypoint(params.publicId),
  ]);
  const customer = await getCustomerProfile();
  const saved = customer.ok
    ? await isPharmacySaved(params.publicId)
    : false;
  const pharmacyLogoUrl = entry.ok ? entry.logoUrl : null;
  const checkoutPrefill = customer.ok
    ? buildPublicQrCheckoutPrefill({
        firstName: customer.profile.firstName,
        lastName: customer.profile.lastName,
        fullName: customer.profile.fullName,
        phone: customer.profile.phone,
        email: customer.profile.email,
        privacyAcceptedAt: customer.profile.privacyAcceptedAt,
      })
    : null;

  if (!catalog.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <BrandLogo size={80} />
        <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
          <h1 className="text-xl font-semibold text-foreground">
            Catálogo no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{catalog.message}</p>
          <Link
            href={`/e/${params.publicId}`}
            className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7FAFA] px-4 py-8">
      <CustomerPwaRegister />
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <BrandLogo size={56} />
          <div className="flex items-center gap-3">
            <Link
              href="/cuenta/mis-farmacias"
              className="text-sm font-medium text-[#2EC4C7] hover:underline"
            >
              Mis farmacias
            </Link>
            <Link
              href={`/e/${params.publicId}/cuenta`}
              className="text-sm font-semibold text-[#0F2A2E] hover:underline"
            >
              Mi cuenta
            </Link>
            <Link
              href={`/e/${params.publicId}`}
              className="text-sm font-medium text-slate-600 hover:underline"
            >
              Inicio farmacia
            </Link>
          </div>
        </div>

        <header className="mb-6">
          <PharmacyPublicIdentity
            pharmacyName={catalog.pharmacyName}
            logoUrl={pharmacyLogoUrl}
            size="md"
            align="start"
            showFarmaFacilMark={false}
          />
          <p className="mt-2 text-xs text-slate-500">
            Precio y disponibilidad a confirmar por tu farmacia.
          </p>
          <div className="mt-3 max-w-sm">
            <SavePharmacyButton
              publicId={params.publicId}
              pharmacyName={catalog.pharmacyName}
              initiallySaved={saved}
              isAuthenticated={customer.ok}
              variant="compact"
            />
          </div>
        </header>

        <PublicCatalogRequestClient
          publicId={catalog.publicId}
          pharmacyName={catalog.pharmacyName}
          pharmacyLogoUrl={pharmacyLogoUrl}
          catalogMode={catalog.catalogMode}
          note={catalog.note}
          items={catalog.items}
          authenticatedPrefill={checkoutPrefill}
        />
      </div>
    </div>
  );
}
