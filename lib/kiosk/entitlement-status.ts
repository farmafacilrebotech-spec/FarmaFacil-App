/**
 * Estados comerciales del add-on kiosk (espejo de pharmacy_entitlements + ff_pharmacy_has_module).
 * Testeable sin BD.
 */

export type KioskEntitlementRecord = {
  status: 'active' | 'trial' | 'suspended' | 'cancelled' | null;
  source: 'plan' | 'addon' | 'comp' | 'internal' | null;
  endsAt: string | null;
};

export type KioskCommercialUiState =
  | 'not_contracted'
  | 'trial_active'
  | 'trial_expired'
  | 'active'
  | 'suspended'
  | 'cancelled';

export function resolveKioskCommercialUiState(
  entitlement: KioskEntitlementRecord | null,
  nowMs: number = Date.now()
): KioskCommercialUiState {
  if (!entitlement || entitlement.status == null) {
    return 'not_contracted';
  }

  const endsAtMs = entitlement.endsAt
    ? Date.parse(entitlement.endsAt)
    : Number.NaN;
  const endsInFuture =
    Number.isFinite(endsAtMs) && endsAtMs > nowMs;

  switch (entitlement.status) {
    case 'active':
      return 'active';
    case 'trial':
      return endsInFuture || entitlement.endsAt == null
        ? 'trial_active'
        : 'trial_expired';
    case 'suspended':
      return 'suspended';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'not_contracted';
  }
}

/** Puede generar códigos / operar runtime (alineado con ff_pharmacy_has_module). */
export function kioskModuleCurrentlyUsable(
  entitlement: KioskEntitlementRecord | null,
  nowMs: number = Date.now()
): boolean {
  const state = resolveKioskCommercialUiState(entitlement, nowMs);
  return state === 'active' || state === 'trial_active';
}

export function kioskCommercialUiCopy(state: KioskCommercialUiState): {
  title: string;
  description: string;
  tone: 'neutral' | 'ok' | 'warn' | 'danger';
} {
  switch (state) {
    case 'not_contracted':
      return {
        title: 'Kiosko no contratado',
        description:
          'Esta farmacia no tiene el módulo Kiosko. Contacta con FarmaFácil para contratarlo o solicitar una prueba.',
        tone: 'neutral',
      };
    case 'trial_active':
      return {
        title: 'Prueba de Kiosko activa',
        description:
          'Puedes vincular dispositivos hasta la fecha de vencimiento de la prueba.',
        tone: 'ok',
      };
    case 'trial_expired':
      return {
        title: 'Prueba de Kiosko vencida',
        description:
          'La prueba ha terminado. Los dispositivos vinculados quedan bloqueados hasta contratar el módulo.',
        tone: 'warn',
      };
    case 'active':
      return {
        title: 'Kiosko activo',
        description:
          'El módulo está contratado. Puedes generar códigos y gestionar dispositivos.',
        tone: 'ok',
      };
    case 'suspended':
      return {
        title: 'Kiosko suspendido',
        description:
          'El módulo está suspendido. Los dispositivos vinculados no pueden usarse hasta reactivarlo.',
        tone: 'warn',
      };
    case 'cancelled':
      return {
        title: 'Kiosko cancelado',
        description:
          'El módulo está cancelado. Los dispositivos se conservan pero no pueden usarse.',
        tone: 'danger',
      };
  }
}
