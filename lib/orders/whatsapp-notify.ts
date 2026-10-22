/**
 * Aviso manual por WhatsApp (wa.me). Sin API externa ni registro de «enviado».
 * Normalización de teléfono alineada con public-catalog-request-validation
 * (misma regla ES móvil/fijo 9 dígitos) para poder testear sin alias @/.
 */

export type WhatsAppNotifyInput = {
  pharmacyName: string;
  displayNumber: string;
  customerPhone: string | null | undefined;
  /** Importe ya confirmado (amount_confirmed_at). Si null, no mencionar cifra. */
  confirmedAmountEuro: number | null;
  currency?: string;
};

export type WhatsAppNotifyBuild =
  | {
      ok: true;
      phoneE164National: string;
      href: string;
      message: string;
    }
  | { ok: false; error: string };

function normalizeSpanishPhoneLocal(raw: string): string | null {
  let phone = (raw ?? '').trim().replace(/[^0-9+]/g, '');
  if (!phone) return null;
  if (phone.startsWith('+34')) phone = phone.slice(3);
  else if (phone.startsWith('0034')) phone = phone.slice(4);
  else if (/^34[6-9]\d{8}$/.test(phone)) phone = phone.slice(2);
  if (!/^[6-9]\d{8}$/.test(phone)) return null;
  return phone;
}

function formatEuroPlain(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Mensaje predefinido (editable en WhatsApp por quien envía). Sin productos ni notas. */
export function buildManualPickupWhatsAppMessage(input: {
  pharmacyName: string;
  displayNumber: string;
  confirmedAmountEuro: number | null;
  currency?: string;
}): string {
  const pharmacy = (input.pharmacyName || 'nuestra farmacia').trim();
  const ref = (input.displayNumber || '').trim() || '—';
  const amountPart =
    input.confirmedAmountEuro != null
      ? ` Importe total confirmado: ${formatEuroPlain(input.confirmedAmountEuro, input.currency ?? 'EUR')}.`
      : '';

  return (
    `Hola, te contactamos desde ${pharmacy}. ` +
    `Tu solicitud #${ref} de FarmaFácil está lista para recoger.` +
    `${amountPart} ` +
    `Para cualquier consulta, contacta con nuestra farmacia. Gracias.`
  );
}

export function buildManualPickupWhatsAppLink(
  input: WhatsAppNotifyInput
): WhatsAppNotifyBuild {
  const phone = normalizeSpanishPhoneLocal(input.customerPhone ?? '');
  if (!phone) {
    return {
      ok: false,
      error:
        'El teléfono de la solicitud no es un número español válido. No se puede abrir WhatsApp.',
    };
  }

  const message = buildManualPickupWhatsAppMessage({
    pharmacyName: input.pharmacyName,
    displayNumber: input.displayNumber,
    confirmedAmountEuro: input.confirmedAmountEuro,
    currency: input.currency,
  });

  const href = `https://wa.me/34${phone}?text=${encodeURIComponent(message)}`;

  return {
    ok: true,
    phoneE164National: phone,
    href,
    message,
  };
}
