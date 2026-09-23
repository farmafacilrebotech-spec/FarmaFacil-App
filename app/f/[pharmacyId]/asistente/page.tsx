import { Bot } from 'lucide-react';

import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';

export const dynamic = 'force-dynamic';

export default function PharmacyAsistentePage() {
  return (
    <PharmacyTenantModulePage
      title="Asistente"
      description="Asistente de ayuda para tu farmacia"
      icon={Bot}
      moduleTitle="Asistente de farmacia"
      moduleDescription="Asistente conversacional para consultas del día a día en la farmacia. Se habilitará en una fase posterior."
    />
  );
}
