export type PharmacyInviteUserKind = 'new' | 'existing';

/**
 * Clasifica kind a partir de status de memberships (puro; testeable).
 * existing: alguna membership distinta de «invited» (cuenta FarmaFácil reutilizable).
 * new: solo invited / ninguna (alta Auth pendiente de first-access).
 */
export function classifyInviteUserKind(
  membershipStatuses: readonly string[]
): PharmacyInviteUserKind {
  const hasReusableMembership = membershipStatuses.some(
    (status) => status !== 'invited'
  );
  return hasReusableMembership ? 'existing' : 'new';
}
