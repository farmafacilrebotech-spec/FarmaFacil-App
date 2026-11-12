import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
  hasPlatformSupportRole,
} from '@/lib/auth/platform';
import {
  filterHelpDocsForAudiences,
  getHelpDoc,
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
