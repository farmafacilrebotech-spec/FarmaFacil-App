/**
 * Firma corporativa con logo circular oficial (composer + envío).
 */

import {
  FF_EMAIL_BRAND as B,
  FF_EMAIL_FONT,
  escapeHtml,
} from './corporate-templates';
import {
  getCorporateSender,
  type CorporateSenderKey,
} from './senders';

export const FF_CIRCULAR_LOGO_PUBLIC =
  'https://www.farmafacil.solutions/images/logo/farmafacil-logo.png';

export const FF_CIRCULAR_LOGO_APP_PATH = '/images/logos/farmafacil-mark.png';

export function resolveCircularLogoUrl(previewOrigin?: string | null): string {
  const origin = (previewOrigin || '').trim().replace(/\/$/, '');
  if (origin) return `${origin}${FF_CIRCULAR_LOGO_APP_PATH}`;
  return FF_CIRCULAR_LOGO_PUBLIC;
}

export function buildCorporateSignatureHtml(input: {
  fromKey?: CorporateSenderKey | string | null;
  previewOrigin?: string | null;
}): string {
  const sender = getCorporateSender(input.fromKey);
  const logoUrl = escapeHtml(resolveCircularLogoUrl(input.previewOrigin));
  const name = escapeHtml(sender.signatureName);
  const title = escapeHtml(sender.signatureTitle);
  const email = escapeHtml(sender.email);

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin-top:28px;">
  <tr>
    <td valign="middle" width="72" style="padding-right:14px;">
      <img src="${logoUrl}" width="64" height="64" alt="FarmaFácil" style="display:block;border:0;outline:none;text-decoration:none;width:64px;height:64px;border-radius:32px;-webkit-border-radius:32px;object-fit:cover;" />
    </td>
    <td valign="middle" style="font-family:${FF_EMAIL_FONT};color:${B.text};">
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

export function buildCorporateSignatureText(input: {
  fromKey?: CorporateSenderKey | string | null;
}): string {
  const sender = getCorporateSender(input.fromKey);
  return [
    '',
    '--',
    sender.signatureName,
    sender.signatureTitle,
    sender.email,
    'www.farmafacil.solutions',
  ].join('\n');
}

/** Une cuerpo + firma si el HTML aún no contiene el marcador de firma. */
export function appendSignatureIfNeeded(input: {
  htmlBody: string;
  textBody: string;
  fromKey?: CorporateSenderKey | string | null;
  previewOrigin?: string | null;
}): { html: string; text: string } {
  const marker = 'data-ff-corporate-signature="1"';
  const sigHtml = buildCorporateSignatureHtml({
    fromKey: input.fromKey,
    previewOrigin: input.previewOrigin,
  }).replace(
    '<table role="presentation"',
    `<table role="presentation" ${marker}`
  );
  const sigText = buildCorporateSignatureText({ fromKey: input.fromKey });
  const html = input.htmlBody.includes('data-ff-corporate-signature')
    ? input.htmlBody
    : `${input.htmlBody}\n${sigHtml}`;
  const text = input.textBody.includes(sigText.trim())
    ? input.textBody
    : `${input.textBody}${sigText}`;
  return { html, text };
}
