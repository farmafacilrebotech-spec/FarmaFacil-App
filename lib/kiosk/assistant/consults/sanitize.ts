/** Espejo de CONSULT_*_MAX en types.ts (evita import para node:test). */
const CLIENT_MESSAGE_MAX = 500;
const REPLY_MAX = 2000;

/**
 * Normaliza el mensaje del cliente. No envía historial del chat.
 * Evita datos personales obvios con un rechazo suave (no bloquea clínica genérica).
 */
export function sanitizeConsultClientMessage(
  raw: string
):
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'too_long' | 'looks_like_pii' } {
  const text = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > CLIENT_MESSAGE_MAX) {
    return { ok: false, reason: 'too_long' };
  }
  // Teléfono / email / DNI aproximados: pedir no incluirlos.
  if (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) ||
    /\b(?:\+?\d{1,3}[\s.-]?)?(?:\d{2,4}[\s.-]?){2,4}\d{2,4}\b/.test(text) ||
    /\b\d{8}[A-Za-z]\b/.test(text)
  ) {
    return { ok: false, reason: 'looks_like_pii' };
  }
  return { ok: true, text };
}

export function sanitizeConsultReply(
  raw: string
):
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'too_long' } {
  const text = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > REPLY_MAX) {
    return { ok: false, reason: 'too_long' };
  }
  return { ok: true, text };
}
