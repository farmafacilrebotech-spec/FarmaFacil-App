import { notFound } from 'next/navigation';

import {
  getPharmacyById,
  listActivePlans,
  listPharmacyMembers,
  listPharmacyRoles,
} from '@/lib/pharmacies/queries';
import { listPharmacyProducts } from '@/lib/pharmacies/products';
import { PharmacyDetailClient } from '@/components/pharmacies/pharmacy-detail-client';

export const dynamic = 'force-dynamic';

export default async function PharmacyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [pharmacy, plans, members, roles, catalog] = await Promise.all([
    getPharmacyById(params.id),
    listActivePlans(),
    listPharmacyMembers(params.id),
    listPharmacyRoles(),
    listPharmacyProducts(params.id, { status: 'all' }),
  ]);

  if (!pharmacy) {
    notFound();
  }

  return (
    <PharmacyDetailClient
      pharmacy={pharmacy}
      plans={plans}
      members={members}
      roles={roles}
      catalogProducts={catalog.ok ? catalog.products : []}
      catalogCategories={catalog.ok ? catalog.categories : []}
      catalogLoadError={catalog.ok ? null : catalog.error}
    />
  );
}
