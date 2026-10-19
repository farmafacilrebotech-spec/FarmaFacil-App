import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  clearKioskSessionCookie,
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';

export type KioskCatalogProduct = {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  ean: string | null;
  category: string | null;
  price: number;
  stock: number;
  /** true si stock > 0 (dato existente; sin campo de imagen/receta). */
  available: boolean;
};

export type KioskCatalogSearchResult =
  | {
      ok: true;
      pharmacyId: string;
      query: string | null;
      items: KioskCatalogProduct[];
    }
  | {
      ok: false;
      code:
        | 'session_missing'
        | 'session_invalid'
        | 'session_revoked'
        | 'commercially_blocked'
        | 'unavailable';
      message: string;
    };

/**
 * Búsqueda de productos activos de la farmacia de la sesión kiosko.
 * Aislamiento: solo vía credential_hash → pharmacy_id de la sesión.
 */
export async function searchKioskCatalog(input: {
  query?: string;
  limit?: number;
}): Promise<KioskCatalogSearchResult> {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return {
      ok: false,
      code: 'session_missing',
      message: 'Sesión de kiosko no válida.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_search_products_v1', {
    p_credential_hash: sha256Hex(parsed.credential),
    p_query: input.query?.trim() || null,
    p_limit: input.limit ?? 40,
  });

  if (error) {
    console.error('[kiosk] catalog search', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        code: 'unavailable',
        message:
          'El catálogo del kiosko aún no está disponible en la base de datos (falta RPC 043).',
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
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'session_revoked' || status === 'session_invalid') {
    clearKioskSessionCookie();
    return {
      ok: false,
      code: status === 'session_revoked' ? 'session_revoked' : 'session_invalid',
      message: 'Sesión de kiosko no válida.',
    };
  }
  if (status === 'commercially_blocked') {
    return {
      ok: false,
      code: 'commercially_blocked',
      message: 'El kiosko no está disponible por el estado comercial.',
    };
  }
  if (status !== 'ok') {
    return {
      ok: false,
      code: 'unavailable',
      message: 'No se ha podido cargar el catálogo.',
    };
  }

  const pharmacyId = String(payload!.pharmacy_id ?? '');
  const itemsRaw = Array.isArray(payload!.items) ? payload!.items : [];
  const items: KioskCatalogProduct[] = [];

  for (const rawItem of itemsRaw) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const row = rawItem as Record<string, unknown>;
    const id = String(row.id ?? '');
    if (!id) continue;
    // Defensa en profundidad: no aceptar filas sin is_active true
    if (row.is_active === false) continue;
    const stock = Number(row.stock);
    const price = Number(row.price);
    items.push({
      id,
      name: String(row.name ?? 'Producto'),
      brand: row.brand == null || row.brand === '' ? null : String(row.brand),
      sku: row.sku == null || row.sku === '' ? null : String(row.sku),
      ean: row.ean == null || row.ean === '' ? null : String(row.ean),
      category:
        row.category == null || row.category === ''
          ? null
          : String(row.category),
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,
      available: Number.isFinite(stock) && stock > 0,
    });
  }

  return {
    ok: true,
    pharmacyId,
    query:
      payload!.query == null || payload!.query === ''
        ? null
        : String(payload!.query),
    items,
  };
}

export { assertCatalogItemsBelongToPharmacy } from '@/lib/kiosk/catalog-guards';
