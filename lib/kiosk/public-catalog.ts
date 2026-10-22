import { createClient } from '@/lib/supabase/server';
import { parseCatalogMode, type PharmacyCatalogMode } from '@/lib/catalog/catalog-mode';

export type PublicCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  sku: string | null;
  availabilityStatus: string;
  source: string;
  requestable: boolean;
};

export type PublicCatalogResult =
  | {
      ok: true;
      publicId: string;
      pharmacyName: string;
      catalogMode: PharmacyCatalogMode;
      items: PublicCatalogItem[];
      note: string | null;
    }
  | {
      ok: false;
      code: 'not_found' | 'inactive' | 'unavailable';
      message: string;
    };

/**
 * Catálogo público del QR (/e/{publicId}/catalogo).
 * No autentica. Respeta catalog_mode. Sin precios ni stock inventados.
 */
export async function listPublicCatalog(input: {
  publicId: string;
  query?: string;
  limit?: number;
}): Promise<PublicCatalogResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_public_catalog_list_v1', {
    p_public_id: input.publicId,
    p_query: input.query?.trim() || null,
    p_limit: input.limit ?? 60,
  });

  if (error) {
    console.error('[public-catalog]', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        code: 'unavailable',
        message:
          'El catálogo público aún no está disponible (falta migración 055).',
      };
    }
    return {
      ok: false,
      code: 'unavailable',
      message: 'No se ha podido cargar el catálogo.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status ?? '') : '';

  if (status === 'not_found') {
    return {
      ok: false,
      code: 'not_found',
      message: 'No hemos encontrado una farmacia asociada a este código.',
    };
  }
  if (status === 'inactive') {
    return {
      ok: false,
      code: 'inactive',
      message: 'Este código QR está desactivado o ha caducado.',
    };
  }
  if (status !== 'ok' || !payload) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'No se ha podido cargar el catálogo.',
    };
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items: PublicCatalogItem[] = rawItems.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      category: row.category != null ? String(row.category) : null,
      subcategory: row.subcategory != null ? String(row.subcategory) : null,
      sku: row.sku != null ? String(row.sku) : null,
      availabilityStatus: String(
        row.availability_status ?? 'confirm_with_pharmacy'
      ),
      source: String(row.source ?? ''),
      requestable: row.requestable !== false,
    };
  });

  return {
    ok: true,
    publicId: String(payload.public_id ?? input.publicId),
    pharmacyName: String(payload.pharmacy_name ?? ''),
    catalogMode: parseCatalogMode(payload.catalog_mode),
    items,
    note: payload.note != null ? String(payload.note) : null,
  };
}
