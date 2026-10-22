'use client';

import type { PharmacyProduct } from '@/lib/pharmacies/products-types';
import type { PharmacyCatalogMode } from '@/lib/pharmacies/catalog-mode';
import { PharmacyCatalogView } from '@/components/pharmacy-catalog/pharmacy-catalog-view';
import { SeedDemoCatalogButton } from '@/components/pharmacies/seed-demo-catalog-button';

/**
 * Pestaña Catálogo en ficha SuperAdmin.
 * Reutiliza la misma UI/acciones que /f/[pharmacyId]/catalogo.
 */
export function CatalogoTab({
  pharmacyId,
  pharmacyName,
  products,
  categories,
  loadError,
  catalogMode = 'generic',
  hasMasterProjection = false,
}: {
  pharmacyId: string;
  pharmacyName: string;
  products: PharmacyProduct[];
  categories: string[];
  loadError?: string | null;
  catalogMode?: PharmacyCatalogMode;
  hasMasterProjection?: boolean;
}) {
  return (
    <PharmacyCatalogView
      pharmacyId={pharmacyId}
      pharmacyName={pharmacyName}
      products={products}
      categories={categories}
      loadError={loadError}
      catalogMode={catalogMode}
      variant="embedded"
      toolbarExtra={
        <SeedDemoCatalogButton
          pharmacyId={pharmacyId}
          deprecated={hasMasterProjection || catalogMode === 'generic'}
        />
      }
    />
  );
}
