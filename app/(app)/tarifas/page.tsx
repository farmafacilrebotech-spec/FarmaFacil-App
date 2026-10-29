import { Calculator } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { TarifasWorkspace } from '@/components/tarifas/tarifas-workspace';
import { Badge } from '@/components/ui/badge';
import { hasPlatformPermission } from '@/lib/auth/platform';
import { listCommercialPilots } from '@/lib/commercial/pilots-queries';
import { canWriteMasterCatalog } from '@/lib/commercial/master-catalog-queries';
import { loadTariffConfigForSession } from '@/lib/commercial/tariff-queries';

export default async function TarifasPage() {
  const [trialsPerm, canWriteMaster, tariffLoad, pilotsResult] =
    await Promise.all([
      hasPlatformPermission('platform.commercial_trials.manage'),
      canWriteMasterCatalog(),
      loadTariffConfigForSession(),
      listCommercialPilots(),
    ]);

  const pilots = pilotsResult.ok
    ? {
        rows: pilotsResult.rows,
        kpis: pilotsResult.kpis,
        error: null as string | null,
      }
    : {
        rows: [],
        kpis: { active: 0, expiringSoon: 0, ended: 0, extended: 0 },
        error: pilotsResult.error,
      };

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
      <PageHeader
        title="Tarifas y simulador"
        description="Planes comerciales, pilotos y preparación de contratación. Sin cobros automáticos ni activación implícita de piloto."
        actions={
          <Badge variant="outline" className="font-normal">
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Fase 5 · RPCs comerciales
          </Badge>
        }
      />
      <TarifasWorkspace
        canManageTrials={trialsPerm.ok}
        canWriteMaster={canWriteMaster}
        canViewInternalCosts={tariffLoad.canViewInternalCosts}
        initialConfig={tariffLoad.config}
        pilots={pilots}
      />
    </div>
  );
}
