/**
 * Mapeo verificado: categorías del catálogo maestro (8) → iconos SVG
 * en public/images/catalog-proposal/categories/.
 *
 * Hay 8 iconos de categoría (no 12). Los 12 de formats/ son envases
 * ilustrativos y NO se usan como categorías.
 */

export const MASTER_CATALOG_CATEGORY_COUNT = 8;

export type MasterCategoryIcon = {
  /** Nombre exacto en _validated_master.json / pharmacy_products.category */
  categoryName: string;
  /** Ruta pública del SVG corporativo */
  iconSrc: string;
  /** Clave estable para tests / data-attrs */
  slug: string;
};

/**
 * Correspondencias 1:1 con las 8 categorías del maestro FarmaFácil.
 * No inventar categorías adicionales.
 */
export const MASTER_CATEGORY_ICONS: readonly MasterCategoryIcon[] = [
  {
    categoryName: 'Bebé y maternidad',
    slug: 'bebe-maternidad',
    iconSrc: '/images/catalog-proposal/categories/bebe-maternidad.svg',
  },
  {
    categoryName: 'Bienestar y cuidado estacional',
    slug: 'bienestar-estacional',
    iconSrc: '/images/catalog-proposal/categories/bienestar-estacional.svg',
  },
  {
    categoryName: 'Cuidado capilar',
    slug: 'cuidado-capilar',
    iconSrc: '/images/catalog-proposal/categories/cuidado-capilar.svg',
  },
  {
    categoryName: 'Cuidado corporal e higiene',
    slug: 'cuidado-corporal',
    iconSrc: '/images/catalog-proposal/categories/cuidado-corporal.svg',
  },
  {
    categoryName: 'Cuidado facial',
    slug: 'cuidado-facial',
    iconSrc: '/images/catalog-proposal/categories/cuidado-facial.svg',
  },
  {
    categoryName: 'Higiene bucodental',
    slug: 'higiene-bucodental',
    iconSrc: '/images/catalog-proposal/categories/higiene-bucodental.svg',
  },
  {
    categoryName: 'Primeros auxilios y cuidado en casa',
    slug: 'primeros-auxilios',
    iconSrc: '/images/catalog-proposal/categories/primeros-auxilios.svg',
  },
  {
    categoryName: 'Protección solar',
    slug: 'proteccion-solar',
    iconSrc: '/images/catalog-proposal/categories/proteccion-solar.svg',
  },
] as const;

const byName = new Map(
  MASTER_CATEGORY_ICONS.map((row) => [row.categoryName.toLowerCase(), row])
);

export function resolveMasterCategoryIcon(
  categoryName: string | null | undefined
): MasterCategoryIcon | null {
  if (!categoryName?.trim()) return null;
  return byName.get(categoryName.trim().toLowerCase()) ?? null;
}

/** Categorías presentes en un listado (orden del maestro, luego extras). */
export function listCategoriesFromItems(
  items: readonly { category: string | null }[]
): string[] {
  const present = new Set(
    items
      .map((i) => i.category?.trim())
      .filter((c): c is string => Boolean(c))
  );
  const ordered: string[] = [];
  for (const row of MASTER_CATEGORY_ICONS) {
    if (present.has(row.categoryName)) {
      ordered.push(row.categoryName);
      present.delete(row.categoryName);
    }
  }
  const extras = Array.from(present).sort((a, b) => a.localeCompare(b, 'es'));
  for (const name of extras) {
    ordered.push(name);
  }
  return ordered;
}
