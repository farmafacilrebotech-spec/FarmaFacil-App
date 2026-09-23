import {
  autoMapColumns,
  cellAt,
  parseNumberLoose,
  type ColumnMapping,
  type ColumnMappingHint,
  type ParsedSpreadsheet,
} from '@/lib/import/spreadsheet';
import type { PharmacyProduct } from '@/lib/pharmacies/products-types';

export const PRODUCT_COLUMN_HINTS: ColumnMappingHint[] = [
  {
    field: 'name',
    label: 'Producto',
    required: true,
    aliases: [
      'producto',
      'articulo',
      'artículo',
      'descripcion',
      'descripción',
      'nombre',
      'name',
      'product',
      'item',
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
    label: 'SKU',
    aliases: [
      'sku',
      'codigo',
      'código',
      'referencia',
      'ref',
      'cod',
      'codigo interno',
      'código interno',
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
    label: 'Stock',
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
    label: 'Stock mínimo',
    aliases: [
      'stock minimo',
      'stock mínimo',
      'min stock',
      'stock min',
      'existencia minima',
    ],
  },
  {
    field: 'category',
    label: 'Categoría',
    aliases: ['categoria', 'categoría', 'familia', 'category', 'grupo'],
  },
  {
    field: 'brand',
    label: 'Marca',
    aliases: ['marca', 'laboratorio', 'brand', 'lab', 'fabricante'],
  },
  {
    field: 'description',
    label: 'Descripción',
    aliases: ['descripcion larga', 'detalle', 'notas', 'description'],
  },
];

export type ProductImportDraft = {
  rowIndex: number;
  sku: string | null;
  ean: string | null;
  name: string;
  brand: string | null;
  category: string | null;
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

export type ProductImportAction = 'create' | 'update' | 'skip';

export type ProductImportPreviewRow = {
  draft: ProductImportDraft;
  action: ProductImportAction;
  matchedProductId: string | null;
  issues: ProductImportIssue[];
};

export type ProductImportPreview = {
  headers: string[];
  mapping: ColumnMapping;
  rows: ProductImportPreviewRow[];
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    creates: number;
    updates: number;
    skips: number;
  };
};

export function suggestProductColumnMapping(headers: string[]): ColumnMapping {
  return autoMapColumns(headers, PRODUCT_COLUMN_HINTS);
}

function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function buildProductDrafts(
  sheet: ParsedSpreadsheet,
  mapping: ColumnMapping
): ProductImportDraft[] {
  return sheet.rows.map((row, idx) => {
    const rowIndex = idx + 2;
    const name = cellAt(row, mapping.name);
    const sku = emptyToNull(cellAt(row, mapping.sku));
    const ean = emptyToNull(cellAt(row, mapping.ean));
    const brand = emptyToNull(cellAt(row, mapping.brand));
    const category = emptyToNull(cellAt(row, mapping.category));
    const description = emptyToNull(cellAt(row, mapping.description));
    const priceRaw = cellAt(row, mapping.price);
    const stockRaw = cellAt(row, mapping.stock);
    const minStockRaw = cellAt(row, mapping.minStock);
    const priceProvided = priceRaw.length > 0;
    const stockProvided = stockRaw.length > 0;
    const minStockProvided = minStockRaw.length > 0;

    return {
      rowIndex,
      sku,
      ean,
      name: name.trim(),
      brand,
      category,
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
 * Matching:
 * 1) EAN (si viene) dentro de la farmacia
 * 2) si no, SKU dentro de la farmacia
 * 3) si no, alta nueva
 * Duplicados en archivo por EAN/SKU → error.
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

  const rows: ProductImportPreviewRow[] = drafts.map((draft) => {
    const issues: ProductImportIssue[] = [];
    const isEmpty = !draft.name && !draft.sku && !draft.ean;

    if (isEmpty) {
      return {
        draft,
        action: 'skip' as const,
        matchedProductId: null,
        issues: [
          {
            rowIndex: draft.rowIndex,
            level: 'warning' as const,
            message: 'Fila vacía: se omitirá.',
          },
        ],
      };
    }

    if (!draft.name) {
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'error',
        message: 'Falta el nombre del producto.',
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
        issues.push({
          rowIndex: draft.rowIndex,
          level: 'error',
          message: `SKU duplicado en el archivo (fila ${seenSku.get(key)}).`,
        });
      } else {
        seenSku.set(key, draft.rowIndex);
      }
    }

    let matched: PharmacyProduct | null = null;
    if (draft.ean) matched = byEan.get(draft.ean.toLowerCase()) ?? null;
    if (!matched && draft.sku) {
      matched = bySku.get(draft.sku.toLowerCase()) ?? null;
    }

    const hasError = issues.some((i) => i.level === 'error');
    let action: ProductImportAction = 'create';
    if (hasError || !draft.name) {
      action = 'skip';
    } else if (matched) {
      action = 'update';
      issues.push({
        rowIndex: draft.rowIndex,
        level: 'warning',
        message: `Se actualizará «${matched.name}».`,
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
      total: rows.length,
      valid: rows.filter((r) => r.action !== 'skip').length,
      warnings: rows.filter((r) =>
        r.issues.some((i) => i.level === 'warning')
      ).length,
      errors: rows.filter((r) => r.issues.some((i) => i.level === 'error'))
        .length,
      creates: rows.filter((r) => r.action === 'create').length,
      updates: rows.filter((r) => r.action === 'update').length,
      skips: rows.filter((r) => r.action === 'skip').length,
    },
  };
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
