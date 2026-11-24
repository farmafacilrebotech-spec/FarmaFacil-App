/**
 * Reglas compartidas preview ↔ commit para importación de catálogo.
 * Sin PII. No inventa datos de producto.
 */

/** Subconjunto tipado local para no acoplar el validador al módulo UI. */
export type ImportDraftLike = {
  name: string;
  sku: string | null;
  ean: string | null;
  nationalCode?: string | null;
  brand: string | null;
  laboratory?: string | null;
  category: string | null;
  sourceFamily?: string | null;
  sourceSubfamily?: string | null;
  description: string | null;
  priceProvided: boolean;
  stockProvided: boolean;
  minStockProvided: boolean;
};

/** Celdas Excel numéricas vacías suelen llegar como "0" / "0.0". */
const PLACEHOLDER_TEXT = new Set([
  '',
  '0',
  '0.0',
  '0,0',
  '-',
  '—',
  'n/a',
  'na',
  'null',
  'undefined',
  '#n/a',
  '#¡valor!',
  '#value!',
]);

export function isBlankCell(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  if (!t) return true;
  return PLACEHOLDER_TEXT.has(t.toLowerCase());
}

/** Nombre inválido para alta comercial (incluye placeholders Excel). */
export function isInvalidProductName(name: string | null | undefined): boolean {
  if (name == null) return true;
  const t = name.trim();
  if (t.length < 2) return true;
  return PLACEHOLDER_TEXT.has(t.toLowerCase());
}

/**
 * Fila sin contenido útil de producto.
 * Distingue vacío de cero real en precio/stock (priceProvided/stockProvided).
 */
export function isBlankProductDraft(draft: ImportDraftLike): boolean {
  const textBlank =
    isBlankCell(draft.name) &&
    isBlankCell(draft.sku) &&
    isBlankCell(draft.ean) &&
    isBlankCell(draft.brand) &&
    isBlankCell(draft.category) &&
    isBlankCell(draft.description) &&
    isBlankCell(draft.nationalCode) &&
    isBlankCell(draft.laboratory) &&
    isBlankCell(draft.sourceFamily) &&
    isBlankCell(draft.sourceSubfamily);

  const numsBlank =
    !draft.priceProvided && !draft.stockProvided && !draft.minStockProvided;

  return textBlank && numsBlank;
}

/** Normaliza identificadores como texto (preserva ceros a la izquierda). */
export function normalizeIdentifier(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t || isBlankCell(t)) return null;
  // Evitar notación científica / floats de Excel en códigos.
  if (/^\d+\.0+$/.test(t)) return t.replace(/\.0+$/, '');
  return t;
}

export function looksLikeEan13(value: string): boolean {
  return /^\d{13}$/.test(value) || /^\d{12}$/.test(value);
}

export function looksLikeNationalCode(value: string): boolean {
  return /^\d{6,7}$/.test(value);
}

const JUNK_NAME_RE =
  /^(total|subtotal|suma|observaciones?|notas?|comentario|comments?|producto|nombre|descripcion|descripción|articulo|artículo|ean|sku|pvp|precio|stock|marca|familia|categoria|categoría)$/i;

/**
 * Encabezados repetidos, subtotales o filas de observaciones — no son productos.
 */
export function isJunkStructuralRow(draft: ImportDraftLike): boolean {
  const name = (draft.name ?? '').trim();
  if (!name) return false;
  if (JUNK_NAME_RE.test(name)) return true;
  // Subtotal típico: nombre tipo "Total ..." sin identificadores
  if (
    /^(total|subtotal)\b/i.test(name) &&
    isBlankCell(draft.sku) &&
    isBlankCell(draft.ean) &&
    isBlankCell(draft.nationalCode)
  ) {
    return true;
  }
  return false;
}
