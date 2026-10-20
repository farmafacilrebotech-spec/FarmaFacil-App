/**
 * Catálogo genérico de demostración (no pertenece a ninguna farmacia real).
 * IDs con prefijo demo- para que el checkout real los rechace si se colaran.
 */

import type { KioskCatalogProduct } from '@/lib/kiosk/catalog';

export const DEMO_CATALOG_PRODUCTS: KioskCatalogProduct[] = [
  {
    id: 'demo-0001-hydratant',
    name: 'Crema hidratante facial (demo)',
    brand: 'DemoCare',
    sku: 'DEMO-HYD-50',
    ean: null,
    category: 'Cuidado facial',
    price: 12.9,
    stock: 8,
    available: true,
  },
  {
    id: 'demo-0002-solar-kids',
    name: 'Protector solar infantil FPS 50 (demo)',
    brand: 'DemoSun',
    sku: 'DEMO-SUN-K50',
    ean: null,
    category: 'Solar',
    price: 15.5,
    stock: 5,
    available: true,
  },
  {
    id: 'demo-0003-shampoo',
    name: 'Champú para cabello graso (demo)',
    brand: 'DemoHair',
    sku: 'DEMO-SH-GR',
    ean: null,
    category: 'Capilar',
    price: 9.75,
    stock: 12,
    available: true,
  },
  {
    id: 'demo-0004-bucal',
    name: 'Pasta dental higiene bucal (demo)',
    brand: 'DemoDent',
    sku: 'DEMO-DEN-75',
    ean: null,
    category: 'Higiene bucal',
    price: 4.2,
    stock: 20,
    available: true,
  },
  {
    id: 'demo-0005-vitc',
    name: 'Complemento vitamina C (demo)',
    brand: 'DemoVita',
    sku: 'DEMO-VIT-C',
    ean: null,
    category: 'Complementos',
    price: 11.0,
    stock: 0,
    available: false,
  },
];

export function searchDemoCatalog(input: {
  queries: string[];
  limit?: number;
}): KioskCatalogProduct[] {
  const limit = Math.max(1, Math.min(input.limit ?? 8, 12));
  const needles = input.queries
    .map((q) => q.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''))
    .filter(Boolean);

  if (needles.length === 0) {
    return DEMO_CATALOG_PRODUCTS.filter((p) => p.available).slice(0, limit);
  }

  const scored = DEMO_CATALOG_PRODUCTS.map((p) => {
    const hay = `${p.name} ${p.brand ?? ''} ${p.category ?? ''} ${p.sku ?? ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    let score = 0;
    for (const n of needles) {
      if (hay.includes(n)) score += 2;
      for (const token of n.split(/\s+/)) {
        if (token.length >= 3 && hay.includes(token)) score += 1;
      }
    }
    return { p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));

  return scored.slice(0, limit).map((x) => x.p);
}

export function isDemoCatalogProductId(id: string): boolean {
  return String(id ?? '').startsWith('demo-');
}
