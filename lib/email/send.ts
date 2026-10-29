/**
 * Envío transaccional FarmaFácil vía Resend HTTP API (sin SDK).
 * Requiere RESEND_API_KEY y un remitente configurado (EMAIL_FROM o `from` explícito).
 * No usa direcciones de desarrollo inventadas.
 */

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: 'not_configured' | 'send_failed' };

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Remitente opcional; si no se indica, se usa EMAIL_FROM. */
  from?: string;
  /** Reply-To opcional. */
  replyTo?: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = input.from?.trim() || process.env.EMAIL_FROM?.trim() || '';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada; email no enviado', {
      to: input.to,
      subject: input.subject,
    });
    return {
      ok: false,
      error:
        'El envío de email no está configurado (falta RESEND_API_KEY en el servidor). No se ha enviado ningún correo.',
      code: 'not_configured',
    };
  }

  if (!from) {
    return {
      ok: false,
      error:
        'El envío de email no está configurado (falta EMAIL_FROM o remitente explícito). No se ha enviado ningún correo.',
      code: 'not_configured',
    };
  }

  try {
    const payload: Record<string, unknown> = {
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    };
    const replyTo = input.replyTo?.trim();
    if (replyTo) {
      payload.reply_to = replyTo;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend error', res.status, body);
      return {
        ok: false,
        error: 'No se ha podido enviar el email.',
        code: 'send_failed',
      };
    }

    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: json?.id };
  } catch (err) {
    console.error('[email] fetch failed', err);
    return {
      ok: false,
      error: 'No se ha podido enviar el email.',
      code: 'send_failed',
    };
  }
}
