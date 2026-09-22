import { listActivePlans } from '@/lib/pharmacies/queries';
import { NewPharmacyForm } from '@/components/pharmacies/new-pharmacy-form';

export const dynamic = 'force-dynamic';

export default async function NewPharmacyPage() {
  const plans = await listActivePlans();

  return <NewPharmacyForm plans={plans} />;
}
