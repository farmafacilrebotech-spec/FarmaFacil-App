/**
 * Firmas corporativas por cuenta (composer + envío).
 * Pilar: foto personal. Resto: logo circular + identidad departamental.
 * Sin imports a corporate-templates (compatible node:test).
 */

import {
  getCorporateSender,
  type CorporateSenderKey,
} from './senders';

const B = {
  header: '#111827',
  turquoiseHover: '#26B1B3',
  muted: '#6B7280',
  text: '#111827',
} as const;

const FONT = "Arial, Helvetica, 'Helvetica Neue', sans-serif";

const PHONE_DISPLAY = '+34 711 520 218';
const PHONE_TEL = '+34711520218';
const PHOTO_PUBLIC =
  'https://www.farmafacil.solutions/images/email/firma-pilar.png';
const PHOTO_LOCAL = '/images/email/firma-pilar.png';

export const FF_CIRCULAR_LOGO_PUBLIC =
  'https://www.farmafacil.solutions/images/logo/farmafacil-logo.png';

export const FF_CIRCULAR_LOGO_APP_PATH = '/images/logos/farmafacil-mark.png';

export const FF_SIGNATURE_MARKER = 'data-ff-corporate-signature="1"';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveCircularLogoUrl(previewOrigin?: string | null): string {
  const origin = (previewOrigin || '').trim().replace(/\/$/, '');
  if (origin) return `${origin}${FF_CIRCULAR_LOGO_APP_PATH}`;
  return FF_CIRCULAR_LOGO_PUBLIC;
}

export function resolvePilarPhotoUrl(previewOrigin?: string | null): string {
  const origin = (previewOrigin || '').trim().replace(/\/$/, '');
  if (origin) return `${origin}${PHOTO_LOCAL}`;
  return PHOTO_PUBLIC;
}

/** Detecta firma/pie corporativo ya embebido en el HTML (plantillas). */
export function htmlHasEmbeddedSignature(html: string): boolean {
  const h = (html || '').toLowerCase();
  if (!h.trim()) return false;
  if (h.includes('data-ff-corporate-signature')) return true;
  if (h.includes('firma-pilar')) return true;
  if (
    h.includes('fundadora y directora') ||
    h.includes('fundadora de farmafácil')
  ) {
    return true;
  }
  if (h.includes('tu farmacia, más cerca')) return true;
  if (
    h.includes('mailto:') &&
    (h.includes('border-radius:40px') || h.includes('border-radius:32px'))
  ) {
    return true;
  }
  return false;
}

export function stripManagedSignature(html: string): string {
  let out = html || '';
  out = out.replace(
    /<table\b[^>]*data-ff-corporate-signature="1"[^>]*>[\s\S]*?<\/table>/gi,
    ''
  );
  return out.trim();
}

function buildPilarSignatureHtml(previewOrigin?: string | null): string {
  const photo = escapeHtml(resolvePilarPhotoUrl(previewOrigin));
  const phone = escapeHtml(PHONE_DISPLAY);
  const tel = escapeHtml(PHONE_TEL);
  return `
<table role="presentation" ${FF_SIGNATURE_MARKER} cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin-top:28px;">
  <tr>
    <td valign="middle" width="88" style="padding-right:16px;">
      <img src="${photo}" width="80" height="80" alt="Pilar Reyes" style="display:block;border:0;outline:none;text-decoration:none;width:80px;height:80px;border-radius:40px;-webkit-border-radius:40px;object-fit:cover;" />
    </td>
    <td valign="middle" style="font-family:${FONT};color:${B.text};">
      <div style="font-size:16px;font-weight:700;color:${B.header};line-height:1.35;">Pilar Reyes Bononat</div>
      <div style="font-size:13px;color:${B.muted};margin-top:3px;line-height:1.4;">Fundadora y Directora | FarmaFácil</div>
      <div style="font-size:13px;margin-top:8px;line-height:1.45;">
        <a href="tel:${tel}" style="color:${B.turquoiseHover};text-decoration:none;">${phone}</a>
      </div>
      <div style="font-size:13px;margin-top:2px;line-height:1.45;">
        <a href="mailto:pilar@farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">pilar@farmafacil.solutions</a>
      </div>
      <div style="font-size:13px;margin-top:2px;line-height:1.45;">
        <a href="https://www.farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">www.farmafacil.solutions</a>
      </div>
    </td>
  </tr>
</table>`.trim();
}

function buildDepartmentSignatureHtml(input: {
  fromKey: string;
  previewOrigin?: string | null;
}): string {
  const sender = getCorporateSender(input.fromKey);
  const logoUrl = escapeHtml(resolveCircularLogoUrl(input.previewOrigin));
  const name = escapeHtml(sender.signatureName);
  const title = escapeHtml(sender.signatureTitle);
  const email = escapeHtml(sender.email);

  return `
<table role="presentation" ${FF_SIGNATURE_MARKER} cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin-top:28px;">
  <tr>
    <td valign="middle" width="72" style="padding-right:14px;">
      <img src="${logoUrl}" width="64" height="64" alt="FarmaFácil" style="display:block;border:0;outline:none;text-decoration:none;width:64px;height:64px;border-radius:32px;-webkit-border-radius:32px;object-fit:cover;" />
    </td>
    <td valign="middle" style="font-family:${FONT};color:${B.text};">
      <div style="font-size:15px;font-weight:700;color:${B.header};line-height:1.35;">${name}</div>
      <div style="font-size:12px;color:${B.muted};margin-top:2px;line-height:1.4;">${title}</div>
      <div style="font-size:12px;margin-top:6px;line-height:1.45;">
        <a href="mailto:${email}" style="color:${B.turquoiseHover};text-decoration:none;">${email}</a>
      </div>
      <div style="font-size:12px;margin-top:2px;line-height:1.45;">
        <a href="https://www.farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">www.farmafacil.solutions</a>
      </div>
    </td>
  </tr>
</table>`.trim();
}

export function buildCorporateSignatureHtml(input: {
  fromKey?: CorporateSenderKey | string | null;
  previewOrigin?: string | null;
}): string {
  const key = (input.fromKey || 'pilar').toLowerCase();
  if (key === 'pilar') {
    return buildPilarSignatureHtml(input.previewOrigin);
  }
  return buildDepartmentSignatureHtml({
    fromKey: key,
    previewOrigin: input.previewOrigin,
  });
}

export function buildCorporateSignatureText(input: {
  fromKey?: CorporateSenderKey | string | null;
}): string {
  const sender = getCorporateSender(input.fromKey);
  if (sender.key === 'pilar') {
    return [
      '',
      '--',
      'Pilar Reyes Bononat',
      'Fundadora y Directora | FarmaFácil',
      PHONE_DISPLAY,
      sender.email,
      'www.farmafacil.solutions',
    ].join('\n');
  }
  return [
    '',
    '--',
    sender.signatureName,
    sender.signatureTitle,
    sender.email,
    'www.farmafacil.solutions',
  ].join('\n');
}

/**
 * Aplica firma gestionada solo si includeSignature=true y el HTML no trae ya firma.
 * Nunca duplica.
 */
export function applySignaturePolicy(input: {
  htmlBody: string;
  textBody: string;
  fromKey?: CorporateSenderKey | string | null;
  previewOrigin?: string | null;
  includeSignature: boolean;
}): { html: string; text: string; applied: boolean } {
  let html = stripManagedSignature(input.htmlBody);
  let text = input.textBody || '';

  if (!input.includeSignature) {
    return { html, text, applied: false };
  }
  if (htmlHasEmbeddedSignature(html)) {
    return { html, text, applied: false };
  }

  const sigHtml = buildCorporateSignatureHtml({
    fromKey: input.fromKey,
    previewOrigin: input.previewOrigin,
  });
  const sigText = buildCorporateSignatureText({ fromKey: input.fromKey });
  html = `${html}\n${sigHtml}`;
  if (!text.includes(sigText.trim())) {
    text = `${text}${sigText}`;
  }
  return { html, text, applied: true };
}

/** @deprecated usar applySignaturePolicy */
export function appendSignatureIfNeeded(input: {
  htmlBody: string;
  textBody: string;
  fromKey?: CorporateSenderKey | string | null;
  previewOrigin?: string | null;
}): { html: string; text: string } {
  return applySignaturePolicy({
    ...input,
    includeSignature: true,
  });
}
