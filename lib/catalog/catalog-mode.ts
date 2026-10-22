/**
 * Modalidad de catálogo por farmacia: generic | own.
 */

export type PharmacyCatalogMode = 'generic' | 'own';

export function parseCatalogMode(
  value: unknown
): PharmacyCatalogMode {
  return value === 'own' ? 'own' : 'generic';
}

/** Piloto / General → genérico; Personalizado / IA personalizado → propio. */
export function catalogModeForCommercialPlan(
  planKey: 'pilot' | 'general' | 'personalized' | 'ai_personalized' | string
): PharmacyCatalogMode {
  if (planKey === 'personalized' || planKey === 'ai_personalized') {
    return 'own';
  }
  return 'generic';
}

export function ownCatalogImportAllowed(mode: PharmacyCatalogMode): boolean {
  return mode === 'own';
}

export function pharmacyMayEditProductSource(
  mode: PharmacyCatalogMode,
  source: string | null | undefined,
  isPlatform: boolean
): boolean {
  if (isPlatform) return true;
  if (source === 'generic' || source === 'demo') return false;
  if (mode === 'generic') {
    // En genérico la farmacia no crea/edita catálogo propio vía UI comercial.
    return false;
  }
  return source === 'manual' || source === 'import' || source == null;
}
