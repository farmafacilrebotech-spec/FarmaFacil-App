import { createClient } from '@/lib/supabase/server';
import { requireConsultsManage } from '@/lib/kiosk/assistant/consults/authz';
import { sanitizeConsultReply } from '@/lib/kiosk/assistant/consults/sanitize';
import type { PharmacistConsultStatus } from '@/lib/kiosk/assistant/consults/types';

export async function replyPharmacyAssistantConsult(input: {
  pharmacyId: string;
  consultId: string;
  reply: string;
}): Promise<
  | {
      ok: true;
      status: PharmacistConsultStatus;
      late: boolean;
    }
  | { ok: false; error: string }
> {
  const auth = await requireConsultsManage(input.pharmacyId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const cleaned = sanitizeConsultReply(input.reply);
  if (!cleaned.ok) {
    return {
      ok: false,
      error:
        cleaned.reason === 'too_long'
          ? 'La respuesta es demasiado larga.'
          : 'Escribe una respuesta para el cliente.',
    };
  }

  if (!/^[0-9a-f-]{36}$/i.test(input.consultId)) {
    return { ok: false, error: 'Consulta no válida.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_pharmacy_assistant_reply_consult_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_consult_id: input.consultId,
      p_reply: cleaned.text,
    }
  );

  if (error) {
    console.error('[assistant-consults] reply', error.message);
    return { ok: false, error: 'No se ha podido enviar la respuesta.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status) : '';
  if (status === 'ok') {
    return {
      ok: true,
      status: String(payload!.consult_status) as PharmacistConsultStatus,
      late: payload!.late === true,
    };
  }
  if (status === 'forbidden') {
    return { ok: false, error: 'No tienes permiso para responder.' };
  }
  if (status === 'not_found') {
    return { ok: false, error: 'Consulta no encontrada.' };
  }
  if (status === 'already_resolved') {
    return { ok: false, error: 'La consulta ya está resuelta.' };
  }
  if (status === 'retained_expired') {
    return { ok: false, error: 'La consulta ha superado el periodo de retención.' };
  }
  if (status === 'invalid_reply') {
    return { ok: false, error: 'Respuesta no válida.' };
  }
  return { ok: false, error: 'No se ha podido enviar la respuesta.' };
}

export async function resolvePharmacyAssistantConsult(input: {
  pharmacyId: string;
  consultId: string;
}): Promise<
  | { ok: true; status: PharmacistConsultStatus; unchanged: boolean }
  | { ok: false; error: string }
> {
  const auth = await requireConsultsManage(input.pharmacyId);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!/^[0-9a-f-]{36}$/i.test(input.consultId)) {
    return { ok: false, error: 'Consulta no válida.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_pharmacy_assistant_resolve_consult_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_consult_id: input.consultId,
    }
  );

  if (error) {
    console.error('[assistant-consults] resolve', error.message);
    return { ok: false, error: 'No se ha podido marcar como resuelta.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status) : '';
  if (status === 'ok') {
    return {
      ok: true,
      status: String(payload!.consult_status) as PharmacistConsultStatus,
      unchanged: payload!.unchanged === true,
    };
  }
  if (status === 'reply_required') {
    return {
      ok: false,
      error: 'Responde la consulta antes de marcarla como resuelta.',
    };
  }
  if (status === 'forbidden') {
    return { ok: false, error: 'No tienes permiso para resolver consultas.' };
  }
  if (status === 'not_found') {
    return { ok: false, error: 'Consulta no encontrada.' };
  }
  return { ok: false, error: 'No se ha podido marcar como resuelta.' };
}
