/**
 * Taxonomía oficial FarmaFácil (Fase B): 26 categorías comerciales
 * + 1 estado interno no comercial (`pending_classification`).
 *
 * Los slugs coinciden con el seed de supabase/proposed/106_catalog_taxonomy_import_v1.sql.
 * Pure TS: usable en tests sin DB.
 */

export const PENDING_CLASSIFICATION_SLUG = 'pending_classification';

export const FF_COMMERCIAL_CATEGORY_COUNT = 26;

export type FfTaxonomyCategory = {
  /** Clave estable (igual que ff_catalog_categories.slug). */
  slug: string;
  name: string;
  sortOrder: number;
  /** false solo para estados internos (p. ej. pendiente de clasificar). */
  isCommercial: boolean;
  /** SVG corporativo reutilizado de las 8 categorías antiguas; null si aún no hay. */
  iconSrc: string | null;
};

const ICON_BASE = '/images/catalog-proposal/categories';

export const FF_TAXONOMY_CATEGORIES: readonly FfTaxonomyCategory[] = [
  {
    slug: 'dermocosmetica',
    name: 'Dermocosmética',
    sortOrder: 10,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/cuidado-facial.svg`,
  },
  {
    slug: 'higiene_personal',
    name: 'Higiene personal',
    sortOrder: 20,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/cuidado-corporal.svg`,
  },
  {
    slug: 'salud_bucodental',
    name: 'Salud bucodental',
    sortOrder: 30,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/higiene-bucodental.svg`,
  },
  {
    slug: 'cuidado_capilar',
    name: 'Cuidado capilar',
    sortOrder: 40,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/cuidado-capilar.svg`,
  },
  {
    slug: 'proteccion_solar',
    name: 'Protección solar',
    sortOrder: 50,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/proteccion-solar.svg`,
  },
  {
    slug: 'bebe_infantil',
    name: 'Bebé e infantil',
    sortOrder: 60,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/bebe-maternidad.svg`,
  },
  {
    slug: 'embarazo_maternidad',
    name: 'Embarazo y maternidad',
    sortOrder: 70,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'nutricion_dietetica',
    name: 'Nutrición y dietética',
    sortOrder: 80,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'vitaminas_complementos',
    name: 'Vitaminas y complementos',
    sortOrder: 90,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'herboristeria_fitoterapia',
    name: 'Herboristería y fitoterapia',
    sortOrder: 100,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'salud_digestiva',
    name: 'Salud digestiva',
    sortOrder: 110,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'descanso_bienestar',
    name: 'Descanso y bienestar',
    sortOrder: 120,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/bienestar-estacional.svg`,
  },
  {
    slug: 'sexualidad_salud_intima',
    name: 'Sexualidad y salud íntima',
    sortOrder: 130,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'ortopedia',
    name: 'Ortopedia',
    sortOrder: 140,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'optica_cuidado_ocular',
    name: 'Óptica y cuidado ocular',
    sortOrder: 150,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'cuidado_auditivo',
    name: 'Cuidado auditivo',
    sortOrder: 160,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'cuidado_pies',
    name: 'Cuidado de los pies',
    sortOrder: 170,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'botiquin_primeros_auxilios',
    name: 'Botiquín y primeros auxilios',
    sortOrder: 180,
    isCommercial: true,
    iconSrc: `${ICON_BASE}/primeros-auxilios.svg`,
  },
  {
    slug: 'equipamiento_sanitario',
    name: 'Equipamiento sanitario',
    sortOrder: 190,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'incontinencia_cuidado_mayor',
    name: 'Incontinencia y cuidado del mayor',
    sortOrder: 200,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'deporte_recuperacion',
    name: 'Deporte y recuperación',
    sortOrder: 210,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'salud_respiratoria',
    name: 'Salud respiratoria',
    sortOrder: 220,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'repelentes_proteccion',
    name: 'Repelentes y protección',
    sortOrder: 230,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'mascotas',
    name: 'Mascotas',
    sortOrder: 240,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'belleza_maquillaje',
    name: 'Belleza y maquillaje',
    sortOrder: 250,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: 'otros_productos',
    name: 'Otros productos',
    sortOrder: 260,
    isCommercial: true,
    iconSrc: null,
  },
  {
    slug: PENDING_CLASSIFICATION_SLUG,
    name: 'Pendiente de clasificar',
    sortOrder: 9999,
    isCommercial: false,
    iconSrc: null,
  },
] as const;

/**
 * Alias de conservación: nombre exacto de las 8 categorías del maestro
 * (_validated_master.json / pharmacy_products.category) → slug oficial.
 * Misma correspondencia que ff_catalog_category_aliases en 106.
 */
export const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  'Cuidado facial': 'dermocosmetica',
  'Cuidado corporal e higiene': 'higiene_personal',
  'Higiene bucodental': 'salud_bucodental',
  'Cuidado capilar': 'cuidado_capilar',
  'Protección solar': 'proteccion_solar',
  'Bebé y maternidad': 'bebe_infantil',
  'Primeros auxilios y cuidado en casa': 'botiquin_primeros_auxilios',
  'Bienestar y cuidado estacional': 'descanso_bienestar',
};

const bySlug = new Map(FF_TAXONOMY_CATEGORIES.map((c) => [c.slug, c]));

const aliasByLowerName = new Map(
  Object.entries(LEGACY_CATEGORY_ALIASES).map(([name, slug]) => [
    name.toLowerCase(),
    slug,
  ])
);

export function getCategoryBySlug(
  slug: string | null | undefined
): FfTaxonomyCategory | null {
  if (!slug?.trim()) return null;
  return bySlug.get(slug.trim()) ?? null;
}

/** Categorías visibles al cliente, ordenadas por sortOrder. */
export function listCommercialCategories(): FfTaxonomyCategory[] {
  return FF_TAXONOMY_CATEGORIES.filter((c) => c.isCommercial).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

/**
 * Resuelve un nombre legacy (insensible a mayúsculas) a su categoría oficial.
 * Devuelve null si no es uno de los 8 nombres del maestro.
 */
export function resolveLegacyCategory(
  legacyName: string | null | undefined
): FfTaxonomyCategory | null {
  if (!legacyName?.trim()) return null;
  const slug = aliasByLowerName.get(legacyName.trim().toLowerCase());
  return slug ? getCategoryBySlug(slug) : null;
}
