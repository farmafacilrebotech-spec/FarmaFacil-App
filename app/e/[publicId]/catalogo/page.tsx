import Link from 'next/link';

import { BrandLogo, PharmacyLogo } from '@/components/brand';
import { CustomerStickyHeader } from '@/components/customer/customer-sticky-header';
import { CustomerPwaRegister } from '@/components/customer/customer-pwa-register';
import { SavePharmacyButton } from '@/components/customer/save-pharmacy-button';
import { PublicCatalogRequestClient } from '@/components/kiosk/public-catalog-request-client';
import { getCustomerProfile } from '@/lib/customer/queries';
import { isPharmacySaved } from '@/lib/customer/saved-pharmacies';
import { listPublicCatalog } from '@/lib/kiosk/public-catalog';
import { buildPublicQrCheckoutPrefill } from '@/lib/kiosk/public-qr-customer-link';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';
import { firstNonEmptyPharmacyName } from '@/lib/pharmacies/display-name';

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
  // La RPC de catálogo (055) usa pharmacies.name; el entrypoint (098) usa visible_name.
  const pharmacyDisplayName = firstNonEmptyPharmacyName(
    entry.ok ? entry.pharmacyName : null,
    catalog.ok ? catalog.pharmacyName : null
  );
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
    <div className="min-h-screen overflow-x-clip bg-[#F7FAFA]">
      <CustomerPwaRegister />
      {/* Cabecera sticky móvil: marca, accesos y nombre de farmacia siempre visibles. */}
      <CustomerStickyHeader innerClassName="max-w-6xl">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <BrandLogo size={36} />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-0.5">
            <Link
              href="/cuenta/mis-farmacias"
              className="text-xs font-medium text-[#2EC4C7] hover:underline sm:text-sm"
            >
              Mis farmacias
            </Link>
            <Link
              href={`/e/${params.publicId}/cuenta`}
              className="text-xs font-semibold text-[#0F2A2E] hover:underline sm:text-sm"
            >
              Mi cuenta
            </Link>
            <Link
              href={`/e/${params.publicId}`}
              className="text-xs font-medium text-slate-600 hover:underline sm:text-sm"
            >
              Inicio farmacia
            </Link>
          </div>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <PharmacyLogo
            name={pharmacyDisplayName}
            logoUrl={pharmacyLogoUrl}
            logoColor="#2EC4C7"
            size={28}
            rounded="lg"
            className="bg-white ring-1 ring-slate-100"
          />
          <h1 className="min-w-0 truncate text-base font-semibold text-[#0F2A2E] sm:text-lg">
            {pharmacyDisplayName}
          </h1>
          <span className="shrink-0 text-xs font-medium text-slate-400">
            · Catálogo
          </span>
        </div>
      </CustomerStickyHeader>
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-8 pt-4">
        <header className="mb-6">
          <p className="text-xs text-slate-500">
            Precio y disponibilidad a confirmar por tu farmacia.
          </p>
          <div className="mt-3 max-w-sm">
            <SavePharmacyButton
              publicId={params.publicId}
              pharmacyName={pharmacyDisplayName}
              initiallySaved={saved}
              isAuthenticated={customer.ok}
              variant="compact"
            />
          </div>
        </header>

        <PublicCatalogRequestClient
          publicId={catalog.publicId}
          pharmacyName={pharmacyDisplayName}
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
