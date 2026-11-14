/**
 * Política legal/comercial del envío corporativo 1:1 (pura, testeable).
 *
 * El envío manual 1:1 NO se bloquea por falta de registro en Cartera.
 * Se mantiene clasificación purpose/legalBasis para trazabilidad.
 * Sigue bloqueando destinatarios en oposición/bajas.
 */

import { assertEmailHasAuthoredContent } from './content-validation';

export type EmailPurpose =
  | 'operational'
  | 'commercial'
  | 'institutional'
  | 'procurement';

export type EmailLegalBasis =
  | 'consent'
  | 'legitimate_interest_documented'
  | 'contractual';

export type CorporateSendPolicyInput = {
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
  recipientSuppressed: boolean;
  explicitConfirm: boolean;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  /**
   * EMAIL-02: envío de prueba visual SA. No registra consentimiento.
   */
  visualTestSend?: boolean;
  /** Nº de adjuntos (EMAIL-04 advertencia attachments_only). */
  attachmentCount?: number;
  /** Si true, permite adjuntos sin texto tras confirmación explícita del warning. */
  allowAttachmentsOnly?: boolean;
};

export type CorporateSendPolicyOk = {
  ok: true;
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
  visualTestSend: boolean;
  /** Aviso no bloqueante para UI. */
  commercialNotice: string | null;
};

export type CorporateSendPolicyErr = {
  ok: false;
  code:
    | 'missing_recipient'
    | 'missing_subject'
    | 'missing_body'
    | 'attachments_only'
    | 'confirm_required'
    | 'recipient_suppressed';
  error: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const FORCED_PURPOSE_SLUGS: Record<string, EmailPurpose> = {
  lanzadera: 'institutional',
  imprentas: 'procurement',
  demo: 'commercial',
  piloto: 'commercial',
};

/**
 * Propósito por defecto de plantilla.
 * - Lanzadera: institucional/corporativa (instituciones, aceleradoras).
 * - Presupuesto imprentas: aprovisionamiento.
 * - Demo/piloto: comercial (trazabilidad; no bloquea envío manual).
 */
export function defaultPurposeForTemplate(slug: string): EmailPurpose {
  return FORCED_PURPOSE_SLUGS[slug] ?? 'operational';
}

/**
 * Plantillas con propósito forzado no pueden eludirlo marcando otro tipo.
 */
export function resolveEffectivePurpose(
  templateSlug: string,
  requested: EmailPurpose
): EmailPurpose {
  const forced = FORCED_PURPOSE_SLUGS[templateSlug];
  if (forced) return forced;
  return requested;
}

export function emailPurposeLabel(purpose: EmailPurpose): string {
  switch (purpose) {
    case 'commercial':
      return 'Comercial';
    case 'institutional':
      return 'Institucional / Corporativa';
    case 'procurement':
      return 'Aprovisionamiento';
    default:
      return 'Operativa';
  }
}

export function isEmailPurpose(value: string): value is EmailPurpose {
  return (
    value === 'operational' ||
    value === 'commercial' ||
    value === 'institutional' ||
    value === 'procurement'
  );
}

export const COMMERCIAL_SEND_NOTICE_ES =
  'Recuerda disponer de habilitación legal para comunicaciones comerciales. Este envío 1:1 no registra consentimiento automáticamente.' as const;

export function assertCorporateSendPolicy(
  input: CorporateSendPolicyInput & { templateSlug?: string }
): CorporateSendPolicyOk | CorporateSendPolicyErr {
  const purpose = resolveEffectivePurpose(
    input.templateSlug ?? 'blank',
    input.purpose
  );

  const email = input.recipientEmail.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return {
      ok: false,
      code: 'missing_recipient',
      error: 'Indica un destinatario individual válido.',
    };
  }
  if (!input.subject.trim()) {
    return {
      ok: false,
      code: 'missing_subject',
      error: 'El asunto es obligatorio para enviar.',
    };
  }
  const content = assertEmailHasAuthoredContent({
    htmlBody: input.htmlBody,
    textBody: input.textBody,
    attachmentCount: input.attachmentCount ?? 0,
  });
  if (!content.ok) {
    if (
      content.code === 'attachments_only' &&
      input.allowAttachmentsOnly === true
    ) {
      // Permitido solo tras confirmación explícita en UI
    } else {
      return {
        ok: false,
        code:
          content.code === 'attachments_only'
            ? 'attachments_only'
            : 'missing_body',
        error: content.error,
      };
    }
  }
  if (!input.explicitConfirm) {
    return {
      ok: false,
      code: 'confirm_required',
      error: 'Debes confirmar expresamente el envío tras revisar la vista previa.',
    };
  }

  const visualTest = input.visualTestSend === true;

  if (input.recipientSuppressed && !visualTest) {
    return {
      ok: false,
      code: 'recipient_suppressed',
      error: 'Destinatario en lista de oposición/bajas.',
    };
  }

  return {
    ok: true,
    purpose,
    legalBasis:
      purpose === 'commercial' && !visualTest ? input.legalBasis : null,
    visualTestSend: visualTest,
    commercialNotice:
      purpose === 'commercial' && !visualTest
        ? COMMERCIAL_SEND_NOTICE_ES
        : null,
  };
}
