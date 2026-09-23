import { Tag } from 'lucide-react';

import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';

export const dynamic = 'force-dynamic';

export default function PharmacyPromocionesPage() {
  return (
    <PharmacyTenantModulePage
      title="Promociones"
      description="Campañas y descuentos de tu farmacia"
      icon={Tag}
      moduleTitle="Módulo de Promociones"
      moduleDescription="Campañas promocionales, descuentos y programación de ofertas. Se conectará a datos reales de esta farmacia en una fase posterior."
    />
  );
}
