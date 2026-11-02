/**
 * Semántica de vínculo cliente ↔ pedido QR (migración 072).
 * Pure helpers — sin I/O.
 */

export type PublicQrCheckoutPrefill = {
  /** Nombre a mostrar / editar en el pedido (no escribe el perfil). */
  displayName: string;
  phone: string;
  /** No mostrar en UI hasta «Usar mis datos»; solo para contexto interno. */
  email: string | null;
  privacyAlreadyAccepted: boolean;
};

/** Elección de identidad en checkout con sesión customer|both. */
export type PublicQrCheckoutIdentityMode = 'choose' | 'account' | 'guest';

/**
 * ¿La sesión *puede* vincular el pedido QR a customer_profile_id?
 * Solo customer|both. Staff puro → no.
 * (Espejo de isCustomerCapable / ff_profile_is_customer_kind; sin I/O.)
 */
export function shouldLinkPublicQrOrderToSession(
  accountKind: string | null | undefined
): boolean {
  const k = (accountKind ?? '').trim().toLowerCase();
  return k === 'customer' || k === 'both';
}

/**
 * Contrato RPC 072: el vínculo requiere opt-in explícito del cliente
 * (`p_link_to_customer`) Y sesión customer|both. Nunca un profile_id ajeno.
 */
export function shouldLinkPublicQrOrder(input: {
  accountKind: string | null | undefined;
  linkToCustomerRequested: boolean;
}): boolean {
  return (
    input.linkToCustomerRequested === true &&
    shouldLinkPublicQrOrderToSession(input.accountKind)
  );
}

/**
 * La RPC NUNCA debe aceptar un profile id del navegador.
 * Documenta el contrato de seguridad para tests.
 */
export function publicQrOrderLinkSource(): 'auth.uid_server_only' {
  return 'auth.uid_server_only';
}

/** Default RPC: sin vínculo (invitado / «Pedir como invitado»). */
export function publicQrOrderLinkDefault(): false {
  return false;
}

/** Construye prefill editable desde campos de perfil (solo tras «Usar mis datos»). */
export function buildPublicQrCheckoutPrefill(input: {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  privacyAcceptedAt: string | null;
}): PublicQrCheckoutPrefill {
  const fromParts = [input.firstName, input.lastName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  const displayName =
    fromParts ||
    (input.fullName ?? '').trim() ||
    (input.email ?? '').split('@')[0] ||
    '';

  return {
    displayName,
    phone: (input.phone ?? '').trim(),
    email: input.email,
    privacyAlreadyAccepted: Boolean(input.privacyAcceptedAt),
  };
}
