import { Calculator } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { TarifasWorkspace } from '@/components/tarifas/tarifas-workspace';
import { Badge } from '@/components/ui/badge';
import { hasPlatformPermission } from '@/lib/auth/platform';
import { listCommercialPilots } from '@/lib/commercial/pilots-queries';
import {
  canWriteMasterCatalog,
  listMasterCatalogProducts,
  listPharmacyCatalogSummaries,
} from '@/lib/commercial/master-catalog-queries';
import { loadTariffConfigForSession } from '@/lib/commercial/tariff-queries';
import {
  canManageCommercialQuotes,
  listCommercialQuotes,
  listQuotePharmacyOptions,
} from '@/lib/commercial/quote-queries';
import { getCommercialEmailSendReadiness } from '@/app/(app)/tarifas/quote-actions';

export default async function TarifasPage() {
  const [
    trialsPerm,
    canWriteMaster,
    canManageQuotes,
    tariffLoad,
    pilotsResult,
    masterResult,
    pharmacyCatalogResult,
    quotesResult,
    quotePharmacies,
    emailReadiness,
  ] = await Promise.all([
    hasPlatformPermission('platform.commercial_trials.manage'),
    canWriteMasterCatalog(),
    canManageCommercialQuotes(),
    loadTariffConfigForSession(),
    listCommercialPilots(),
    listMasterCatalogProducts(),
    listPharmacyCatalogSummaries(),
    listCommercialQuotes(),
    listQuotePharmacyOptions(),
    getCommercialEmailSendReadiness(),
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

  const quotes = quotesResult.ok
    ? {
        rows: quotesResult.quotes,
        error: null as string | null,
      }
    : {
        rows: [],
        error: quotesResult.error,
      };

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
      <PageHeader
        title="Tarifas y simulador"
        description="Planes comerciales, presupuestos, pilotos y preparación de contratación. Sin cobros automáticos ni activación implícita de piloto."
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
        canManageQuotes={canManageQuotes}
        canViewInternalCosts={tariffLoad.canViewInternalCosts}
        initialConfig={tariffLoad.config}
        pilots={pilots}
        master={master}
        pharmacyCatalog={pharmacyCatalog}
        quotes={quotes}
        quotePharmacies={quotePharmacies}
        emailReady={emailReadiness.canSend}
        emailMissing={emailReadiness.missing}
      />
    </div>
  );
}
