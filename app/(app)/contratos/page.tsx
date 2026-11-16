import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { ContractsWorkspace } from '@/components/contracts/contracts-workspace';
import {
  getContractEmailSendReadiness,
} from '@/app/(app)/contratos/actions';
import {
  canManageCommercialContracts,
  listAcceptedQuotesForContracts,
  listCommercialContracts,
} from '@/lib/contracts/queries';

export default async function ContratosPage({
  searchParams,
}: {
  searchParams?: { quoteId?: string };
}) {
  const canManage = await canManageCommercialContracts();
  const [contracts, accepted, emailReadiness] = await Promise.all([
    listCommercialContracts(),
    listAcceptedQuotesForContracts(),
    getContractEmailSendReadiness(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Contratos"
        description="Plantilla maestra única desde presupuesto aceptado. Borradores y vista previa aunque ReBoTech esté pendiente; firma y emisión definitiva bloqueadas hasta datos legales + aprobación jurídica. Aceptar presupuesto no firma ni activa el servicio."
      />

      {!canManage ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <FileText className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Necesitas permiso de contratos o presupuestos comerciales para
            gestionar este módulo.
          </p>
        </div>
      ) : (
        <ContractsWorkspace
          canManage={canManage}
          contracts={contracts.ok ? contracts.rows : []}
          contractsError={contracts.ok ? null : contracts.error}
          acceptedQuotes={accepted.ok ? accepted.quotes : []}
          emailReady={emailReadiness.ready}
          emailMissing={emailReadiness.missing}
          initialQuoteId={searchParams?.quoteId ?? null}
        />
      )}
    </div>
  );
}
