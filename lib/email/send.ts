/**
 * Envío transaccional FarmaFácil vía Resend HTTP API (sin SDK).
 * Requiere RESEND_API_KEY. Opcional: EMAIL_FROM (p.ej. "FarmaFácil <noreply@dominio>").
 */

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: 'not_configured' | 'send_failed' };

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    'FarmaFácil <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada; email no enviado', {
      to: input.to,
      subject: input.subject,
    });
    return {
      ok: false,
      error:
        'El envío de email no está configurado (RESEND_API_KEY). La membresía se ha creado; configura el correo para notificar al usuario.',
      code: 'not_configured',
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend error', res.status, body);
      return {
        ok: false,
        error: 'No se ha podido enviar el email de invitación.',
        code: 'send_failed',
      };
    }

    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: json?.id };
  } catch (err) {
    console.error('[email] fetch failed', err);
    return {
      ok: false,
      error: 'No se ha podido enviar el email de invitación.',
      code: 'send_failed',
    };
  }
}
