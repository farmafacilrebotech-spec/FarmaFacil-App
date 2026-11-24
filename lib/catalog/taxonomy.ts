/**
 * Taxonomía oficial FarmaFácil (Fase B): 26 categorías comerciales
 * + 1 estado interno no comercial (`pending_classification`).
 *
 * Los slugs coinciden con el seed de supabase/proposed/089_catalog_taxonomy_import_v1.sql.
 * Pure TS: usable en tests sin DB.
 */

export const PENDING_CLASSIFICATION_SLUG = 'pending_classification';
export const PENDING_CLASSIFICATION_NAME = 'Pendiente de clasificar';

export const FF_COMMERCIAL_CATEGORY_COUNT = 26;

export type FfTaxonomySubcategory = {
  categorySlug: string;
  slug: string;
  name: string;
  sortOrder: number;
};

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
 * Subcategorías seed (editables en SuperAdmin tras apply 089).
 * Vacío por defecto; la UI permite borradores locales hasta persistir en BD.
 */
export const FF_TAXONOMY_SUBCATEGORIES: readonly FfTaxonomySubcategory[] = [
  {
    categorySlug: 'dermocosmetica',
    slug: 'facial_limpieza',
    name: 'Limpieza facial',
    sortOrder: 10,
  },
  {
    categorySlug: 'dermocosmetica',
    slug: 'facial_hidratacion',
    name: 'Hidratación facial',
    sortOrder: 20,
  },
  {
    categorySlug: 'bebe_infantil',
    slug: 'higiene_bebe',
    name: 'Higiene bebé',
    sortOrder: 10,
  },
  {
    categorySlug: 'proteccion_solar',
    slug: 'solar_adulto',
    name: 'Solar adulto',
    sortOrder: 10,
  },
  {
    categorySlug: 'proteccion_solar',
    slug: 'solar_infantil',
    name: 'Solar infantil',
    sortOrder: 20,
  },
];

/**
 * Alias de conservación: nombre exacto de las 8 categorías del maestro
 * (_validated_master.json / pharmacy_products.category) → slug oficial.
 * Misma correspondencia que ff_catalog_category_aliases en 089.
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

export function listSubcategoriesForCategory(
  categorySlug: string
): FfTaxonomySubcategory[] {
  return FF_TAXONOMY_SUBCATEGORIES.filter(
    (s) => s.categorySlug === categorySlug
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** true si el texto de categoría es el estado interno no comercial. */
export function isPendingClassificationCategory(
  categoryName: string | null | undefined
): boolean {
  if (!categoryName?.trim()) return false;
  const n = categoryName.trim().toLowerCase();
  return (
    n === PENDING_CLASSIFICATION_NAME.toLowerCase() ||
    n === PENDING_CLASSIFICATION_SLUG
  );
}

/**
 * Resuelve nombre (comercial, legacy o slug) a categoría oficial.
 */
export function resolveCategoryLabel(
  label: string | null | undefined
): FfTaxonomyCategory | null {
  if (!label?.trim()) return null;
  const raw = label.trim();
  const bySlug = getCategoryBySlug(raw);
  if (bySlug) return bySlug;
  const lower = raw.toLowerCase();
  for (const c of FF_TAXONOMY_CATEGORIES) {
    if (c.name.toLowerCase() === lower) return c;
  }
  return resolveLegacyCategory(raw);
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

/**
 * Icono para taxonomía 26 / alias legacy.
 * Preferir en kiosko/cliente frente a solo maestro 8.
 */
export function resolveCatalogCategoryIcon(
  categoryName: string | null | undefined
): { categoryName: string; slug: string; iconSrc: string } | null {
  const resolved = resolveCategoryLabel(categoryName);
  if (resolved?.iconSrc) {
    return {
      categoryName: resolved.name,
      slug: resolved.slug,
      iconSrc: resolved.iconSrc,
    };
  }
  return null;
}
