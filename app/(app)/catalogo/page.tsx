import { Package } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { MasterCatalogPanel } from '@/components/catalogo/master-catalog-panel';
import { Badge } from '@/components/ui/badge';
import {
  canWriteMasterCatalog,
  listMasterCatalogProducts,
  listPharmacyCatalogSummaries,
} from '@/lib/commercial/master-catalog-queries';

export default async function CatalogoPage() {
  const [canWriteMaster, masterResult, pharmacyCatalogResult] =
    await Promise.all([
      canWriteMasterCatalog(),
      listMasterCatalogProducts(),
      listPharmacyCatalogSummaries(),
    ]);

  const master = masterResult.ok
    ? {
        products: masterResult.products,
        categories: masterResult.categories,
        activeCount: masterResult.activeCount,
        error: null as string | null,
      }
    : {
        products: [],
        categories: [],
        activeCount: 0,
        error: masterResult.error,
      };

  const pharmacyCatalog = pharmacyCatalogResult.ok
    ? {
        rows: pharmacyCatalogResult.rows,
        error: null as string | null,
      }
    : {
        rows: [],
        error: pharmacyCatalogResult.error,
      };

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
      <PageHeader
        title="Catálogo maestro FarmaFácil"
        description="Catálogo global de tipos genéricos administrado exclusivamente por SuperAdmin. Las farmacias en modalidad generic reciben proyecciones; su catálogo propio permanece aislado por pharmacy_id."
        actions={
          <Badge variant="outline" className="font-normal">
            <Package className="mr-1.5 h-3.5 w-3.5" />
            Global · SuperAdmin
          </Badge>
        }
      />
      <MasterCatalogPanel
        products={master.products}
        categories={master.categories}
        activeCount={master.activeCount}
        pharmacyRows={pharmacyCatalog.rows}
        loadError={master.error}
        pharmaciesError={pharmacyCatalog.error}
        canWrite={canWriteMaster}
      />
    </div>
  );
}
