/**
 * Clasificación de campos de pharmacy_products para la matriz 074.
 * Pure TS — usable en tests sin DB.
 */

/** Campos que solo puede tocar quien tiene catalog.manage (o plataforma). */
export const CATALOG_COMMERCIAL_FIELDS = [
  'price',
  'name',
  'description',
  'brand',
  'category',
  'subcategory',
  'sku',
  'ean',
  'is_featured',
  'source',
  'source_ref',
  'master_catalog_id',
] as const;

/** Campos permitidos con catalog.stock.update (sin manage). */
export const CATALOG_STOCK_FIELDS = [
  'stock',
  'min_stock',
  'availability_status',
  'is_active',
] as const;

export type CatalogWriteCapability = 'manage' | 'stock' | 'read';

/**
 * ¿El patch solo toca campos de stock/disponibilidad?
 */
export function isStockOnlyProductPatch(
  patch: Record<string, unknown>
): boolean {
  const keys = Object.keys(patch).filter(
    (k) => k !== 'updated_by' && k !== 'updated_at'
  );
  if (keys.length === 0) return false;
  return keys.every((k) =>
    (CATALOG_STOCK_FIELDS as readonly string[]).includes(k)
  );
}

/**
 * Filtra un patch según capacidad. Devuelve null si no hay campos permitidos
 * o si se intentan campos comerciales sin manage.
 */
export function filterProductPatchForCapability(
  patch: Record<string, unknown>,
  capability: CatalogWriteCapability
):
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; error: string } {
  if (capability === 'read') {
    return { ok: false, error: 'No autorizado a modificar el catálogo.' };
  }
  if (capability === 'manage') {
    return { ok: true, patch };
  }

  // stock
  const commercial = Object.keys(patch).filter((k) =>
    (CATALOG_COMMERCIAL_FIELDS as readonly string[]).includes(k)
  );
  if (commercial.length > 0) {
    return {
      ok: false,
      error:
        'No tienes permiso para modificar precios ni datos comerciales del producto.',
    };
  }

  const allowed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (
      (CATALOG_STOCK_FIELDS as readonly string[]).includes(k) ||
      k === 'updated_by'
    ) {
      allowed[k] = v;
    }
  }
  if (
    Object.keys(allowed).filter((k) => k !== 'updated_by').length === 0
  ) {
    return {
      ok: false,
      error: 'No hay cambios de stock o disponibilidad para guardar.',
    };
  }
  return { ok: true, patch: allowed };
}

/** Quién puede crear productos / importar (solo manage). */
export function canManageCatalogProducts(
  capability: CatalogWriteCapability
): boolean {
  return capability === 'manage';
}
