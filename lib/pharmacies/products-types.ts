import { z } from 'zod';

export type PharmacyProduct = {
  id: string;
  pharmacyId: string;
  sku: string | null;
  ean: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PharmacyProductRow = {
  id: string;
  pharmacy_id: string;
  sku: string | null;
  ean: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  price: number | string;
  stock: number;
  min_stock: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

export function mapPharmacyProduct(row: PharmacyProductRow): PharmacyProduct {
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id,
    sku: row.sku,
    ean: row.ean,
    name: row.name,
    description: row.description,
    brand: row.brand,
    category: row.category,
    price: typeof row.price === 'string' ? Number(row.price) : row.price,
    stock: row.stock,
    minStock: row.min_stock,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  });

export const pharmacyProductInputSchema = z.object({
  sku: optionalText,
  ean: optionalText,
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    }),
  brand: optionalText,
  category: optionalText,
  price: z.coerce.number().min(0, 'El PVP no puede ser negativo.').max(999999.99),
  stock: z.coerce.number().int('El stock debe ser entero.').min(0).max(10_000_000),
  minStock: z.coerce
    .number()
    .int('El stock mínimo debe ser entero.')
    .min(0)
    .max(10_000_000),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
});

export type PharmacyProductInput = z.infer<typeof pharmacyProductInputSchema>;

export type ProductListFilters = {
  q?: string;
  category?: string;
  status?: 'all' | 'active' | 'inactive';
};
