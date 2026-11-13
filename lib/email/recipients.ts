/**
 * Validación de destinatarios Para / CC / CCO (1:1 estricto + límites).
 */

export const EMAIL_MAX_TO = 1;
export const EMAIL_MAX_CC = 2;
export const EMAIL_MAX_BCC = 2;
export const EMAIL_MAX_TOTAL_RECIPIENTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function parseRecipientList(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,;\n]+/)
        .map((s) => s.trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const email = p.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 320;
}

export type RecipientsInput = {
  to: string | string[];
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
};

export type RecipientsNormalized = {
  to: string[];
  cc: string[];
  bcc: string[];
  all: string[];
};

export function normalizeRecipients(
  input: RecipientsInput
):
  | { ok: true; recipients: RecipientsNormalized }
  | { ok: false; error: string } {
  const to = parseRecipientList(input.to);
  const cc = parseRecipientList(input.cc);
  const bcc = parseRecipientList(input.bcc);

  if (to.length > EMAIL_MAX_TO) {
    return {
      ok: false,
      error: `Solo se permite ${EMAIL_MAX_TO} destinatario en Para (envío individual).`,
    };
  }
  if (cc.length > EMAIL_MAX_CC) {
    return {
      ok: false,
      error: `Máximo ${EMAIL_MAX_CC} direcciones en CC.`,
    };
  }
  if (bcc.length > EMAIL_MAX_BCC) {
    return {
      ok: false,
      error: `Máximo ${EMAIL_MAX_BCC} direcciones en CCO.`,
    };
  }

  const all = [...to, ...cc, ...bcc];
  if (all.length > EMAIL_MAX_TOTAL_RECIPIENTS) {
    return {
      ok: false,
      error: `Máximo ${EMAIL_MAX_TOTAL_RECIPIENTS} destinatarios en total (Para+CC+CCO).`,
    };
  }

  for (const email of all) {
    if (!isValidEmailAddress(email)) {
      return { ok: false, error: `Dirección no válida: ${email}` };
    }
  }

  // Sin duplicados entre campos
  const seen = new Set<string>();
  for (const email of all) {
    if (seen.has(email)) {
      return {
        ok: false,
        error: `Destinatario duplicado entre Para/CC/CCO: ${email}`,
      };
    }
    seen.add(email);
  }

  return { ok: true, recipients: { to, cc, bcc, all } };
}

export function formatRecipientField(emails: string[]): string {
  return emails.join(', ');
}
