import { Pill } from 'lucide-react';

import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';

export const dynamic = 'force-dynamic';

export default function PharmacyCatalogoPage() {
  return (
    <PharmacyTenantModulePage
      title="Catálogo"
      description="Productos, categorías y stock de tu farmacia"
      icon={Pill}
      moduleTitle="Módulo de Catálogo"
      moduleDescription="Listado de productos, categorías, destacados y control de stock. Se conectará al catálogo real de esta farmacia en una fase posterior."
    />
  );
}
