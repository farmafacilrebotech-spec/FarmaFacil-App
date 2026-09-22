import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con service_role — SOLO servidor.
 * Uso permitido: Auth Admin API (invitar/crear usuarios).
 * Prohibido: lecturas/escrituras normales de FarmaFácil (RLS).
 * Nunca importar desde Client Components ni exponer la clave.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.'
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
