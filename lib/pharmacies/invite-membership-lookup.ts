/**
 * Helpers puros para detectar membresía duplicada por email
 * dentro de UNA farmacia (sin I/O).
 */

export type MembershipEmailRow = {
  id: string;
  status: string;
  profiles:
    | { email: string | null }
    | { email: string | null }[]
    | null;
};

function unwrapProfile(
  profiles: MembershipEmailRow['profiles']
): { email: string | null } | null {
  if (profiles == null) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

/**
 * Busca en filas ya acotadas a pharmacy_id si algún miembro tiene ese email.
 * No cruza farmacias: el caller debe haber filtrado por pharmacy_id.
 */
export function findMembershipByEmailInPharmacy(
  rows: readonly MembershipEmailRow[],
  email: string
): { id: string; status: string } | null {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;

  for (const row of rows) {
    const profile = unwrapProfile(row.profiles);
    const rowEmail = (profile?.email ?? '').trim().toLowerCase();
    if (rowEmail && rowEmail === needle) {
      return { id: row.id, status: row.status };
    }
  }
  return null;
}
