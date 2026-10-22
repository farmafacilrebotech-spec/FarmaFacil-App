/**
 * Mapeo de errores PG/RPC comerciales a mensajes de UI.
 * No expone detalles internos ni connection strings.
 */

const KNOWN: Record<string, string> = {
  not_authenticated: 'Debes iniciar sesión.',
  forbidden_commercial_trials: 'No tienes permiso para gestionar pilotos.',
  forbidden_subscriptions_manage: 'No tienes permiso para gestionar suscripciones.',
  forbidden_pharmacies_write: 'No tienes permiso para escribir farmacias.',
  forbidden_entitlements_manage: 'No tienes permiso para gestionar entitlements.',
  forbidden_catalog_mode: 'No tienes permiso para cambiar la modalidad de catálogo.',
  pharmacy_not_found: 'Farmacia no encontrada.',
  pharmacy_name_required: 'El nombre de la farmacia es obligatorio.',
  commercial_trial_not_ready: 'No hay un piloto en estado ready.',
  commercial_trial_not_found: 'No se encontró el piloto comercial.',
  commercial_trial_extension_already_used: 'La ampliación de 15 días ya se usó.',
  commercial_trial_not_running: 'No hay un piloto activo o ampliado para finalizar.',
  extension_reason_required: 'Indica un motivo de ampliación (mín. 3 caracteres).',
  pharmacy_has_current_subscription: 'La farmacia ya tiene una suscripción corriente.',
  starter_plan_missing: 'Falta el plan técnico starter en la base de datos.',
  generic_catalog_readonly: 'El catálogo maestro no es editable por la farmacia.',
  invalid_catalog_mode: 'Modalidad de catálogo no válida.',
};

export function mapCommercialRpcError(
  message: string,
  code?: string
): string {
  const raw = (message || '').trim();
  for (const [key, label] of Object.entries(KNOWN)) {
    if (raw.includes(key)) return label;
  }
  if (raw.includes('commercial_trial_not_ready_checklist')) {
    return 'Faltan condiciones para activar el piloto. Revisa el checklist de readiness.';
  }
  if (raw.includes('Faltan condiciones obligatorias')) {
    return 'Faltan condiciones para activar el piloto. Revisa el checklist de readiness.';
  }
  if (code === '42501') return 'Operación no autorizada.';
  if (code === 'P0002') return 'Registro no encontrado.';
  if (code === '23514') return 'Datos no válidos para esta operación.';
  return 'No se ha podido completar la operación comercial.';
}
