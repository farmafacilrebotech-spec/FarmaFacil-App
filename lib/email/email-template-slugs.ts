/** Slugs del composer / email_drafts (sin dependencias). */

export const EMAIL_TEMPLATE_SLUGS = [
  'blank',
  'lanzadera',
  'imprentas',
  'demo',
  'piloto',
] as const;

export type EmailTemplateSlug = (typeof EMAIL_TEMPLATE_SLUGS)[number];

export function isEmailTemplateSlug(value: string): value is EmailTemplateSlug {
  return (EMAIL_TEMPLATE_SLUGS as readonly string[]).includes(value);
}
