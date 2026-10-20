import { MessageSquarePlus } from 'lucide-react';

import { PharmacyAssistantConsultsPanel } from '@/components/kiosk/pharmacy-assistant-consults-panel';
import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';
import {
  requireConsultsManage,
  requireConsultsView,
} from '@/lib/kiosk/assistant/consults/authz';
import {
  getPharmacyAssistantPendingConsultCount,
  listPharmacyAssistantConsults,
} from '@/lib/kiosk/assistant/consults/queries';

export const dynamic = 'force-dynamic';

export default async function PharmacyAssistantConsultasPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const view = await requireConsultsView(pharmacyId);

  if (!view.ok) {
    return (
      <PharmacyTenantModulePage
        title="Consultas al farmacéutico"
        description="Bandeja de mensajes desde el kiosko"
        icon={MessageSquarePlus}
        moduleTitle="Sin acceso"
        moduleDescription={view.error}
      />
    );
  }

  const [listed, counted, manage] = await Promise.all([
    listPharmacyAssistantConsults(pharmacyId, { limit: 80 }),
    getPharmacyAssistantPendingConsultCount(pharmacyId),
    requireConsultsManage(pharmacyId),
  ]);

  if (!listed.ok) {
    return (
      <PharmacyTenantModulePage
        title="Consultas al farmacéutico"
        description="Bandeja de mensajes desde el kiosko"
        icon={MessageSquarePlus}
        moduleTitle="Error"
        moduleDescription={listed.error}
      />
    );
  }

  return (
    <PharmacyTenantModulePage
      title="Consultas al farmacéutico"
      description="Mensajes enviados desde el Asistente IA del kiosko"
      icon={MessageSquarePlus}
      moduleTitle="Consultas"
      moduleDescription=""
    >
      <PharmacyAssistantConsultsPanel
        pharmacyId={pharmacyId}
        initialConsults={listed.consults}
        initialPendingCount={counted.ok ? counted.count : 0}
        canManage={manage.ok}
      />
    </PharmacyTenantModulePage>
  );
}
