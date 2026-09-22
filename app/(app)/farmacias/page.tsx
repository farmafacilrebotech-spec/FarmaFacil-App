import Link from 'next/link';
import { Plus, Upload, Download } from 'lucide-react';

import { listPharmacies } from '@/lib/pharmacies/queries';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { PharmaciesTable } from '@/components/pharmacies/pharmacies-table';

export const dynamic = 'force-dynamic';

export default async function FarmaciasPage() {
  const pharmacies = await listPharmacies();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Farmacias"
        description="Gestiona todas las farmacias de tu red"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Upload className="h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/farmacias/nueva">
                <Plus className="h-4 w-4" /> Nueva farmacia
              </Link>
            </Button>
          </>
        }
      />

      <PharmaciesTable pharmacies={pharmacies} />
    </div>
  );
}
