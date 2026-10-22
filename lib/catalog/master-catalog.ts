/**
 * Catálogo maestro genérico FarmaFácil (FF-GEN-001..100).
 * Fuente: data/catalogo/Catalogo_Maestro_FarmaFacil_100.xlsx
 * Validado: data/catalogo/_validated_master.json
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MASTER_CATALOG_VERSION = 'ff_master_v1';
export const MASTER_CATALOG_EXPECTED_COUNT = 100;

export type MasterCatalogRow = {
  catalog_product_id: string;
  category_id: string;
  category_name: string;
  subcategory_name: string;
  generic_product_type: string;
  record_type: string;
  brand: string | null;
  price: number | string | null;
  availability_status: string;
  image_url: string | null;
  active_standard_catalog: boolean;
  available_in_plans: string;
};

type ValidatedFile = {
  count: number;
  categories: string[];
  subcategories: string[];
  rows: MasterCatalogRow[];
  validation: Record<string, boolean>;
};

let cached: ValidatedFile | null = null;

function loadValidated(): ValidatedFile {
  if (cached) return cached;
  const path = join(
    process.cwd(),
    'data/catalogo/_validated_master.json'
  );
  cached = JSON.parse(readFileSync(path, 'utf8')) as ValidatedFile;
  return cached;
}

export function masterSourceRef(id: string): string {
  return `${MASTER_CATALOG_VERSION}:${id}`;
}

export function isMasterCatalogId(id: string): boolean {
  return /^FF-GEN-\d{3}$/.test(id);
}

export function getValidatedMasterRows(): MasterCatalogRow[] {
  return loadValidated().rows;
}

export function validateMasterCatalogLocal(): {
  ok: boolean;
  errors: string[];
  count: number;
  categories: number;
  subcategories: number;
} {
  const file = loadValidated();
  const rows = file.rows;
  const errors: string[] = [];
  const ids = rows.map((r) => r.catalog_product_id);
  const expected = Array.from({ length: 100 }, (_, i) =>
    `FF-GEN-${String(i + 1).padStart(3, '0')}`
  );

  if (rows.length !== 100) {
    errors.push(`Se esperaban 100 filas, hay ${rows.length}`);
  }
  if (new Set(ids).size !== ids.length) {
    errors.push('Hay IDs duplicados');
  }
  for (const e of expected) {
    if (!ids.includes(e)) errors.push(`Falta ${e}`);
  }
  for (const id of ids) {
    if (!isMasterCatalogId(id)) errors.push(`ID inválido: ${id}`);
  }
  for (const r of rows) {
    if (r.brand != null && String(r.brand).trim() !== '') {
      errors.push(`${r.catalog_product_id}: brand no debe estar definida`);
    }
    if (r.price != null && String(r.price).trim() !== '') {
      errors.push(`${r.catalog_product_id}: price no debe estar definido`);
    }
    if (r.image_url != null && String(r.image_url).trim() !== '') {
      errors.push(`${r.catalog_product_id}: image_url no debe estar definida`);
    }
    if (r.availability_status !== 'confirm_with_pharmacy') {
      errors.push(
        `${r.catalog_product_id}: availability_status=${r.availability_status}`
      );
    }
    if (r.available_in_plans !== 'pilot,general') {
      errors.push(
        `${r.catalog_product_id}: available_in_plans=${r.available_in_plans}`
      );
    }
    if (!r.generic_product_type?.trim()) {
      errors.push(`${r.catalog_product_id}: generic_product_type vacío`);
    }
  }

  const categories = new Set(rows.map((r) => r.category_name));
  const subcategories = new Set(rows.map((r) => r.subcategory_name));
  if (categories.size !== 8) {
    errors.push(`Se esperaban 8 categorías, hay ${categories.size}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    count: rows.length,
    categories: categories.size,
    subcategories: subcategories.size,
  };
}

export function isGenericProjectionSource(
  source: string | null | undefined
): boolean {
  return source === 'generic' || source === 'demo';
}

/** Fuentes visibles según modalidad activa (espejo SQL 054). */
export function sourcesVisibleForCatalogMode(
  mode: 'generic' | 'own'
): readonly string[] {
  // own incluye demo legacy para no vaciar catálogos mixtos existentes.
  return mode === 'own'
    ? ['manual', 'import', 'demo']
    : ['generic', 'demo'];
}

export function productVisibleInActiveCatalog(
  source: string | null | undefined,
  mode: 'generic' | 'own'
): boolean {
  if (!source) return false;
  return sourcesVisibleForCatalogMode(mode).includes(source);
}
