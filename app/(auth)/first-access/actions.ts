'use server';

import { createClient } from '@/lib/supabase/server';
import {
  destinationForAppAccess,
  resolveAppAccess,
} from '@/lib/auth/access';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal/versions';

export type CompleteFirstAccessResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      error: string;
      code?:
        | 'unauthenticated'
        | 'validation'
        | 'password'
        | 'legal'
        | 'no_pending'
        | 'multiple_pending'
        | 'rpc';
    };

function mapAcceptFailure(
  status: string | undefined
): Extract<CompleteFirstAccessResult, { ok: false }> {
  switch (status) {
    case 'unauthenticated':
      return {
        ok: false,
        error:
          'Tu sesión ha caducado. Vuelve a abrir el enlace de invitación del email.',
        code: 'unauthenticated',
      };
    case 'no_pending':
      return {
        ok: false,
        error:
          'No hay ninguna invitación pendiente para tu cuenta. Si ya completaste el acceso, inicia sesión normalmente.',
        code: 'no_pending',
      };
    case 'multiple_pending':
      return {
        ok: false,
        error:
          'Tienes más de una invitación pendiente. Contacta con FarmaFácil para resolverlo antes de continuar.',
        code: 'multiple_pending',
      };
    default:
      return {
        ok: false,
        error: 'No se ha podido activar el acceso a la farmacia.',
        code: 'rpc',
      };
  }
}

/**
 * Primer acceso: valida casillas → contraseña (Auth) →
 * ff_complete_pharmacy_first_access_v1(TERMS_VERSION, PRIVACY_VERSION)
 * (evidencia legal + membership invited→active en una sola transacción PG).
 *
 * Versiones legales solo desde constantes server-side.
 * Sin service_role. Sin user_id/pharmacy_id del cliente como autoridad.
 */
export async function completeFirstAccessAction(input: {
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}): Promise<CompleteFirstAccessResult> {
  const password = input.password ?? '';
  const confirmPassword = input.confirmPassword ?? '';

  if (!input.acceptTerms || !input.acceptPrivacy) {
    return {
      ok: false,
      error:
        'Debes aceptar los Términos y Condiciones y confirmar que has leído la Política de Privacidad.',
      code: 'validation',
    };
  }

  if (password.length < 8) {
    return {
      ok: false,
      error: 'La contraseña debe tener al menos 8 caracteres.',
      code: 'validation',
    };
  }
  if (password !== confirmPassword) {
    return {
      ok: false,
      error: 'Las contraseñas no coinciden.',
      code: 'validation',
    };
  }

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
      code: 'unauthenticated',
    };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password,
  });

  if (passwordError) {
    console.error('[first-access] updateUser', passwordError.message);
    const msg = passwordError.message.toLowerCase();
    if (!(msg.includes('same') || msg.includes('identical'))) {
      return {
        ok: false,
        error: 'No se ha podido guardar la contraseña. Inténtalo de nuevo.',
        code: 'password',
      };
    }
  }

  const { data, error: rpcError } = await supabase.rpc(
    'ff_complete_pharmacy_first_access_v1',
    {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
    }
  );

  if (rpcError) {
    console.error(
      '[first-access] ff_complete_pharmacy_first_access_v1',
      rpcError.message,
      rpcError.code
    );
    if (
      rpcError.code === '42883' ||
      rpcError.message.includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'La aceptación de primer acceso aún no está disponible en la base de datos. Contacta con FarmaFácil.',
        code: 'rpc',
      };
    }
    if (
      rpcError.message.includes('profile_not_found') ||
      rpcError.message.includes('membership_activation_failed') ||
      rpcError.message.includes('terms_version_required') ||
      rpcError.message.includes('privacy_version_required')
    ) {
      return {
        ok: false,
        error: 'No se ha podido completar el primer acceso. Inténtalo de nuevo.',
        code: 'rpc',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido activar el acceso a la farmacia.',
      code: 'rpc',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status =
    payload && 'status' in payload ? String(payload.status) : undefined;

  if (status !== 'ok') {
    return mapAcceptFailure(status);
  }

  const pharmacyIdFromRpc =
    payload && typeof payload.pharmacy_id === 'string'
      ? payload.pharmacy_id
      : null;

  if (pharmacyIdFromRpc && /^[0-9a-f-]{36}$/i.test(pharmacyIdFromRpc)) {
    return {
      ok: true,
      redirectTo: `/f/${pharmacyIdFromRpc}/dashboard`,
    };
  }

  const access = await resolveAppAccess();
  return { ok: true, redirectTo: destinationForAppAccess(access) };
}
