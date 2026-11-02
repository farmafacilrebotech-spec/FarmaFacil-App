/**
 * Semántica account_kind (migración 071): staff | customer | both.
 * Pure helpers sin I/O — aptos para tests unitarios.
 */

export type AccountKind = 'staff' | 'customer' | 'both';

/** Tokens GUC locales usados por RPCs DEFINER (no el literal "1"). */
export const ACCOUNT_KIND_CHANGE_TOKENS = {
  enableSelf: 'enable_self_v1',
  acceptMembership: 'accept_membership_v1',
  platformAdmin: 'platform_admin_v1',
} as const;

export function normalizeAccountKind(
  raw: string | null | undefined
): AccountKind {
  const k = (raw ?? '').trim().toLowerCase();
  if (k === 'both') return 'both';
  if (k === 'customer') return 'customer';
  return 'staff';
}

/**
 * Metadata de signUp / Auth: solo staff|customer.
 * `both` u otros valores NUNCA se aceptan desde el cliente.
 */
export function kindFromSignupMetadata(
  raw: string | null | undefined
): 'staff' | 'customer' {
  const k = (raw ?? '').trim().toLowerCase();
  if (k === 'customer') return 'customer';
  // both / basura / vacío → staff (sin área cliente ni permisos de panel)
  return 'staff';
}

/** ¿Puede usar /cuenta, Mis farmacias, direcciones cliente? */
export function isCustomerCapable(
  kind: AccountKind | string | null | undefined
): boolean {
  const k = normalizeAccountKind(typeof kind === 'string' ? kind : kind ?? null);
  return k === 'customer' || k === 'both';
}

/**
 * ¿Enrutado de panel debe tratarlo como «solo cliente» sin memberships?
 * Con memberships active o invitaciones pending, no cortar el panel.
 */
export function isCustomerOnlyKind(
  kind: AccountKind | string | null | undefined
): boolean {
  return (
    normalizeAccountKind(typeof kind === 'string' ? kind : kind ?? null) ===
    'customer'
  );
}

/** Transición staff→both al activar Cliente; customer/both se conservan. */
export function nextKindAfterCustomerEnable(current: AccountKind): AccountKind {
  if (current === 'staff') return 'both';
  if (current === 'customer' || current === 'both') return current;
  return 'both';
}

/** Tras aceptar invitación válida: customer→both; resto intacto. */
export function nextKindAfterInviteAccept(current: AccountKind): AccountKind {
  if (current === 'customer') return 'both';
  return current;
}

/**
 * Espejo de resolveAppAccess tras SA: memberships/invites antes que customer.
 * Pending/rechazada (0 active, 0 pending) no concede pharmacy.
 */
export function resolveAccountKindAccessGate(input: {
  accountKind: AccountKind;
  activeMembershipCount: number;
  pendingInvitationCount: number;
}):
  | 'pharmacy'
  | 'multiple_pharmacies'
  | 'invited'
  | 'customer'
  | 'staff_continue' {
  if (input.activeMembershipCount === 1) return 'pharmacy';
  if (input.activeMembershipCount > 1) return 'multiple_pharmacies';
  if (input.pendingInvitationCount > 0) return 'invited';
  if (input.accountKind === 'customer') return 'customer';
  return 'staff_continue';
}

/**
 * Transiciones que platform.users.write puede hacer sin GUC admin explícito.
 * Solo upgrades a dual (no degradar both → staff/customer en silencio).
 */
export function isNonDestructivePlatformKindTransition(
  from: AccountKind,
  to: AccountKind
): boolean {
  if (from === to) return true;
  if (to === 'both' && (from === 'staff' || from === 'customer')) return true;
  return false;
}

/**
 * Señal de signUp Auth ofuscado (email ya existente + confirmaciones ON):
 * respuesta sin error, sin sesión, identities vacías.
 */
export function looksLikeObfuscatedExistingSignup(input: {
  session: unknown;
  user: { identities?: unknown[] | null } | null | undefined;
}): boolean {
  if (input.session) return false;
  if (!input.user) return true;
  const identities = input.user.identities;
  return !Array.isArray(identities) || identities.length === 0;
}

/**
 * Recovery XOR: si hay filas both, el rollback completo está bloqueado
 * (no se puede representar dual sin perder panel o área cliente).
 */
export function xorRollbackBlockedByBothCount(bothCount: number): boolean {
  return bothCount > 0;
}
