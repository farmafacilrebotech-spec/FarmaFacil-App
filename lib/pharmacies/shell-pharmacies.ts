/**
 * Opciones del selector de farmacia en shells (SuperAdmin / tenant).
 * Solo datos reales; sin mocks.
 */

export type ShellPharmacyOption = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  logoColor: string | null;
  logoUrl?: string | null;
};

export type PharmacySwitcherMode = 'hidden' | 'static' | 'select';

/** 0 → oculto; 1 → nombre fijo; >1 → desplegable entre autorizadas. */
export function pharmacySwitcherMode(
  pharmacies: readonly ShellPharmacyOption[]
): PharmacySwitcherMode {
  if (pharmacies.length <= 0) return 'hidden';
  if (pharmacies.length === 1) return 'static';
  return 'select';
}
