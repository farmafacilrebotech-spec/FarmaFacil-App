import { createClient } from '@/lib/supabase/server';

export type PharmacyTenantDashboardStats = {
  ordersToday: number;
  activeProducts: number;
  /** true si las consultas fallaron (mostrar aviso, no inventar). */
  partialError: boolean;
};

/**
 * KPIs del dashboard tenant.
 * - Pedidos hoy: todos los sources (incluye public_qr / request_pending).
 * - Productos: pharmacy_products activos (catálogo publicado de la farmacia,
 *   p. ej. genéricos del piloto), no «stock propio» de almacén.
 */
export async function loadPharmacyTenantDashboardStats(
  pharmacyId: string
): Promise<PharmacyTenantDashboardStats> {
  const supabase = createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [ordersRes, productsRes] = await Promise.all([
    supabase
      .from('pharmacy_orders')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', pharmacyId)
      .gte('created_at', start.toISOString()),
    supabase
      .from('pharmacy_products')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', pharmacyId)
      .eq('is_active', true),
  ]);

  const partialError = Boolean(ordersRes.error || productsRes.error);
  if (ordersRes.error) {
    console.error('[tenant-dashboard] orders today', ordersRes.error.message);
  }
  if (productsRes.error) {
    console.error('[tenant-dashboard] products', productsRes.error.message);
  }

  return {
    ordersToday: ordersRes.count ?? 0,
    activeProducts: productsRes.count ?? 0,
    partialError,
  };
}
