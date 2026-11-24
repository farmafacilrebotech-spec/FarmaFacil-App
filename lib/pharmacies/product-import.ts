import {
  autoMapColumns,
  cellAt,
  parseNumberLoose,
  type ColumnMapping,
  type ColumnMappingHint,
  type ParsedSpreadsheet,
} from '@/lib/import/spreadsheet';
import type { PharmacyProduct } from '@/lib/pharmacies/products-types';
import {
  isBlankCell,
  isBlankProductDraft,
  isInvalidProductName,
  isJunkStructuralRow,
  looksLikeEan13,
  looksLikeNationalCode,
  normalizeIdentifier,
} from '@/lib/pharmacies/product-import-validate';

export const PRODUCT_COLUMN_HINTS: ColumnMappingHint[] = [
  {
    field: 'name',
    label: 'Producto',
    required: true,
    aliases: [
      'producto',
      'articulo',
      'artículo',
      'nombre',
      'name',
      'product',
      'item',
    ],
  },
  {
    field: 'nationalCode',
    label: 'Código Nacional',
    aliases: [
      'codigo nacional',
      'código nacional',
      'cn',
      'national code',
      'cod nacional',
    ],
  },
  {
    field: 'ean',
    label: 'EAN',
    aliases: [
      'ean',
      'ean13',
      'codigo de barras',
      'código de barras',
      'barcode',
      'gtin',
    ],
  },
  {
    field: 'sku',
    label: 'Código interno',
    aliases: [
      'sku',
      'codigo interno',
      'código interno',
      'referencia',
      'ref',
      'ref interna',
    ],
  },
  {
    field: 'price',
    label: 'PVP',
    aliases: [
      'pvp',
      'precio',
      'precio venta',
      'precio de venta',
      'price',
      'importe',
    ],
  },
  {
    field: 'stock',
    label: 'Stock (opcional)',
    aliases: [
      'stock',
      'existencias',
      'unidades',
      'cantidad',
      'inventory',
      'qty',
    ],
  },
  {
    field: 'minStock',
    label: 'Stock mínimo (opcional)',
    aliases: [
      'stock minimo',
      'stock mínimo',
      'min stock',
      'stock min',
      'existencia minima',
    ],
  },
  {
    field: 'sourceFamily',
    label: 'Familia original',
    aliases: ['familia', 'familia original', 'family', 'grupo'],
  },
  {
    field: 'sourceSubfamily',
    label: 'Subfamilia original',
    aliases: ['subfamilia', 'subfamilia original', 'subfamily'],
  },
  {
    field: 'category',
    label: 'Categoría FarmaFácil',
    aliases: ['categoria farmafacil', 'categoría farmafacil', 'categoria ff'],
  },
  {
    field: 'brand',
    label: 'Marca',
    // No mapear «laboratorio» aquí: es un campo distinto.
    aliases: ['marca', 'brand'],
  },
  {
    field: 'laboratory',
    label: 'Laboratorio',
    aliases: ['laboratorio', 'lab', 'fabricante', 'laboratory'],
  },
  {
    field: 'description',
    label: 'Descripción',
    aliases: [
      'descripcion',
      'descripción',
      'descripcion larga',
      'detalle',
      'notas',
      'description',
    ],
  },
];

export type ProductImportDraft = {
  rowIndex: number;
  sku: string | null;
  ean: string | null;
  /** Código Nacional (CN); aún sin columna dedicada en BD — ver migración propuesta. */
  nationalCode: string | null;
  name: string;
  brand: string | null;
  laboratory: string | null;
  category: string | null;
  sourceFamily: string | null;
  sourceSubfamily: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  minStock: number | null;
  priceProvided: boolean;
  stockProvided: boolean;
  minStockProvided: boolean;
};

export type ProductImportIssue = {
  rowIndex: number;
  level: 'error' | 'warning';
  message: string;
};

export type ProductImportAction =
  | 'create'
  | 'update'
  | 'unchanged'
  | 'skip'
  | 'pending_classification';

export type ProductImportPreviewRow = {
  draft: ProductImportDraft;
  action: ProductImportAction;
  matchedProductId: string | null;
  issues: ProductImportIssue[];
};

export type ProductImportSummary = {
  /** Filas leídas del archivo (tras parseo). */
  rowsRead: number;
  /** Filas vacías / placeholder descartadas. */
  emptyDiscarded: number;
  /** Filas inválidas (error) o estructurales (subtotal/cabecera). */
  invalidRows: number;
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  creates: number;
  updates: number;
  unchanged: number;
  skips: number;
  pendingClassification: number;
  duplicatesInFile: number;
  unmatchedExisting: number;
};

export type ProductImportPreview = {
  headers: string[];
  mapping: ColumnMapping;
  rows: ProductImportPreviewRow[];
  summary: ProductImportSummary;
};

export function suggestProductColumnMapping(headers: string[]): ColumnMapping {
  return autoMapColumns(headers, PRODUCT_COLUMN_HINTS);
}

function emptyToNull(value: string): string | null {
  const t = value.trim();
  if (!t || isBlankCell(t)) return null;
  return t;
}

export function buildProductDrafts(
  sheet: ParsedSpreadsheet,
  mapping: ColumnMapping
): ProductImportDraft[] {
  return sheet.rows.map((row, idx) => {
    const rowIndex = idx + 2;
    const nameRaw = cellAt(row, mapping.name);
    const sku = normalizeIdentifier(cellAt(row, mapping.sku));
    let ean = normalizeIdentifier(cellAt(row, mapping.ean));
    let nationalCode = normalizeIdentifier(cellAt(row, mapping.nationalCode));
    const brand = emptyToNull(cellAt(row, mapping.brand));
    const laboratory = emptyToNull(cellAt(row, mapping.laboratory));
    const category = emptyToNull(cellAt(row, mapping.category));
    const sourceFamily = emptyToNull(cellAt(row, mapping.sourceFamily));
    const sourceSubfamily = emptyToNull(cellAt(row, mapping.sourceSubfamily));
    const description = emptyToNull(cellAt(row, mapping.description));
    const priceRaw = cellAt(row, mapping.price);
    const stockRaw = cellAt(row, mapping.stock);
    const minStockRaw = cellAt(row, mapping.minStock);
    // Precio/stock: celda con "0" cuenta como valor cero real (provided).
    const priceProvided = priceRaw.trim().length > 0;
    const stockProvided = stockRaw.trim().length > 0;
    const minStockProvided = minStockRaw.trim().length > 0;

    // Si «EAN» trae un CN (6–7 dígitos) y no hay CN explícito, reclasificar.
    if (ean && !nationalCode && looksLikeNationalCode(ean) && !looksLikeEan13(ean)) {
      nationalCode = ean;
      ean = null;
    }

    return {
      rowIndex,
      sku,
      ean,
      nationalCode,
      name: nameRaw.trim(),
      brand,
      laboratory,
      category,
      sourceFamily,
      sourceSubfamily,
      description,
      price: priceProvided ? parseNumberLoose(priceRaw) : null,
      stock: stockProvided ? parseNumberLoose(stockRaw) : null,
      minStock: minStockProvided ? parseNumberLoose(minStockRaw) : null,
      priceProvided,
      stockProvided,
      minStockProvided,
    };
  });
}

/**
 * Matching (nunca solo por nombre):
 * 1) EAN
 * 2) Código Nacional (mientras no haya columna BD: match vía sku/ean existentes)
 * 3) SKU / código interno
 * Duplicados en archivo por EAN/SKU/CN → error.
 */
export function buildProductImportPreview(
  sheet: ParsedSpreadsheet,
  mapping: ColumnMapping,
  existing: PharmacyProduct[]
): ProductImportPreview {
  const drafts = buildProductDrafts(sheet, mapping);
  const byEan = new Map<string, PharmacyProduct>();
  const bySku = new Map<string, PharmacyProduct>();
  for (const p of existing) {
    if (p.ean) byEan.set(p.ean.trim().toLowerCase(), p);
    if (p.sku) bySku.set(p.sku.trim().toLowerCase(), p);
  }

  const seenEan = new Map<string, number>();
  const seenSku = new Map<string, number>();
  const seenCn = new Map<string, number>();

  let emptyDiscarded = 0;
  let invalidRows = 0;
  let duplicatesInFile = 0;

  const rows: ProductImportPreviewRow[] = drafts.map((draft) => {
    const issues: ProductImportIssue[] = [];

    if (
      isBlankProductDraft(draft) ||
      (isInvalidProductName(draft.name) &&
        isBlankCell(draft.sku) &&
        isBlankCell(draft.ean) &&
        isBlankCell(draft.nationalCode))
    ) {
      emptyDiscarded += 1;
      return {
        draft,
        action: 'skip' as const,
        matchedProductId: null,
        issues: [
          {
            rowIndex: draft.rowIndex,
            level: 'warning' as const,
            message:
              'Fila vacía o sin nombre válido (p. ej. celdas en 0): se omitirá.',
          },
        ],
      };
    }

    if (isJunkStructuralRow(draft)) {
      invalidRows += 1;
      return {
        draft,
        action: 'skip' as const,
        matchedProductId: null,
        issues: [
          {
            rowIndex: draft.rowIndex,
            level: 'warning' as const,
            message:
              'Fila estructural (cabecera repetida, subtotal u observación): se omitirá.',
          },
        ],
      };
    }

    if (isInvalidProductName(draft.name)) {
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'error',
        message: 'Nombre de producto no válido.',
      });
    }
    if (draft.priceProvided && (draft.price == null || draft.price < 0)) {
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'error',
        message: 'PVP inválido.',
      });
    }
    if (
      draft.stockProvided &&
      (draft.stock == null ||
        draft.stock < 0 ||
        !Number.isInteger(draft.stock))
    ) {
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'error',
        message: 'Stock inválido (entero ≥ 0).',
      });
    }
    if (
      draft.minStockProvided &&
      (draft.minStock == null ||
        draft.minStock < 0 ||
        !Number.isInteger(draft.minStock))
    ) {
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'error',
        message: 'Stock mínimo inválido.',
      });
    }

    if (draft.ean) {
      const key = draft.ean.toLowerCase();
      if (seenEan.has(key)) {
        duplicatesInFile += 1;
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'error',
          message: `EAN duplicado en el archivo (fila ${seenEan.get(key)}).`,
        });
      } else {
        seenEan.set(key, draft.rowIndex);
      }
    }
    if (draft.sku) {
      const key = draft.sku.toLowerCase();
      if (seenSku.has(key)) {
        duplicatesInFile += 1;
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'error',
          message: `Código interno duplicado en el archivo (fila ${seenSku.get(key)}).`,
        });
      } else {
        seenSku.set(key, draft.rowIndex);
      }
    }
    if (draft.nationalCode) {
      const key = draft.nationalCode.toLowerCase();
      if (seenCn.has(key)) {
        duplicatesInFile += 1;
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'error',
          message: `Código Nacional duplicado en el archivo (fila ${seenCn.get(key)}).`,
        });
      } else {
        seenCn.set(key, draft.rowIndex);
      }
      if (!looksLikeNationalCode(draft.nationalCode)) {
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'warning',
          message: 'Código Nacional con formato poco habitual.',
        });
      }
    }

    let matched: PharmacyProduct | null = null;
    if (draft.ean) matched = byEan.get(draft.ean.toLowerCase()) ?? null;
    if (!matched && draft.nationalCode) {
      matched =
        bySku.get(draft.nationalCode.toLowerCase()) ??
        byEan.get(draft.nationalCode.toLowerCase()) ??
        null;
    }
    if (!matched && draft.sku) {
      matched = bySku.get(draft.sku.toLowerCase()) ?? null;
    }

    const hasFfCategory = !isBlankCell(draft.category);
    const hasSourceFamily = !isBlankCell(draft.sourceFamily);

    const hasError = issues.some((i) => i.level === 'error');
    let action: ProductImportAction = 'create';
    if (hasError || isInvalidProductName(draft.name)) {
      action = 'skip';
      invalidRows += 1;
    } else if (matched) {
      if (importDraftUnchanged(draft, matched)) {
        action = 'unchanged';
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'warning',
          message: `Sin cambios respecto a «${matched.name}».`,
        });
      } else {
        action = 'update';
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'warning',
          message: `Se actualizará «${matched.name}».`,
        });
      }
    } else if (!hasFfCategory && hasSourceFamily) {
      action = 'pending_classification';
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'warning',
        message:
          'Pendiente de clasificar: tiene familia de origen sin categoría FarmaFácil.',
      });
    }

    return {
      draft,
      action,
      matchedProductId: matched?.id ?? null,
      issues,
    };
  });

  return {
    headers: sheet.headers,
    mapping,
    rows,
    summary: {
      rowsRead: drafts.length,
      emptyDiscarded,
      invalidRows,
      total: rows.length,
      valid: rows.filter(
        (r) => r.action === 'create' || r.action === 'update'
      ).length,
      warnings: rows.filter((r) =>
        r.issues.some((i) => i.level === 'warning')
      ).length,
      errors: rows.filter((r) => r.issues.some((i) => i.level === 'error'))
        .length,
      creates: rows.filter((r) => r.action === 'create').length,
      updates: rows.filter((r) => r.action === 'update').length,
      unchanged: rows.filter((r) => r.action === 'unchanged').length,
      skips: rows.filter((r) => r.action === 'skip').length,
      pendingClassification: rows.filter(
        (r) => r.action === 'pending_classification'
      ).length,
      duplicatesInFile,
      unmatchedExisting: 0,
    },
  };
}

function normCmp(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

function importDraftUnchanged(
  draft: ProductImportDraft,
  existing: PharmacyProduct
): boolean {
  if (!normCmp(draft.name, existing.name)) return false;
  if (draft.sku && !normCmp(draft.sku, existing.sku)) return false;
  if (draft.ean && !normCmp(draft.ean, existing.ean)) return false;
  if (draft.brand && !normCmp(draft.brand, existing.brand)) return false;
  if (draft.category && !normCmp(draft.category, existing.category)) return false;
  if (draft.description && !normCmp(draft.description, existing.description)) {
    return false;
  }
  if (draft.priceProvided && draft.price != null && draft.price !== existing.price) {
    return false;
  }
  if (draft.stockProvided && draft.stock != null && draft.stock !== existing.stock) {
    return false;
  }
  return true;
}

/** Reutilizable en confirm: no confiar solo en `action` del cliente. */
export function shouldPersistImportRow(row: {
  action: ProductImportAction;
  draft: ProductImportDraft;
}): boolean {
  if (row.action === 'skip' || row.action === 'unchanged') {
    return false;
  }
  if (
    isBlankProductDraft(row.draft) ||
    isInvalidProductName(row.draft.name) ||
    isJunkStructuralRow(row.draft)
  ) {
    return false;
  }
  return (
    row.action === 'create' ||
    row.action === 'update' ||
    row.action === 'pending_classification'
  );
}

/** Informe de previsualización descargable (sin PII de clientes). */
export function buildProductImportReport(preview: ProductImportPreview): string {
  const lines: string[] = [
    'FarmaFacil — informe previsualización importación catálogo',
    `generatedAtUtc=${new Date().toISOString()}`,
    '--- summary ---',
    `rowsRead=${preview.summary.rowsRead}`,
    `emptyDiscarded=${preview.summary.emptyDiscarded}`,
    `invalidRows=${preview.summary.invalidRows}`,
    `duplicatesInFile=${preview.summary.duplicatesInFile}`,
    `creates=${preview.summary.creates}`,
    `updates=${preview.summary.updates}`,
    `unchanged=${preview.summary.unchanged}`,
    `pendingClassification=${preview.summary.pendingClassification}`,
    `skips=${preview.summary.skips}`,
    '--- rows ---',
    'rowIndex\taction\tname\tsku\tean\tnationalCode\tbrand\tsourceFamily\tissue',
  ];
  for (const r of preview.rows) {
    const issue = r.issues.map((i) => i.message).join(' | ').replace(/\t/g, ' ');
    lines.push(
      [
        r.draft.rowIndex,
        r.action,
        (r.draft.name || '').replace(/\t/g, ' '),
        r.draft.sku ?? '',
        r.draft.ean ?? '',
        r.draft.nationalCode ?? '',
        (r.draft.brand || '').replace(/\t/g, ' '),
        (r.draft.sourceFamily || '').replace(/\t/g, ' '),
        issue,
      ].join('\t')
    );
  }
  return lines.join('\n') + '\n';
}

export const FARMAFACIL_PRODUCT_TEMPLATE_HEADERS = [
  'SKU',
  'EAN',
  'Producto',
  'Marca',
  'Categoría',
  'PVP',
  'Stock',
  'Stock mínimo',
] as const;

export function buildProductTemplateCsv(): string {
  const header = FARMAFACIL_PRODUCT_TEMPLATE_HEADERS.join(';');
  const example = [
    'REF-001',
    '8470001234567',
    'Paracetamol 1g 20 comprimidos',
    'Genérico',
    'Analgésicos',
    '4,95',
    '25',
    '5',
  ].join(';');
  return `${header}\n${example}\n`;
}
