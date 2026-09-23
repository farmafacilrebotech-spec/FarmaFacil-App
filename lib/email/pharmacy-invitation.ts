import { createAdminClient } from '@/lib/supabase/admin';
import { sendTransactionalEmail } from '@/lib/email/send';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email propio FarmaFácil para usuario YA existente invitado a una farmacia.
 * Genera magic link de Auth (login) → /auth/invitations. No usa inviteUserByEmail.
 */
export async function sendExistingUserPharmacyInviteEmail(input: {
  to: string;
  pharmacyName: string;
  appBaseUrl: string;
  recipientName?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const admin = createAdminClient();
  const redirectTo = `${input.appBaseUrl}/auth/callback?next=/auth/invitations`;

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: input.to,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error(
      '[email] generateLink magiclink',
      linkError?.message ?? 'no action_link'
    );
    // Fallback: enlace de login manual (el usuario ya tiene contraseña).
    const loginUrl = `${input.appBaseUrl}/login?next=${encodeURIComponent('/auth/invitations')}`;
    return sendInviteContent({
      to: input.to,
      pharmacyName: input.pharmacyName,
      recipientName: input.recipientName,
      actionUrl: loginUrl,
      actionLabel: 'Iniciar sesión en FarmaFácil',
    });
  }

  return sendInviteContent({
    to: input.to,
    pharmacyName: input.pharmacyName,
    recipientName: input.recipientName,
    actionUrl: linkData.properties.action_link,
    actionLabel: 'Acceder a FarmaFácil',
  });
}

async function sendInviteContent(input: {
  to: string;
  pharmacyName: string;
  recipientName?: string | null;
  actionUrl: string;
  actionLabel: string;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const name = input.recipientName?.trim() || 'hola';
  const pharmacy = input.pharmacyName.trim() || 'una farmacia';
  const subject = `Te han invitado a acceder a ${pharmacy}`;

  const text = [
    `Hola ${name},`,
    '',
    `Te han invitado a acceder a ${pharmacy} en FarmaFácil.`,
    '',
    `Ya tienes cuenta en FarmaFácil: no necesitas crear una contraseña nueva.`,
    `Accede con el siguiente enlace e inicia sesión para aceptar la invitación:`,
    input.actionUrl,
    '',
    'Si no esperabas este mensaje, puedes ignorarlo.',
    '',
    '— Equipo FarmaFácil',
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p>Hola ${escapeHtml(name)},</p>
      <p>Te han invitado a acceder a <strong>${escapeHtml(pharmacy)}</strong> en FarmaFácil.</p>
      <p>Ya tienes cuenta en FarmaFácil: <strong>no necesitas crear una contraseña nueva</strong>.</p>
      <p>
        <a href="${escapeHtml(input.actionUrl)}"
           style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;">
          ${escapeHtml(input.actionLabel)}
        </a>
      </p>
      <p style="color:#666;font-size:14px;">Después de entrar podrás aceptar la invitación pendiente.</p>
      <p style="color:#666;font-size:13px;">Si no esperabas este mensaje, puedes ignorarlo.</p>
      <p>— Equipo FarmaFácil</p>
    </div>
  `.trim();

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
