/**
 * Cliente Supabase autenticado como usuario de prueba (anon key + password).
 * NUNCA usa service_role para comprobar permisos de acceso.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { e2ePassword, roleEmail, type E2ERole } from '../fixtures/test-data';

const PROJECT_REF = 'dazfdcjscnpfvhcyjddt';

export function stagingAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url.includes(PROJECT_REF) || !key) {
    throw new Error('E2E requiere URL/anon de staging dazfdcjscnpfvhcyjddt');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function asRole(role: E2ERole): Promise<SupabaseClient> {
  const client = stagingAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: roleEmail(role),
    password: e2ePassword(),
  });
  if (error || !data.session) {
    throw new Error(`asRole(${role}): ${error?.message || 'sin sesión'}`);
  }
  return client;
}
