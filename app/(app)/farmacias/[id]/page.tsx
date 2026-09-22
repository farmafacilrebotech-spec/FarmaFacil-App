import { notFound } from 'next/navigation';

import {
  getPharmacyById,
  listActivePlans,
} from '@/lib/pharmacies/queries';
import { PharmacyDetailClient } from '@/components/pharmacies/pharmacy-detail-client';

export const dynamic = 'force-dynamic';

export default async function PharmacyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [pharmacy, plans] = await Promise.all([
    getPharmacyById(params.id),
    listActivePlans(),
  ]);

  if (!pharmacy) {
    notFound();
  }

  return <PharmacyDetailClient pharmacy={pharmacy} plans={plans} />;
}
