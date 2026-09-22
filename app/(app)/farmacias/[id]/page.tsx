import { notFound } from 'next/navigation';

import {
  getPharmacyById,
  listActivePlans,
  listPharmacyMembers,
  listPharmacyRoles,
} from '@/lib/pharmacies/queries';
import { PharmacyDetailClient } from '@/components/pharmacies/pharmacy-detail-client';

export const dynamic = 'force-dynamic';

export default async function PharmacyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [pharmacy, plans, members, roles] = await Promise.all([
    getPharmacyById(params.id),
    listActivePlans(),
    listPharmacyMembers(params.id),
    listPharmacyRoles(),
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
    />
  );
}
