/**
 * Helpers puros para interpretar resultados de acciones de membership en UI.
 * Sin I/O: permiten tests sin producción ni emails.
 */

export type MembershipActionUiResult =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'partial_success'; message: string };

export type MembershipLifecycleLike =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

/** Éxito total vs éxito parcial (p.ej. reinvite sin email) vs fallo. */
export function interpretMembershipActionResult(
  result: MembershipLifecycleLike
): MembershipActionUiResult {
  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.trim() || 'No se ha podido completar la acción.',
    };
  }

  const message = result.message.trim();
  const partialEmail =
    /no se ha podido enviar el correo/i.test(message) ||
    /puedes volver a enviarlo/i.test(message);

  if (partialEmail) {
    return { kind: 'partial_success', message };
  }

  return { kind: 'success', message };
}

/** Nunca tratar un fallo como éxito en la UI. */
export function shouldShowSuccessFeedback(
  result: MembershipLifecycleLike
): boolean {
  return result.ok;
}

export function shouldShowErrorFeedback(
  result: MembershipLifecycleLike
): boolean {
  return !result.ok;
}
