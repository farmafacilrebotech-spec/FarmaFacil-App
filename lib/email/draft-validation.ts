/**
 * Validación pura de borradores corporativos.
 * Sin imports relativos a otros módulos (compatible node:test).
 */

export type EmailTemplateSlug =
  | 'blank'
  | 'lanzadera'
  | 'imprentas'
  | 'demo'
  | 'piloto'
  | 'custom';

const SLUGS: readonly EmailTemplateSlug[] = [
  'blank',
  'lanzadera',
  'imprentas',
  'demo',
  'piloto',
  'custom',
];

export type EmailPurpose = 'operational' | 'commercial';
export type EmailLegalBasis =
  | 'consent'
  | 'legitimate_interest_documented'
  | 'contractual';

const FROM_KEYS = [
  'pilar',
  'contacto',
  'info',
  'soporte',
  'pruebas',
  'ventas',
  'admin',
  'privacidad',
  'demo',
  'comercial',
  'facturacion',
] as const;

export type EmailFromKey = (typeof FROM_KEYS)[number];

export type EmailDraftInput = {
  id?: string | null;
  templateSlug: string;
  templateId?: string | null;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName?: string | null;
  ccEmails?: string[] | string | null;
  bccEmails?: string[] | string | null;
  purpose?: string | null;
  legalBasis?: string | null;
  commercialAuthAck?: boolean;
  oppositionChecked?: boolean;
  fromKey?: string | null;
};

export type EmailDraftNormalized = {
  id: string | null;
  templateSlug: EmailTemplateSlug;
  templateId: string | null;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string | null;
  ccEmails: string[];
  bccEmails: string[];
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
  fromKey: EmailFromKey;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeRecipientEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidRecipientEmail(raw: string): boolean {
  const v = normalizeRecipientEmail(raw);
  if (!v) return true;
  return EMAIL_RE.test(v) && v.length <= 320;
}

function isSlug(value: string): value is EmailTemplateSlug {
  return (SLUGS as readonly string[]).includes(value);
}

function parseList(raw: string[] | string | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,;\n]+/)
        .map((s) => s.trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const e = p.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
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

  const ccEmails = parseList(input.ccEmails);
  const bccEmails = parseList(input.bccEmails);
  if (ccEmails.length > 2) {
    return { ok: false, error: 'Máximo 2 direcciones en CC.' };
  }
  if (bccEmails.length > 2) {
    return { ok: false, error: 'Máximo 2 direcciones en CCO.' };
  }
  for (const e of [...ccEmails, ...bccEmails]) {
    if (!EMAIL_RE.test(e)) {
      return { ok: false, error: `Dirección no válida: ${e}` };
    }
  }
  if (recipientEmail && (ccEmails.includes(recipientEmail) || bccEmails.includes(recipientEmail))) {
    return {
      ok: false,
      error: 'No dupliques el destinatario entre Para, CC y CCO.',
    };
  }
  if ((recipientEmail ? 1 : 0) + ccEmails.length + bccEmails.length > 5) {
    return {
      ok: false,
      error: 'Máximo 5 destinatarios en total (Para+CC+CCO).',
    };
  }

  const purposeRaw = (input.purpose ?? 'operational').trim().toLowerCase();
  if (purposeRaw !== 'operational' && purposeRaw !== 'commercial') {
    return { ok: false, error: 'Propósito de comunicación no válido.' };
  }
  const purpose = purposeRaw as EmailPurpose;

  const basisRaw = (input.legalBasis ?? '').trim();
  const allowedBasis = new Set([
    'consent',
    'legitimate_interest_documented',
    'contractual',
  ]);
  let legalBasis: EmailLegalBasis | null = null;
  if (basisRaw) {
    if (!allowedBasis.has(basisRaw)) {
      return { ok: false, error: 'Base jurídica no válida.' };
    }
    legalBasis = basisRaw as EmailLegalBasis;
  }

  const fromRaw = (input.fromKey ?? 'pilar').trim().toLowerCase();
  if (!(FROM_KEYS as readonly string[]).includes(fromRaw)) {
    return { ok: false, error: 'Remitente no válido.' };
  }
  const fromKey = fromRaw as EmailFromKey;

  const templateId = input.templateId?.trim() || null;

  return {
    ok: true,
    draft: {
      id: input.id?.trim() || null,
      templateSlug: input.templateSlug,
      templateId,
      subject,
      htmlBody,
      textBody,
      recipientEmail,
      recipientName,
      ccEmails,
      bccEmails,
      purpose,
      legalBasis,
      commercialAuthAck: Boolean(input.commercialAuthAck),
      oppositionChecked: Boolean(input.oppositionChecked),
      fromKey,
    },
  };
}

export const CORPORATE_EMAIL_SEND_ENABLED = false as const;

export function assertCorporateSendBlocked(): {
  ok: false;
  error: string;
} {
  return {
    ok: false,
    error:
      'El envío está desactivado. Puedes guardar el borrador; el envío requiere activación en servidor.',
  };
}
