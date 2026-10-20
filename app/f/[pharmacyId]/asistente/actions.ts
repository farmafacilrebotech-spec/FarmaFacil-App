'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/platform';
import { sanitizeAssistantSettingsInput } from '@/lib/kiosk/assistant/settings-input';

export type SaveAssistantSettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Farmacia: guarda configuración de contenido del asistente.
 * No permite cambiar modalidad comercial ni límites.
 */
export async function savePharmacyAssistantSettingsAction(input: {
  pharmacyId: string;
  assistantName: string;
  welcomeMessage: string;
  customInstructions: string;
  faqs: Array<{ question: string; answer: string }>;
  servicesInfo: string;
  hoursInfo: string;
}): Promise<SaveAssistantSettingsResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const { profile, authenticated } = await getCurrentProfile();
  if (!authenticated || !profile) {
    return { ok: false, error: 'Debes iniciar sesión.' };
  }

  const sanitized = sanitizeAssistantSettingsInput(input);
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error };
  }

  // Nunca incluir pharmacist_consult_enabled: permiso comercial (solo SuperAdmin / trigger DB).
  const supabase = createClient();
  const { error } = await supabase.from('pharmacy_assistant_settings').upsert(
    {
      pharmacy_id: pharmacyId,
      assistant_name: sanitized.value.assistantName,
      welcome_message: sanitized.value.welcomeMessage,
      custom_instructions: sanitized.value.customInstructions,
      faqs: sanitized.value.faqs,
      services_info: sanitized.value.servicesInfo,
      hours_info: sanitized.value.hoursInfo,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'pharmacy_id' }
  );

  if (error) {
    console.error('[assistant] save settings', error.message);
    return {
      ok: false,
      error:
        error.message ||
        'No se ha podido guardar la configuración del asistente.',
    };
  }

  revalidatePath(`/f/${pharmacyId}/asistente`);
  return { ok: true, message: 'Configuración del Asistente IA guardada.' };
}
