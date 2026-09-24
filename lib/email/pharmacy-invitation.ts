import { createAdminClient } from '@/lib/supabase/admin';
import { sendTransactionalEmail } from '@/lib/email/send';

/** Aguamarina FarmaFácil (emails). */
const BRAND = {
  teal: '#0d9488',
  tealDark: '#0f766e',
  tealDeep: '#115e59',
  grayBg: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Construye URL SSR de callback con token_hash.
 * Evita el action_link implícito (#access_token) que no puede leer el route handler
 * y que reutiliza la sesión previa del navegador.
 */
function buildInviteCallbackUrl(input: {
  appBaseUrl: string;
  hashedToken: string;
  otpType: string;
  recipientEmail: string;
}): string {
  const next = `/auth/invitations?for=${encodeURIComponent(
    input.recipientEmail.trim().toLowerCase()
  )}`;
  const params = new URLSearchParams({
    token_hash: input.hashedToken,
    type: input.otpType,
    next,
  });
  return `${input.appBaseUrl}/auth/callback?${params.toString()}`;
}

/**
 * Email FarmaFácil: usuario YA existente invitado a una farmacia.
 * Magic link vía token_hash SSR → /auth/invitations. No usa inviteUserByEmail.
 */
export async function sendExistingUserPharmacyInviteEmail(input: {
  to: string;
  pharmacyName: string;
  appBaseUrl: string;
  recipientName?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const admin = createAdminClient();
  const email = input.to.trim().toLowerCase();
  // redirectTo solo para allowlist de Supabase; el enlace del email usa token_hash propio.
  const redirectTo = `${input.appBaseUrl}/auth/callback?next=${encodeURIComponent(
    `/auth/invitations?for=${encodeURIComponent(email)}`
  )}`;

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

  const hashedToken = linkData?.properties?.hashed_token;
  const verificationType =
    (linkData?.properties as { verification_type?: string } | undefined)
      ?.verification_type || 'magiclink';

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
    });
  }

  const actionUrl = buildInviteCallbackUrl({
    appBaseUrl: input.appBaseUrl,
    hashedToken,
    otpType: verificationType === 'signup' ? 'email' : 'magiclink',
    recipientEmail: email,
  });

  return sendInviteContent({
    to: email,
    pharmacyName: input.pharmacyName,
    recipientName: input.recipientName,
    actionUrl,
    actionLabel: 'Ver invitación',
  });
}

async function sendInviteContent(input: {
  to: string;
  pharmacyName: string;
  recipientName?: string | null;
  actionUrl: string;
  actionLabel: string;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const name = input.recipientName?.trim() || '';
  const pharmacy = input.pharmacyName.trim() || 'una farmacia';
  const subject = `Te han invitado a una nueva farmacia`;
  const greeting = name ? `Hola ${name},` : 'Hola,';

  const text = [
    'Te han invitado a una nueva farmacia',
    '',
    greeting,
    '',
    'Has recibido una invitación para acceder a:',
    pharmacy,
    '',
    'desde tu cuenta de FarmaFácil.',
    '',
    'Ya tienes una cuenta, por lo que no necesitas crear una contraseña nueva.',
    '',
    `${input.actionLabel}:`,
    input.actionUrl,
    '',
    'Al acceder podrás revisar y aceptar la invitación.',
    'Si no esperabas esta invitación, puedes ignorar este mensaje.',
    '',
    'Equipo FarmaFácil',
  ].join('\n');

  const html = buildInviteEmailHtml({
    greeting,
    pharmacy,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel,
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
}): string {
  const greeting = escapeHtml(input.greeting);
  const pharmacy = escapeHtml(input.pharmacy);
  const actionUrl = escapeHtml(input.actionUrl);
  const actionLabel = escapeHtml(input.actionLabel);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invitación FarmaFácil</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.grayBg};">
  <!-- ff-pharmacy-invite-v2 -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.grayBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:${BRAND.card};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
          <tr>
            <td style="background-color:${BRAND.teal};padding:28px 32px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">
                FarmaFácil
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#ccfbf1;margin-top:6px;">
                Tu farmacia, más cerca de tus clientes
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
              <h1 style="margin:0 0 20px 0;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.tealDeep};">
                Te han invitado a una nueva farmacia
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">
                ${greeting}
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.55;">
                Has recibido una invitación para acceder a:
              </p>
              <p style="margin:0 0 16px 0;font-size:17px;line-height:1.4;font-weight:700;color:${BRAND.tealDark};">
                ${pharmacy}
              </p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">
                desde tu cuenta de FarmaFácil.
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;">
                Ya tienes una cuenta, por lo que <strong>no necesitas crear una contraseña nueva</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${BRAND.teal};">
                    <a href="${actionUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${actionLabel}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;color:${BRAND.muted};">
                Al acceder podrás revisar y aceptar la invitación.
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.55;color:${BRAND.muted};">
                Si no esperabas esta invitación, puedes ignorar este mensaje.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:${BRAND.text};">
                Equipo FarmaFácil
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
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
