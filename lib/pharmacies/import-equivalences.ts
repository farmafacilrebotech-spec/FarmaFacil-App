/**
 * Equivalencias familia origen → categoría FarmaFácil.
 * Pure TS: usable en wizard y tests sin BD ni path aliases.
 * Persistencia BD: pharmacy_category_import_equivalences (proposed/089).
 */

export type CategoryEquivalenceKey = {
  pharmacyId: string;
  supplierKey: string | null;
  sourceFormat: string | null;
  sourceFamily: string;
  sourceSubfamily: string | null;
};

export type CategoryEquivalence = CategoryEquivalenceKey & {
  id?: string;
  categorySlug: string;
  categoryName: string;
  subcategorySlug?: string | null;
};

export function normalizeEquivalencePart(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length ? t.toLowerCase() : null;
}

export function equivalenceLookupKey(
  eq: Pick<
    CategoryEquivalenceKey,
    'supplierKey' | 'sourceFormat' | 'sourceFamily' | 'sourceSubfamily'
  >
): string {
  return [
    normalizeEquivalencePart(eq.supplierKey) ?? '',
    normalizeEquivalencePart(eq.sourceFormat) ?? '',
    normalizeEquivalencePart(eq.sourceFamily) ?? '',
    normalizeEquivalencePart(eq.sourceSubfamily) ?? '',
  ].join('|');
}

/** Familias origen únicas a partir de borradores de import. */
export function uniqueSourceFamilies(
  rows: readonly {
    sourceFamily: string | null;
    sourceSubfamily?: string | null;
  }[]
): Array<{ sourceFamily: string; sourceSubfamily: string | null }> {
  const seen = new Set<string>();
  const out: Array<{ sourceFamily: string; sourceSubfamily: string | null }> =
    [];
  for (const row of rows) {
    const family = row.sourceFamily?.trim();
    if (!family) continue;
    const sub = row.sourceSubfamily?.trim() || null;
    const key = `${family.toLowerCase()}|${(sub ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sourceFamily: family, sourceSubfamily: sub });
  }
  return out.sort((a, b) =>
    a.sourceFamily.localeCompare(b.sourceFamily, 'es')
  );
}

export function findEquivalence(
  family: string,
  subfamily: string | null | undefined,
  equivalences: readonly CategoryEquivalence[]
): CategoryEquivalence | null {
  const want = equivalenceLookupKey({
    supplierKey: null,
    sourceFormat: null,
    sourceFamily: family,
    sourceSubfamily: subfamily ?? null,
  });
  let fallback: CategoryEquivalence | null = null;
  for (const eq of equivalences) {
    const exact = equivalenceLookupKey({
      supplierKey: eq.supplierKey,
      sourceFormat: eq.sourceFormat,
      sourceFamily: eq.sourceFamily,
      sourceSubfamily: eq.sourceSubfamily,
    });
    if (exact === want) return eq;
    const familyOnly = equivalenceLookupKey({
      supplierKey: eq.supplierKey,
      sourceFormat: eq.sourceFormat,
      sourceFamily: eq.sourceFamily,
      sourceSubfamily: null,
    });
    const wantFamily = equivalenceLookupKey({
      supplierKey: null,
      sourceFormat: null,
      sourceFamily: family,
      sourceSubfamily: null,
    });
    if (!fallback && familyOnly === wantFamily) fallback = eq;
  }
  return fallback;
}

/** Aplica equivalencias a drafts: rellena category cuando hay mapa. */
export function applyEquivalencesToDrafts<
  T extends {
    category: string | null;
    sourceFamily: string | null;
    sourceSubfamily: string | null;
  },
>(drafts: T[], equivalences: readonly CategoryEquivalence[]): T[] {
  return drafts.map((d) => {
    if (d.category?.trim()) return d;
    if (!d.sourceFamily?.trim()) return d;
    const hit = findEquivalence(
      d.sourceFamily,
      d.sourceSubfamily,
      equivalences
    );
    if (!hit) return d;
    return { ...d, category: hit.categoryName };
  });
}

/** Persistencia local (preview) hasta apply 089. */
export function loadLocalEquivalences(
  pharmacyId: string
): CategoryEquivalence[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(
      `ff.import.equivalences.${pharmacyId}`
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CategoryEquivalence[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalEquivalences(
  pharmacyId: string,
  items: readonly CategoryEquivalence[]
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `ff.import.equivalences.${pharmacyId}`,
    JSON.stringify(items)
  );
}
