import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { listPharmacyProducts } from '@/lib/pharmacies/products';
import { PharmacyCatalogView } from '@/components/pharmacy-catalog/pharmacy-catalog-view';

export const dynamic = 'force-dynamic';

export default async function PharmacyCatalogPage({
  params,
  searchParams,
}: {
  params: { pharmacyId: string };
  searchParams?: { q?: string; category?: string; status?: string };
}) {
  const ctx = await loadPharmacyTenantContext(params.pharmacyId);
  if (!ctx.ok) {
    return null;
  }

  const statusParam = searchParams?.status;
  const status =
    statusParam === 'active' || statusParam === 'inactive'
      ? statusParam
      : 'all';

  const list = await listPharmacyProducts(params.pharmacyId, {
    q: searchParams?.q,
    category: searchParams?.category,
    status,
  });

  return (
    <PharmacyCatalogView
      pharmacyId={params.pharmacyId}
      pharmacyName={ctx.context.pharmacy.name}
      products={list.ok ? list.products : []}
      categories={list.ok ? list.categories : []}
      loadError={list.ok ? null : list.error}
    />
  );
}
