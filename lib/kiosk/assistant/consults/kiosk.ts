import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  clearKioskSessionCookie,
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';
import {
  rateLimitUserMessage,
  type ConsultRateLimitScope,
} from '@/lib/kiosk/assistant/consults/rate-limit-policy';
import { sanitizeConsultClientMessage } from '@/lib/kiosk/assistant/consults/sanitize';
import type {
  KioskConsultCreated,
  KioskConsultPoll,
  PharmacistConsultStatus,
} from '@/lib/kiosk/assistant/consults/types';

function credentialHashOrNull(): string | null {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) return null;
  return sha256Hex(parsed.credential);
}

/** Hashea el token de turno; el plaintext no se envía a SQL ni se registra. */
function turnTokenHashOrNull(turnToken: string): string | null {
  const token = String(turnToken ?? '').trim();
  if (token.length < 32 || token.length > 128) return null;
  return sha256Hex(token);
}

export type CreateKioskConsultResult =
  | { ok: true; consult: KioskConsultCreated; idempotent: boolean }
  | {
      ok: false;
      code:
        | 'session_missing'
        | 'session_invalid'
        | 'commercially_blocked'
        | 'consults_disabled'
        | 'invalid_message'
        | 'looks_like_pii'
        | 'invalid_turn'
        | 'turn_revoked'
        | 'turn_mismatch'
        | 'rate_limited'
        | 'conflict'
        | 'error';
      message: string;
      rateLimitScope?: ConsultRateLimitScope;
    };

export async function createKioskPharmacistConsult(input: {
  message: string;
  clientRequestId: string;
  turnToken: string;
}): Promise<CreateKioskConsultResult> {
  const cleaned = sanitizeConsultClientMessage(input.message);
  if (!cleaned.ok) {
    if (cleaned.reason === 'looks_like_pii') {
      return {
        ok: false,
        code: 'looks_like_pii',
        message:
          'No incluyas teléfono, email ni datos identificativos. Describe tu duda de forma general.',
      };
    }
    return {
      ok: false,
      code: 'invalid_message',
      message:
        cleaned.reason === 'too_long'
          ? 'El mensaje es demasiado largo. Resúmelo un poco.'
          : 'Escribe tu consulta antes de enviarla.',
    };
  }

  const turnHash = turnTokenHashOrNull(input.turnToken);
  if (!turnHash) {
    return {
      ok: false,
      code: 'invalid_turn',
      message: 'Sesión de consulta no válida. Reinicia la conversación.',
    };
  }

  const hash = credentialHashOrNull();
  if (!hash) {
    return {
      ok: false,
      code: 'session_missing',
      message: 'Sesión de kiosko no válida.',
    };
  }

  const req = String(input.clientRequestId ?? '').trim().slice(0, 128);
  if (!req) {
    return {
      ok: false,
      code: 'invalid_message',
      message: 'No se ha podido enviar la consulta. Inténtalo de nuevo.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_assistant_create_consult_v1',
    {
      p_credential_hash: hash,
      p_message: cleaned.text,
      p_client_request_id: req,
      p_turn_token_hash: turnHash,
    }
  );

  if (error) {
    console.error('[assistant-consults] kiosk create', error.message);
    return {
      ok: false,
      code: 'error',
      message:
        'No se ha podido enviar la consulta. Prueba de nuevo o acude al mostrador.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status) : '';

  if (status === 'session_invalid') {
    clearKioskSessionCookie();
    return {
      ok: false,
      code: 'session_invalid',
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
  if (status === 'consults_disabled') {
    return {
      ok: false,
      code: 'consults_disabled',
      message:
        'Las consultas digitales no están activas. Acércate al mostrador.',
    };
  }
  if (
    status === 'invalid_turn' ||
    status === 'turn_revoked' ||
    status === 'turn_mismatch'
  ) {
    return {
      ok: false,
      code: status as 'invalid_turn' | 'turn_revoked' | 'turn_mismatch',
      message: 'Sesión de consulta no válida. Reinicia la conversación.',
    };
  }
  if (status === 'rate_limited') {
    const scope = String(payload?.scope ?? 'turn') as ConsultRateLimitScope;
    return {
      ok: false,
      code: 'rate_limited',
      rateLimitScope: scope,
      message: rateLimitUserMessage(scope),
    };
  }
  if (status === 'invalid_message' || status === 'invalid_request') {
    return {
      ok: false,
      code: 'invalid_message',
      message: 'No se ha podido enviar la consulta.',
    };
  }
  if (status === 'conflict') {
    return {
      ok: false,
      code: 'conflict',
      message: 'Consulta duplicada. Empieza de nuevo si hace falta.',
    };
  }
  if (status !== 'ok' || !payload?.consult) {
    return {
      ok: false,
      code: 'error',
      message: 'No se ha podido enviar la consulta.',
    };
  }

  const consult = payload.consult as Record<string, unknown>;
  return {
    ok: true,
    idempotent: payload.idempotent === true,
    consult: {
      id: String(consult.id),
      displayCode: String(consult.display_code),
      status: String(consult.consult_status) as PharmacistConsultStatus,
      expiresAt: String(consult.expires_at),
    },
  };
}

export type PollKioskConsultResult =
  | { ok: true; consult: KioskConsultPoll }
  | {
      ok: false;
      code:
        | 'session_missing'
        | 'session_invalid'
        | 'commercially_blocked'
        | 'forbidden'
        | 'turn_revoked'
        | 'not_found'
        | 'error';
      message: string;
    };

export async function pollKioskPharmacistConsult(input: {
  consultId: string;
  turnToken: string;
}): Promise<PollKioskConsultResult> {
  if (!input.consultId || !/^[0-9a-f-]{36}$/i.test(input.consultId)) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Consulta no válida.',
    };
  }

  const turnHash = turnTokenHashOrNull(input.turnToken);
  if (!turnHash) {
    return {
      ok: false,
      code: 'turn_revoked',
      message: 'Sesión de consulta no válida.',
    };
  }

  const hash = credentialHashOrNull();
  if (!hash) {
    return {
      ok: false,
      code: 'session_missing',
      message: 'Sesión de kiosko no válida.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_assistant_poll_consult_v1',
    {
      p_credential_hash: hash,
      p_consult_id: input.consultId,
      p_turn_token_hash: turnHash,
    }
  );

  if (error) {
    console.error('[assistant-consults] kiosk poll', error.message);
    return {
      ok: false,
      code: 'error',
      message: 'No se ha podido comprobar la consulta.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status) : '';

  if (status === 'session_invalid') {
    clearKioskSessionCookie();
    return {
      ok: false,
      code: 'session_invalid',
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
  if (status === 'turn_revoked') {
    return {
      ok: false,
      code: 'turn_revoked',
      message: 'Sesión de consulta finalizada.',
    };
  }
  if (status === 'forbidden') {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Consulta no disponible en este dispositivo.',
    };
  }
  if (status === 'not_found') {
    return {
      ok: false,
      code: 'not_found',
      message: 'Consulta no encontrada.',
    };
  }
  if (status !== 'ok' || !payload?.consult) {
    return {
      ok: false,
      code: 'error',
      message: 'No se ha podido comprobar la consulta.',
    };
  }

  const consult = payload.consult as Record<string, unknown>;
  return {
    ok: true,
    consult: {
      id: String(consult.id),
      displayCode: String(consult.display_code),
      status: String(consult.consult_status) as PharmacistConsultStatus,
      reply: consult.reply == null ? null : String(consult.reply),
      expiresAt: String(consult.expires_at),
      late: consult.late === true,
    },
  };
}

export type AbandonKioskTurnResult =
  | { ok: true }
  | { ok: false; code: 'session_invalid' | 'forbidden' | 'error'; message: string };

export async function abandonKioskClientTurn(input: {
  turnToken: string;
}): Promise<AbandonKioskTurnResult> {
  const turnHash = turnTokenHashOrNull(input.turnToken);
  if (!turnHash) {
    return { ok: true };
  }

  const hash = credentialHashOrNull();
  if (!hash) {
    // Sin sesión: no se puede revocar en servidor; el cliente limpia storage.
    return { ok: true };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_assistant_abandon_client_turn_v1',
    {
      p_credential_hash: hash,
      p_turn_token_hash: turnHash,
    }
  );

  if (error) {
    console.error('[assistant-consults] abandon turn', error.message);
    return {
      ok: false,
      code: 'error',
      message: 'No se ha podido cerrar la sesión de consulta.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status) : '';
  if (status === 'forbidden') {
    return { ok: false, code: 'forbidden', message: 'Turno no válido.' };
  }
  if (status === 'session_invalid') {
    return { ok: true };
  }
  return { ok: true };
}
