import { createClient } from '@/lib/supabase/server';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal/versions';

export type RecordLegalAcceptanceResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Registra evidencia de aceptación legal global del usuario autenticado.
 * Versiones desde constantes server-side. Sin pharmacy_id (aceptación de plataforma).
 *
 * Nota: el primer acceso usa ff_complete_pharmacy_first_access_v1 (atómico).
 * Esta helper queda para reutilización futura (p. ej. re-aceptar nuevas versiones).
 */
export async function recordCurrentUserLegalAcceptance(): Promise<RecordLegalAcceptanceResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error:
        'No hay una sesión válida. Abre de nuevo el enlace de invitación del email.',
    };
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from('user_legal_acceptances').upsert(
    {
      profile_id: user.id,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      accepted_terms_at: now,
      privacy_acknowledged_at: now,
    },
    {
      onConflict: 'profile_id,terms_version,privacy_version',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.error('[legal] recordCurrentUserLegalAcceptance', error.message);
    if (
      error.code === '42P01' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'El registro de aceptaciones legales aún no está disponible. Contacta con FarmaFácil.',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido registrar la aceptación de los documentos legales.',
    };
  }

  return { ok: true };
}
