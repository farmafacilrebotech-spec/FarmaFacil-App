import Link from 'next/link';

import { BrandLogo } from '@/components/brand';
import { PublicCatalogRequestClient } from '@/components/kiosk/public-catalog-request-client';
import { listPublicCatalog } from '@/lib/kiosk/public-catalog';

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
  const catalog = await listPublicCatalog({
    publicId: params.publicId,
    // Catálogo genérico estándar: hasta 100 productos (RPC acota).
    limit: 100,
  });

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
    <div className="min-h-screen bg-[#F7FAFA] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <BrandLogo size={56} />
          <Link
            href={`/e/${params.publicId}`}
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Inicio farmacia
          </Link>
        </div>

        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            FarmaFácil · Catálogo
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {catalog.pharmacyName}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Modalidad:{' '}
            {catalog.catalogMode === 'own'
              ? 'Catálogo propio'
              : 'Catálogo genérico'}
          </p>
        </header>

        <PublicCatalogRequestClient
          publicId={catalog.publicId}
          pharmacyName={catalog.pharmacyName}
          catalogMode={catalog.catalogMode}
          note={catalog.note}
          items={catalog.items}
        />
      </div>
    </div>
  );
}
