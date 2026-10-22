import { NewPharmacyForm } from '@/components/pharmacies/new-pharmacy-form';

export const dynamic = 'force-dynamic';

/**
 * Alta SuperAdmin unificada → preparación comercial Piloto
 * (ff_create_pharmacy_commercial_prep_v1). Sin trial legacy 30d.
 */
export default function NewPharmacyPage() {
  return <NewPharmacyForm />;
}
