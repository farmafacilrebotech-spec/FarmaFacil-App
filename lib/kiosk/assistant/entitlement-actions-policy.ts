/**
 * Política de acciones comerciales del Asistente IA (testeable sin Supabase).
 */

export const ASSISTANT_SUPERADMIN_ACTIONS = [
  'activate_demo',
  'activate_contracted',
  'update_limits',
  'suspend',
  'reactivate',
  'cancel',
] as const;

export type AssistantSuperAdminAction =
  (typeof ASSISTANT_SUPERADMIN_ACTIONS)[number];

export function isAssistantSuperAdminAction(
  action: string
): action is AssistantSuperAdminAction {
  return (ASSISTANT_SUPERADMIN_ACTIONS as readonly string[]).includes(action);
}

/** La farmacia no puede ejecutar ninguna acción comercial. */
export function pharmacyMayRunAssistantCommercialAction(
  _action: string
): boolean {
  return false;
}
