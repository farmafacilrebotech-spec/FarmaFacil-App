import { searchKioskCatalog, type KioskCatalogProduct } from '@/lib/kiosk/catalog';
import { searchDemoCatalog } from '@/lib/kiosk/assistant/demo-catalog';
import {
  extractCatalogSearchQueries,
  isProductSeekingMessage,
} from '@/lib/kiosk/assistant/product-intent';

export type AssistantCatalogHit = KioskCatalogProduct & {
  /** false en DEMO: no se añade al carrito real. */
  canAddToCart: boolean;
};

export type AssistantCatalogSearchResult = {
  sought: boolean;
  queries: string[];
  products: AssistantCatalogHit[];
};

/**
 * Búsqueda controlada para el asistente.
 * DEMO → catálogo demo. CONTRATADO → RPC 043 vía sesión.
 * Sin acceso a catálogo → vacío (no inventa).
 */
export async function searchAssistantCatalog(input: {
  userMessage: string;
  mode: 'demo' | 'contracted';
  catalogAccess: boolean;
  pharmacyId: string;
  limit?: number;
}): Promise<AssistantCatalogSearchResult> {
  const sought = isProductSeekingMessage(input.userMessage);
  if (!sought) {
    return { sought: false, queries: [], products: [] };
  }

  const queries = extractCatalogSearchQueries(input.userMessage);
  const limit = input.limit ?? 6;

  if (input.mode === 'demo' || !input.catalogAccess) {
    const items = searchDemoCatalog({ queries, limit });
    return {
      sought: true,
      queries,
      products: items.map((p) => ({ ...p, canAddToCart: false })),
    };
  }

  // CONTRATADO: una o más búsquedas controladas, fusionadas por id.
  const byId = new Map<string, KioskCatalogProduct>();
  const searchQueries = queries.length > 0 ? queries : [''];

  for (const q of searchQueries.slice(0, 2)) {
    const result = await searchKioskCatalog({
      query: q || undefined,
      limit: Math.max(limit, 12),
    });
    if (!result.ok) {
      // Sesión/comercial: devolver lo ya acumulado; el caller gestiona errores graves.
      if (
        result.code === 'session_missing' ||
        result.code === 'session_invalid' ||
        result.code === 'session_revoked' ||
        result.code === 'commercially_blocked'
      ) {
        return {
          sought: true,
          queries,
          products: [],
        };
      }
      continue;
    }
    if (result.pharmacyId !== input.pharmacyId) {
      console.error('[assistant] catalog pharmacy mismatch');
      return { sought: true, queries, products: [] };
    }
    for (const item of result.items) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }

  const products = Array.from(byId.values())
    .sort(
      (a, b) =>
        Number(b.available) - Number(a.available) || a.name.localeCompare(b.name)
    )
    .slice(0, limit)
    .map((p) => ({ ...p, canAddToCart: true }));

  return { sought: true, queries, products };
}

export function formatCatalogHitsForPrompt(
  products: AssistantCatalogHit[]
): string {
  if (!products.length) {
    return 'No hay coincidencias en el catálogo autorizado para esta consulta. Orienta al buscador del kiosko o al mostrador; no inventes productos ni precios.';
  }
  return [
    'Coincidencias reales del catálogo autorizado (únicas fuentes de producto/precio; no inventes otras):',
    ...products.map((p, i) => {
      const stockNote = p.available
        ? `disponible (stock ${p.stock})`
        : 'sin stock ahora';
      return `${i + 1}. id=${p.id} · ${p.name}${p.brand ? ` (${p.brand})` : ''} · ${p.price.toFixed(2)} € · ${stockNote}`;
    }),
    'Presenta estas coincidencias como orientación sobre el catálogo autorizado. No inventes características ni afirmes idoneidad clínica individual. Si no encajan del todo, dilo y sugiere el buscador o el farmacéutico del mostrador.',
  ].join('\n');
}
