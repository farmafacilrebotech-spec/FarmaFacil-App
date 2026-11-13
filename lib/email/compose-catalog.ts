/**
 * Catálogo de plantillas del composer SuperAdmin (Fase A).
 * Reutiliza builders existentes; no envía correo.
 */

import {
  FF_EMAIL_FROM,
  FF_EMAIL_REPLY_TO,
  PHARMACY_DEMO_TEMPLATE_ID,
  PHARMACY_PILOT_TEMPLATE_ID,
  PRINTING_QUOTE_TEMPLATE_ID,
  buildPharmacyDemoEmail,
  buildPharmacyPilotEmail,
  buildPrintingQuoteEmail,
} from './corporate-templates';
import { buildLanzaderaOutreachEmail } from './lanzadera-outreach';
import {
  EMAIL_TEMPLATE_SLUGS,
  isEmailTemplateSlug,
  type EmailTemplateSlug,
} from './email-template-slugs';

export { EMAIL_TEMPLATE_SLUGS, isEmailTemplateSlug, type EmailTemplateSlug };

const LANZADERA_TEMPLATE_ID = 'ff-lanzadera-outreach-v3';

export type EmailComposeSeed = {
  templateSlug: EmailTemplateSlug;
  templateId: string;
  title: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  from: string;
  replyTo: string;
  sendEnabled: false;
};

export const EMAIL_TEMPLATE_OPTIONS: ReadonlyArray<{
  slug: EmailTemplateSlug;
  title: string;
  description: string;
}> = [
  {
    slug: 'blank',
    title: 'En blanco',
    description: 'Asunto y cuerpo libres desde cero.',
  },
  {
    slug: 'lanzadera',
    title: 'Lanzadera',
    description: 'Informe de evolución e incorporación a Lanzadera.',
  },
  {
    slug: 'imprentas',
    title: 'Presupuesto imprentas',
    description: 'Solicitud de presupuesto de material corporativo.',
  },
  {
    slug: 'demo',
    title: 'Invitación demostración',
    description: 'Invitar a farmacias a conocer y probar FarmaFácil.',
  },
  {
    slug: 'piloto',
    title: 'Invitación piloto',
    description: 'Invitación al programa piloto de 30 días.',
  },
];

function fromContent(
  slug: EmailTemplateSlug,
  title: string,
  templateId: string,
  mail: {
    subject: string;
    html: string;
    text: string;
    from: string;
    replyTo: string;
  }
): EmailComposeSeed {
  return {
    templateSlug: slug,
    templateId,
    title,
    subject: mail.subject,
    htmlBody: mail.html,
    textBody: mail.text,
    from: mail.from,
    replyTo: mail.replyTo,
    sendEnabled: false,
  };
}

function buildBlankEmail(): EmailComposeSeed {
  const subject = '';
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>FarmaFácil</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E7EEF3;border-radius:12px;">
    <tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:700;">FarmaFácil</td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.55;color:#111827;">
      <p style="margin:0 0 12px;">Escribe aquí el cuerpo del mensaje.</p>
    </td></tr>
  </table>
</body>
</html>`;
  const text =
    'FarmaFácil\n\nEscribe aquí el cuerpo del mensaje.\n';
  return {
    templateSlug: 'blank',
    templateId: 'ff-blank-v1',
    title: 'En blanco',
    subject,
    htmlBody: html,
    textBody: text,
    from: FF_EMAIL_FROM,
    replyTo: FF_EMAIL_REPLY_TO,
    sendEnabled: false,
  };
}

/**
 * Semilla editable para el composer. imageMode=preview para assets locales.
 */
export function buildComposeSeed(
  slug: EmailTemplateSlug,
  options?: { previewOrigin?: string | null; vars?: Record<string, string | null | undefined> }
): EmailComposeSeed {
  const previewOrigin = options?.previewOrigin ?? null;
  const vars = options?.vars;

  switch (slug) {
    case 'blank':
      return buildBlankEmail();
    case 'lanzadera': {
      const mail = buildLanzaderaOutreachEmail({
        imageMode: 'preview',
        previewOrigin,
      });
      return fromContent('lanzadera', 'Lanzadera', LANZADERA_TEMPLATE_ID, mail);
    }
    case 'imprentas': {
      const mail = buildPrintingQuoteEmail({
        imageMode: 'preview',
        previewOrigin,
        vars,
      });
      return fromContent(
        'imprentas',
        'Presupuesto imprentas',
        PRINTING_QUOTE_TEMPLATE_ID,
        mail
      );
    }
    case 'demo': {
      const mail = buildPharmacyDemoEmail({
        imageMode: 'preview',
        previewOrigin,
        vars,
      });
      return fromContent(
        'demo',
        'Invitación demostración',
        PHARMACY_DEMO_TEMPLATE_ID,
        mail
      );
    }
    case 'piloto': {
      const mail = buildPharmacyPilotEmail({
        imageMode: 'preview',
        previewOrigin,
        vars,
      });
      return fromContent(
        'piloto',
        'Invitación piloto',
        PHARMACY_PILOT_TEMPLATE_ID,
        mail
      );
    }
    case 'custom': {
      return fromContent('custom', 'Plantilla personalizada', 'custom', {
        subject: '',
        html: '',
        text: '',
        from: FF_EMAIL_FROM,
        replyTo: FF_EMAIL_REPLY_TO,
      });
    }
    default: {
      const _exhaustive: never = slug;
      return _exhaustive;
    }
  }
}
