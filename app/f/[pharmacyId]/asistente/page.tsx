import { Bot } from 'lucide-react';

import { PharmacyAssistantSettingsPanel } from '@/components/kiosk/pharmacy-assistant-settings-panel';
import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';
import { createClient } from '@/lib/supabase/server';
import { getPharmacyAssistantEntitlement } from '@/lib/kiosk/assistant/entitlement';
import {
  getPharmacyAssistantSettings,
  getPharmacyAssistantUsageCurrentMonth,
} from '@/lib/kiosk/assistant/settings';

export const dynamic = 'force-dynamic';

export default async function PharmacyAsistentePage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;

  const [ent, settings, usage, canEdit] = await Promise.all([
    getPharmacyAssistantEntitlement(pharmacyId),
    getPharmacyAssistantSettings(pharmacyId),
    getPharmacyAssistantUsageCurrentMonth(pharmacyId),
    canEditAssistantSettings(pharmacyId),
  ]);

  return (
    <PharmacyTenantModulePage
      title="Asistente IA"
      description="Configura el asistente del kiosko para tu farmacia"
      icon={Bot}
      moduleTitle="Asistente IA"
      moduleDescription="Personaliza nombre, bienvenida, FAQs y servicios. La modalidad comercial y los límites los gestiona FarmaFácil."
    >
      <PharmacyAssistantSettingsPanel
        pharmacyId={pharmacyId}
        uiState={ent.uiState}
        moduleUsable={ent.moduleUsable}
        settings={
          settings ?? {
            pharmacyId,
            assistantName: 'Asistente FarmaFácil',
            welcomeMessage: '',
            customInstructions: '',
            faqs: [],
            servicesInfo: '',
            hoursInfo: '',
            pharmacistConsultEnabled: false,
          }
        }
        usage={usage}
        monthlyLimit={ent.entitlement?.monthlyRequestLimit ?? null}
        canEdit={canEdit}
      />
    </PharmacyTenantModulePage>
  );
}

async function canEditAssistantSettings(pharmacyId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_has_pharmacy_permission', {
    p_pharmacy_id: pharmacyId,
    p_permission_key: 'settings.update',
  });
  if (error) {
    console.error('[assistant] settings permission', error.message);
    return false;
  }
  return data === true;
}
