/**
 * Validación pura de borradores corporativos (Fase A).
 * Sin imports relativos a otros módulos (compatible node:test).
 */

export type EmailTemplateSlug =
  | 'blank'
  | 'lanzadera'
  | 'imprentas'
  | 'demo'
  | 'piloto';

const SLUGS: readonly EmailTemplateSlug[] = [
  'blank',
  'lanzadera',
  'imprentas',
  'demo',
  'piloto',
];

export type EmailDraftInput = {
  id?: string | null;
  templateSlug: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName?: string | null;
};

export type EmailDraftNormalized = {
  id: string | null;
  templateSlug: EmailTemplateSlug;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeRecipientEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidRecipientEmail(raw: string): boolean {
  const v = normalizeRecipientEmail(raw);
  if (!v) return true; // borrador puede guardarse sin destinatario
  return EMAIL_RE.test(v) && v.length <= 320;
}

function isSlug(value: string): value is EmailTemplateSlug {
  return (SLUGS as readonly string[]).includes(value);
}

export function validateEmailDraftInput(
  input: EmailDraftInput
):
  | { ok: true; draft: EmailDraftNormalized }
  | { ok: false; error: string } {
  if (!isSlug(input.templateSlug)) {
    return { ok: false, error: 'Plantilla no válida.' };
  }
  const subject = (input.subject ?? '').trim();
  if (subject.length > 500) {
    return { ok: false, error: 'El asunto no puede superar 500 caracteres.' };
  }
  const htmlBody = input.htmlBody ?? '';
  const textBody = input.textBody ?? '';
  if (htmlBody.length > 500_000 || textBody.length > 500_000) {
    return { ok: false, error: 'El cuerpo del email es demasiado grande.' };
  }
  const recipientEmail = normalizeRecipientEmail(input.recipientEmail ?? '');
  if (recipientEmail && !EMAIL_RE.test(recipientEmail)) {
    return { ok: false, error: 'El destinatario no es un email válido.' };
  }
  if (recipientEmail.length > 320) {
    return { ok: false, error: 'El destinatario es demasiado largo.' };
  }
  const recipientName = (input.recipientName ?? '').trim() || null;
  if (recipientName && recipientName.length > 200) {
    return { ok: false, error: 'El nombre del destinatario es demasiado largo.' };
  }

  return {
    ok: true,
    draft: {
      id: input.id?.trim() || null,
      templateSlug: input.templateSlug,
      subject,
      htmlBody,
      textBody,
      recipientEmail,
      recipientName,
    },
  };
}

/** Fase A: el envío siempre está bloqueado a nivel de producto. */
export const CORPORATE_EMAIL_SEND_ENABLED = false as const;

export function assertCorporateSendBlocked(): {
  ok: false;
  error: string;
} {
  return {
    ok: false,
    error:
      'Envío corporativo bloqueado (Fase A). Guarda el borrador; el envío vía Resend requiere autorización explícita.',
  };
}
