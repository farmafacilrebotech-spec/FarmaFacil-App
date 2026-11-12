/**
 * Política legal/comercial del envío corporativo 1:1 (pura, testeable).
 */

export type EmailPurpose = 'operational' | 'commercial';

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
};

export type CorporateSendPolicyOk = {
  ok: true;
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
};

export type CorporateSendPolicyErr = {
  ok: false;
  code:
    | 'missing_recipient'
    | 'missing_subject'
    | 'missing_body'
    | 'confirm_required'
    | 'commercial_ack_required'
    | 'legal_basis_required'
    | 'opposition_not_checked'
    | 'recipient_suppressed';
  error: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function defaultPurposeForTemplate(slug: string): EmailPurpose {
  switch (slug) {
    case 'lanzadera':
    case 'demo':
    case 'piloto':
    case 'imprentas':
      return 'commercial';
    default:
      return 'operational';
  }
}

/**
 * Plantillas comerciales fuerzan gates comerciales aunque el usuario marque «operativa».
 */
export function resolveEffectivePurpose(
  templateSlug: string,
  requested: EmailPurpose
): EmailPurpose {
  if (defaultPurposeForTemplate(templateSlug) === 'commercial') {
    return 'commercial';
  }
  return requested;
}

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
  if (!input.htmlBody.trim() && !input.textBody.trim()) {
    return {
      ok: false,
      code: 'missing_body',
      error: 'El cuerpo del mensaje no puede estar vacío.',
    };
  }
  if (!input.explicitConfirm) {
    return {
      ok: false,
      code: 'confirm_required',
      error: 'Debes confirmar expresamente el envío tras revisar la vista previa.',
    };
  }

  if (purpose === 'commercial') {
    if (!input.commercialAuthAck) {
      return {
        ok: false,
        code: 'commercial_ack_required',
        error:
          'Las comunicaciones comerciales requieren autorización/base legal documentada.',
      };
    }
    if (!input.legalBasis) {
      return {
        ok: false,
        code: 'legal_basis_required',
        error: 'Selecciona la base jurídica de la comunicación comercial.',
      };
    }
    if (!input.oppositionChecked) {
      return {
        ok: false,
        code: 'opposition_not_checked',
        error:
          'Confirma que has comprobado oposición/bajas antes de un envío comercial.',
      };
    }
    if (input.recipientSuppressed) {
      return {
        ok: false,
        code: 'recipient_suppressed',
        error:
          'Este destinatario figura en la lista de oposición/bajas. No se puede enviar comercial.',
      };
    }
  }

  return {
    ok: true,
    purpose,
    legalBasis: purpose === 'commercial' ? input.legalBasis : null,
  };
}
