import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
  hasPlatformSupportRole,
} from '@/lib/auth/platform';
import { requireActivePharmacyMembership } from '@/lib/auth/access';
import {
  filterHelpDocsForAudiences,
  getHelpDoc,
  helpAudiencesForPharmacyRole,
  type HelpAudience,
  type HelpDoc,
} from '@/lib/help/catalog';

export { filterHelpDocsForAudiences };

export type HelpAccessContext = {
  authenticated: boolean;
  audiences: HelpAudience[];
};

/**
 * Resuelve audiencias del usuario para el Centro de ayuda.
 * Fase A: SuperAdmin Total / Soporte en panel plataforma.
 * Farmacia/cliente se ampliarán cuando /ayuda exista en sus shells.
 */
export async function resolveHelpAudiences(): Promise<HelpAccessContext> {
  const { profile, authenticated } = await getCurrentProfile();
  if (!authenticated || !profile) {
    return { authenticated: false, audiences: [] };
  }

  const audiences: HelpAudience[] = [];
  const sa = await hasPlatformSuperAdminRole(profile.id);
  if (sa.ok) {
    audiences.push('sa_total', 'sa_comercial', 'sa_soporte');
  } else {
    const support = await hasPlatformSupportRole(profile.id);
    if (support.ok) audiences.push('sa_soporte');
  }

  // account_kind customer|both → contenido cliente (sin pruebas internas)
  if (profile.accountKind === 'customer' || profile.accountKind === 'both') {
    audiences.push('customer');
  }

  return { authenticated: true, audiences };
}

export async function listVisibleHelpDocs(): Promise<HelpDoc[]> {
  const { audiences } = await resolveHelpAudiences();
  return filterHelpDocsForAudiences(audiences);
}

/** Gate de un documento concreto (backend). */
export async function canAccessHelpDoc(
  docId: string
): Promise<{ ok: true; doc: HelpDoc } | { ok: false; reason: string }> {
  const doc = getHelpDoc(docId);
  if (!doc) return { ok: false, reason: 'not_found' };
  const { authenticated, audiences } = await resolveHelpAudiences();
  if (!authenticated) return { ok: false, reason: 'unauthenticated' };
  if (doc.internalTests && !audiences.includes('sa_total')) {
    return { ok: false, reason: 'forbidden' };
  }
  if (!doc.audiences.some((a) => audiences.includes(a))) {
    return { ok: false, reason: 'forbidden' };
  }
  return { ok: true, doc };
}

/**
 * Ayuda dentro del panel tenant /f/[pharmacyId]/ayuda.
 * Exige membership active en la farmacia (validado en servidor) y deriva
 * audiencias del rol. No concede audiencias de plataforma.
 */
export async function resolveHelpAudiencesForPharmacy(
  pharmacyId: string
): Promise<
  | { ok: true; audiences: HelpAudience[]; roleKey: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'error' }
> {
  const m = await requireActivePharmacyMembership(pharmacyId);
  if (!m.ok) return { ok: false, reason: m.reason };
  const audiences = helpAudiencesForPharmacyRole(m.membership.roleKey);
  return { ok: true, audiences, roleKey: m.membership.roleKey };
}

export async function canAccessHelpDocForPharmacy(
  pharmacyId: string,
  docId: string
): Promise<
  | { ok: true; doc: HelpDoc }
  | { ok: false; reason: 'not_found' | 'unauthenticated' | 'forbidden' | 'error' }
> {
  const doc = getHelpDoc(docId);
  if (!doc) return { ok: false, reason: 'not_found' };
  const resolved = await resolveHelpAudiencesForPharmacy(pharmacyId);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  if (doc.internalTests) return { ok: false, reason: 'forbidden' };
  if (!doc.audiences.some((a) => resolved.audiences.includes(a))) {
    return { ok: false, reason: 'forbidden' };
  }
  return { ok: true, doc };
}
