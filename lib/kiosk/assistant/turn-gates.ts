/**
 * Gates puros del turno del asistente (testeables sin Supabase/OpenAI).
 */

export type AssistantQuotaOutcome =
  | 'finalize_usage'
  | 'release_reservation'
  | 'no_reservation';

/**
 * Tras reservar cuota: si el proveedor falla, hay que liberar la reserva.
 * Si tiene éxito, registrar tokens (no liberar).
 */
export function resolveQuotaAfterProviderCall(input: {
  reserved: boolean;
  providerOk: boolean;
}): AssistantQuotaOutcome {
  if (!input.reserved) return 'no_reservation';
  if (input.providerOk) return 'finalize_usage';
  return 'release_reservation';
}

/**
 * OpenAI debe comprobarse ANTES de reservar cuota.
 */
export function canReserveQuota(input: {
  openAiConfigured: boolean;
  moduleUsable: boolean;
  limitExceeded: boolean;
}): { ok: true } | { ok: false; reason: 'config_missing' | 'module_disabled' | 'limit_exceeded' } {
  if (!input.moduleUsable) return { ok: false, reason: 'module_disabled' };
  if (input.limitExceeded) return { ok: false, reason: 'limit_exceeded' };
  if (!input.openAiConfigured) return { ok: false, reason: 'config_missing' };
  return { ok: true };
}

/**
 * Settings seguros para el modelo: en DEMO nunca se usan datos privados.
 */
export function demoSafePromptSettings(input: {
  mode: 'demo' | 'contracted';
  settings: {
    assistantName: string;
    customInstructions: string;
    faqs: Array<{ question: string; answer: string }>;
    servicesInfo: string;
    hoursInfo: string;
  };
}): {
  assistantName: string;
  customInstructions: string;
  faqs: Array<{ question: string; answer: string }>;
  servicesInfo: string;
  hoursInfo: string;
} {
  if (input.mode === 'demo') {
    return {
      assistantName: 'Asistente FarmaFácil (demo)',
      customInstructions: '',
      faqs: [],
      servicesInfo: '',
      hoursInfo: '',
    };
  }
  return { ...input.settings };
}

/**
 * Usuarios de farmacia no pueden mutar el permiso comercial de consultas.
 */
export function pharmacyMayUpdatePharmacistConsult(): boolean {
  return false;
}
