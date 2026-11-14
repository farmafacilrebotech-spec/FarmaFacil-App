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
import { stripLegacyTemplateSignature } from './content-validation';

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
  /** EMAIL-05: el composer debe aplicar firma dinámica. */
  preferDynamicSignature: boolean;
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
  // EMAIL-05: quitar solo la tabla compacta de firma (nunca el layout raíz).
  const htmlBody = stripLegacyTemplateSignature(mail.html);
  const textBody = (mail.text || '')
    .replace(/\n--\n[\s\S]*$/m, '')
    .replace(/\nPilar Reyes Bononat[\s\S]*farmafacil\.solutions\s*$/im, '')
    .trim();
  return {
    templateSlug: slug,
    templateId,
    title,
    subject: mail.subject,
    htmlBody,
    textBody,
    from: mail.from,
    replyTo: mail.replyTo,
    sendEnabled: false,
    preferDynamicSignature: true,
  };
}

function buildBlankEmail(): EmailComposeSeed {
  const subject = '';
  // EMAIL-03 formato A: blanco, sin tarjeta decorativa
  const html = `<p>Escribe aquí el cuerpo del mensaje.</p>`;
  const text = 'Escribe aquí el cuerpo del mensaje.\n';
  return {
    templateSlug: 'blank',
    templateId: 'ff-blank-v1',
    title: 'En blanco',
    subject,
    htmlBody: html,
    textBody: text,
    from: FF_EMAIL_FROM,
    replyTo: FF_EMAIL_REPLY_TO,
    preferDynamicSignature: true,
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
