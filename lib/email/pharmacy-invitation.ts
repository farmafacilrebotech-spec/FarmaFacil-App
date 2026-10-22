import { createAdminClient } from '@/lib/supabase/admin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';
import { buildInviteOpenUrl } from '@/lib/email/auth-callback-url';
import { sendTransactionalEmail } from '@/lib/email/send';

export {
  buildAuthCallbackUrl,
  buildInviteOpenUrl,
} from '@/lib/email/auth-callback-url';

/**
 * Paleta email = Brand Book FarmaFácil (app/globals.css).
 * No inventar colores: mismos hex documentados en tokens corporativos.
 */
const BRAND = {
  /** Cabecera corporativa (foreground Brand Book) */
  header: '#111827',
  /** Turquesa FarmaFácil — primary */
  turquoise: '#2EC4C7',
  /** Turquesa hover — primary-hover */
  turquoiseHover: '#26B1B3',
  /** Fondo exterior — background */
  grayBg: '#F8FAFC',
  /** Tarjeta — card */
  card: '#FFFFFF',
  /** Texto principal — foreground */
  text: '#111827',
  /** Texto secundario — muted-foreground */
  muted: '#6B7280',
  /** Separadores / plateado — border */
  silver: '#E7EEF3',
  white: '#FFFFFF',
};

/** Logotipo oficial servido en el dominio canónico (verificado HTTPS). */
const LOGO_URL = `${CANONICAL_PRODUCTION_APP_URL}/images/logos/farmafacil-mark.png`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email FarmaFácil: usuario NUEVO (primer acceso / contraseña).
 * Enlace token_hash → /first-access. No usa el SMTP de inviteUserByEmail.
 */
export async function sendNewUserPharmacyInviteEmail(input: {
  to: string;
  pharmacyName: string;
  appBaseUrl: string;
  recipientName?: string | null;
  hashedToken: string;
  otpType: string;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const email = input.to.trim().toLowerCase();
  // Landing /auth/invite-open: el OTP solo se consume al pulsar Continuar.
  const actionUrl = buildInviteOpenUrl({
    appBaseUrl: input.appBaseUrl,
    hashedToken: input.hashedToken,
    otpType: input.otpType,
    nextPath: '/first-access',
  });

  return sendInviteContent({
    to: email,
    pharmacyName: input.pharmacyName,
    recipientName: input.recipientName,
    actionUrl,
    actionLabel: 'Completar acceso',
    variant: 'new',
  });
}

/**
 * Email FarmaFácil: usuario YA existente invitado a una farmacia.
 * Magic link vía token_hash SSR → /auth/invitations.
 */
export async function sendExistingUserPharmacyInviteEmail(input: {
  to: string;
  pharmacyName: string;
  appBaseUrl: string;
  recipientName?: string | null;
  /** Si ya se generó el enlace (p.ej. en invite-actions), evita un segundo generateLink. */
  hashedToken?: string;
  otpType?: string;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const email = input.to.trim().toLowerCase();
  const invitationsNext = `/auth/invitations?for=${encodeURIComponent(email)}`;

  let hashedToken = input.hashedToken?.trim() || '';
  let otpType = input.otpType?.trim() || 'magiclink';

  if (!hashedToken) {
    const admin = createAdminClient();
    const redirectTo = `${input.appBaseUrl}/auth/callback?next=${encodeURIComponent(invitationsNext)}`;

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });

    hashedToken = linkData?.properties?.hashed_token ?? '';
    const verificationType =
      (linkData?.properties as { verification_type?: string } | undefined)
        ?.verification_type || 'magiclink';
    otpType = verificationType === 'signup' ? 'email' : verificationType;

    if (linkError || !hashedToken) {
      console.error(
        '[email] generateLink magiclink',
        linkError?.message ?? 'no hashed_token'
      );
      // Fallback: login con next (no recovery). El usuario ya tiene contraseña.
      const loginUrl = `${input.appBaseUrl}/login?next=${encodeURIComponent('/auth/invitations')}&email=${encodeURIComponent(email)}&hint=invite`;
      return sendInviteContent({
        to: email,
        pharmacyName: input.pharmacyName,
        recipientName: input.recipientName,
        actionUrl: loginUrl,
        actionLabel: 'Ver invitación',
        variant: 'existing',
      });
    }
  }

  const actionUrl = buildInviteOpenUrl({
    appBaseUrl: input.appBaseUrl,
    hashedToken,
    otpType,
    nextPath: invitationsNext,
  });

  return sendInviteContent({
    to: email,
    pharmacyName: input.pharmacyName,
    recipientName: input.recipientName,
    actionUrl,
    actionLabel: 'Ver invitación',
    variant: 'existing',
  });
}

async function sendInviteContent(input: {
  to: string;
  pharmacyName: string;
  recipientName?: string | null;
  actionUrl: string;
  actionLabel: string;
  variant: 'new' | 'existing';
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const name = input.recipientName?.trim() || '';
  const pharmacy = input.pharmacyName.trim() || 'una farmacia';
  const greeting = name ? `Hola ${name},` : 'Hola,';

  const subject =
    input.variant === 'new'
      ? `Invitación a ${pharmacy} en FarmaFácil`
      : 'Te han invitado a una nueva farmacia';

  const bodyLead =
    input.variant === 'new'
      ? [
          'Has sido invitado a acceder a:',
          pharmacy,
          '',
          'Completa tu acceso creando tu contraseña en FarmaFácil.',
        ]
      : [
          'Has recibido una invitación para acceder a:',
          pharmacy,
          '',
          'desde tu cuenta de FarmaFácil.',
          '',
          'Ya tienes una cuenta, por lo que no necesitas crear una contraseña nueva.',
        ];

  const text = [
    subject,
    '',
    greeting,
    '',
    ...bodyLead,
    '',
    `${input.actionLabel}:`,
    input.actionUrl,
    '',
    input.variant === 'new'
      ? 'Si no esperabas esta invitación, puedes ignorar este mensaje.'
      : 'Al acceder podrás revisar y aceptar la invitación.\nSi no esperabas esta invitación, puedes ignorar este mensaje.',
    '',
    'Equipo FarmaFácil',
  ].join('\n');

  const html = buildInviteEmailHtml({
    greeting,
    pharmacy,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel,
    variant: input.variant,
    title: subject,
  });

  const sent = await sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error, code: sent.code };
  }
  return { ok: true };
}

function buildInviteEmailHtml(input: {
  greeting: string;
  pharmacy: string;
  actionUrl: string;
  actionLabel: string;
  variant: 'new' | 'existing';
  title: string;
}): string {
  const greeting = escapeHtml(input.greeting);
  const pharmacy = escapeHtml(input.pharmacy);
  const actionUrl = escapeHtml(input.actionUrl);
  const actionLabel = escapeHtml(input.actionLabel);
  const title = escapeHtml(input.title);
  const logoUrl = escapeHtml(LOGO_URL);
  const font =
    "Arial, Helvetica, 'Helvetica Neue', sans-serif";

  const middle =
    input.variant === 'new'
      ? `<p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:${BRAND.text};">
                Completa tu acceso creando tu contraseña en FarmaFácil.
              </p>`
      : `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${BRAND.text};">
                desde tu cuenta de FarmaFácil.
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:${BRAND.text};">
                Ya tienes una cuenta, por lo que <strong>no necesitas crear una contraseña nueva</strong>.
              </p>`;

  const afterCta =
    input.variant === 'new'
      ? `<p style="margin:0 0 24px 0;font-size:14px;line-height:1.55;color:${BRAND.muted};">
                Si no esperabas esta invitación, puedes ignorar este mensaje.
              </p>`
      : `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;color:${BRAND.muted};">
                Al acceder podrás revisar y aceptar la invitación.
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.55;color:${BRAND.muted};">
                Si no esperabas esta invitación, puedes ignorar este mensaje.
              </p>`;

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Invitación FarmaFácil</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.grayBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- ff-pharmacy-invite-v4 -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:${BRAND.grayBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px;background-color:${BRAND.card};border:1px solid ${BRAND.silver};">
          <!-- Cabecera negra corporativa + logotipo oficial -->
          <tr>
            <td align="center" style="background-color:${BRAND.header};padding:28px 32px;text-align:center;">
              <img src="${logoUrl}" width="56" height="56" alt="FarmaFácil" style="display:block;margin:0 auto 12px auto;border:0;outline:none;text-decoration:none;height:56px;width:56px;" />
              <div style="font-family:${font};font-size:20px;font-weight:700;color:${BRAND.white};letter-spacing:0.3px;line-height:1.3;">
                FarmaFácil
              </div>
              <div style="font-family:${font};font-size:12px;color:${BRAND.silver};margin-top:6px;letter-spacing:0.2px;line-height:1.4;">
                Tu farmacia, más cerca de tus clientes
              </div>
            </td>
          </tr>
          <!-- Acento turquesa -->
          <tr>
            <td style="background-color:${BRAND.turquoise};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Cuerpo -->
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:${font};color:${BRAND.text};">
              <h1 style="margin:0 0 20px 0;font-family:${font};font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.header};">
                ${title}
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${BRAND.text};">
                ${greeting}
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.55;color:${BRAND.text};">
                Has recibido una invitación para acceder a:
              </p>
              <p style="margin:0 0 16px 0;font-size:17px;line-height:1.4;font-weight:700;color:${BRAND.turquoiseHover};">
                ${pharmacy}
              </p>
              ${middle}
              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 auto 28px auto;">
                <tr>
                  <td align="center" bgcolor="${BRAND.turquoise}" style="background-color:${BRAND.turquoise};border-radius:8px;">
                    <a href="${actionUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:${font};font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:8px;background-color:${BRAND.turquoise};">
                      ${actionLabel}
                    </a>
                  </td>
                </tr>
              </table>
              ${afterCta}
              <p style="margin:0;font-size:14px;line-height:1.55;color:${BRAND.text};">
                Equipo FarmaFácil
              </p>
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid ${BRAND.silver};font-family:${font};font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
              Este mensaje lo envía FarmaFácil. El enlace de acceso es personal y de un solo uso.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
