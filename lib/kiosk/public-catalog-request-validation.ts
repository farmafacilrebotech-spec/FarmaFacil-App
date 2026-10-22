/**
 * Validación de solicitudes del catálogo público QR (espejo draft 057).
 * Sin I/O. No registra datos personales.
 */

export const PUBLIC_REQUEST_MAX_LINES = 20;
export const PUBLIC_REQUEST_MAX_QTY = 20;
export const PUBLIC_REQUEST_MIN_QTY = 1;
export const PUBLIC_REQUEST_RATE_LIMIT_PER_HOUR = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_ID_RE = /^[a-z0-9][a-z0-9\-]{2,63}$/;

export type PublicRequestLineInput = {
  productId: string;
  quantity: number;
};

export type PublicRequestErrorCode =
  | 'not_found'
  | 'inactive'
  | 'commercially_blocked'
  | 'pharmacy_unavailable'
  | 'public_catalog_disabled'
  | 'orders_not_entitled'
  | 'empty_cart'
  | 'invalid_cart'
  | 'invalid_product'
  | 'invalid_quantity'
  | 'duplicate_product_in_cart'
  | 'product_not_found'
  | 'product_wrong_pharmacy'
  | 'product_inactive'
  | 'product_not_visible'
  | 'product_unavailable'
  | 'invalid_customer_name'
  | 'invalid_customer_phone'
  | 'invalid_note'
  | 'privacy_required'
  | 'rate_limited'
  | 'invalid_request'
  | 'invalid_total'
  | 'unavailable';

/** Estados canónicos de una solicitud QR recién creada (≠ venta / ≠ waived). */
export const PUBLIC_QR_ORDER_STATUS = 'request_pending' as const;
export const PUBLIC_QR_PAYMENT_STATUS = 'pending_confirmation' as const;

export type PublicRequestContactInput = {
  customerName: string;
  customerPhone: string;
  privacyAccepted: boolean;
  customerNote?: string | null;
};

export type PublicRequestValidationOk = {
  ok: true;
  publicId: string;
  clientRequestId: string;
  customerName: string;
  /** Teléfono nacional ES 9 dígitos (sin +34). */
  customerPhone: string;
  customerNote: string | null;
  lines: Array<{ productId: string; quantity: number }>;
};

export type PublicRequestValidationError = {
  ok: false;
  code: PublicRequestErrorCode;
  message: string;
};

/** Normaliza teléfono ES a 9 dígitos móviles/fijos válidos 6–9. */
export function normalizeSpanishPhone(raw: string): string | null {
  let phone = (raw ?? '').trim().replace(/[^0-9+]/g, '');
  if (!phone) return null;
  if (phone.startsWith('+34')) phone = phone.slice(3);
  else if (phone.startsWith('0034')) phone = phone.slice(4);
  else if (/^34[6-9]\d{8}$/.test(phone)) phone = phone.slice(2);
  if (!/^[6-9]\d{8}$/.test(phone)) return null;
  return phone;
}

export function validatePublicRequestCustomerName(
  raw: string
): { ok: true; name: string } | { ok: false; code: 'invalid_customer_name' } {
  const name = (raw ?? '').trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, code: 'invalid_customer_name' };
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    return { ok: false, code: 'invalid_customer_name' };
  }
  return { ok: true, name };
}

export function validatePublicRequestLines(
  lines: readonly PublicRequestLineInput[]
):
  | { ok: true; lines: Array<{ productId: string; quantity: number }> }
  | { ok: false; code: PublicRequestErrorCode } {
  if (!lines || lines.length === 0) {
    return { ok: false, code: 'empty_cart' };
  }
  if (lines.length > PUBLIC_REQUEST_MAX_LINES) {
    return { ok: false, code: 'invalid_cart' };
  }

  const seen = new Set<string>();
  const resolved: Array<{ productId: string; quantity: number }> = [];

  for (const line of lines) {
    const productId = (line.productId ?? '').trim();
    if (!productId || !UUID_RE.test(productId)) {
      return { ok: false, code: 'invalid_product' };
    }
    if (seen.has(productId)) {
      return { ok: false, code: 'duplicate_product_in_cart' };
    }
    seen.add(productId);

    const qty = line.quantity;
    if (
      typeof qty !== 'number' ||
      !Number.isInteger(qty) ||
      qty < PUBLIC_REQUEST_MIN_QTY ||
      qty > PUBLIC_REQUEST_MAX_QTY
    ) {
      return { ok: false, code: 'invalid_quantity' };
    }

    resolved.push({ productId, quantity: qty });
  }

  return { ok: true, lines: resolved };
}

/**
 * Valida payload completo antes de llamar al RPC.
 * No acepta pharmacy_id del cliente.
 */
export function validatePublicCatalogRequestInput(input: {
  publicId: string;
  clientRequestId: string;
  lines: readonly PublicRequestLineInput[];
  contact: PublicRequestContactInput;
}): PublicRequestValidationOk | PublicRequestValidationError {
  const publicId = (input.publicId ?? '').trim().toLowerCase();
  if (!publicId || !PUBLIC_ID_RE.test(publicId)) {
    return {
      ok: false,
      code: 'not_found',
      message: publicRequestErrorMessage('not_found'),
    };
  }

  const clientRequestId = (input.clientRequestId ?? '').trim();
  if (!clientRequestId || clientRequestId.length > 128) {
    return {
      ok: false,
      code: 'invalid_request',
      message: publicRequestErrorMessage('invalid_request'),
    };
  }

  if (input.contact.privacyAccepted !== true) {
    return {
      ok: false,
      code: 'privacy_required',
      message: publicRequestErrorMessage('privacy_required'),
    };
  }

  const nameResult = validatePublicRequestCustomerName(input.contact.customerName);
  if (!nameResult.ok) {
    return {
      ok: false,
      code: 'invalid_customer_name',
      message: publicRequestErrorMessage('invalid_customer_name'),
    };
  }

  const phone = normalizeSpanishPhone(input.contact.customerPhone);
  if (!phone) {
    return {
      ok: false,
      code: 'invalid_customer_phone',
      message: publicRequestErrorMessage('invalid_customer_phone'),
    };
  }

  let note: string | null = null;
  if (input.contact.customerNote != null) {
    const trimmed = String(input.contact.customerNote).trim();
    if (trimmed) {
      if (trimmed.length > 280 || /[\u0000-\u001f\u007f]/.test(trimmed)) {
        return {
          ok: false,
          code: 'invalid_note',
          message: publicRequestErrorMessage('invalid_note'),
        };
      }
      note = trimmed;
    }
  }

  const linesResult = validatePublicRequestLines(input.lines);
  if (!linesResult.ok) {
    return {
      ok: false,
      code: linesResult.code,
      message: publicRequestErrorMessage(linesResult.code),
    };
  }

  return {
    ok: true,
    publicId,
    clientRequestId,
    customerName: nameResult.name,
    customerPhone: phone,
    customerNote: note,
    lines: linesResult.lines,
  };
}

/** ¿Debe mostrarse precio en UI pública? Nunca inventado; genérico = no. */
export function shouldShowPublicCatalogPrice(catalogMode: 'generic' | 'own'): boolean {
  return catalogMode === 'own';
}

/**
 * En catálogo genérico el total sentinel 0 es válido (precio desconocido).
 * NO implica waived ni venta gratuita. En kiosko 040 total<=0 es inválido.
 */
export function isZeroTotalAllowedForPublicRequest(catalogMode: 'generic' | 'own'): boolean {
  return catalogMode === 'generic';
}

/** La creación pública no exige sesión de kiosko ni cuenta de cliente ni SMS OTP. */
export function publicCatalogRequestAuthRequirements(): {
  requiresKioskSession: boolean;
  requiresCustomerAccount: boolean;
  requiresSmsOtp: boolean;
  guestNamePhoneAllowed: boolean;
} {
  return {
    requiresKioskSession: false,
    requiresCustomerAccount: false,
    requiresSmsOtp: false,
    guestNamePhoneAllowed: true,
  };
}

export function publicRequestErrorMessage(code: PublicRequestErrorCode): string {
  switch (code) {
    case 'not_found':
      return 'No hemos encontrado una farmacia asociada a este código.';
    case 'inactive':
      return 'Este código QR está desactivado o ha caducado.';
    case 'pharmacy_unavailable':
      return 'Esta farmacia no está operativa en este momento.';
    case 'public_catalog_disabled':
      return 'El catálogo público no está habilitado para esta farmacia.';
    case 'orders_not_entitled':
      return 'Esta farmacia no puede recibir solicitudes en este momento.';
    case 'commercially_blocked':
      return 'Esta farmacia no puede recibir solicitudes en este momento.';
    case 'empty_cart':
      return 'Selecciona al menos un producto.';
    case 'invalid_quantity':
      return 'Revisa las cantidades (entre 1 y 20 por producto).';
    case 'duplicate_product_in_cart':
    case 'invalid_cart':
    case 'invalid_product':
      return 'La selección de productos no es válida.';
    case 'product_not_found':
    case 'product_inactive':
    case 'product_not_visible':
    case 'product_unavailable':
      return 'Algunos productos ya no están disponibles. Actualiza la selección.';
    case 'product_wrong_pharmacy':
      return 'Hay productos que no pertenecen a esta farmacia.';
    case 'invalid_customer_name':
      return 'Indica un nombre válido (2–80 caracteres).';
    case 'invalid_customer_phone':
      return 'Indica un teléfono español válido (9 dígitos, o con prefijo +34 / 0034).';
    case 'invalid_note':
      return 'La nota es demasiado larga o contiene caracteres no permitidos.';
    case 'privacy_required':
      return 'Debes aceptar la información de privacidad para enviar la solicitud.';
    case 'rate_limited':
      return 'Has enviado demasiadas solicitudes. Inténtalo más tarde.';
    case 'invalid_total':
      return 'No se ha podido calcular la solicitud.';
    case 'invalid_request':
      return 'No se ha podido enviar la solicitud.';
    case 'unavailable':
    default:
      return 'No se ha podido enviar la solicitud. Inténtalo de nuevo.';
  }
}

export function mapPublicRequestRpcStatus(
  status: string
): PublicRequestErrorCode {
  switch (status) {
    case 'not_found':
      return 'not_found';
    case 'inactive':
      return 'inactive';
    case 'pharmacy_unavailable':
      return 'pharmacy_unavailable';
    case 'public_catalog_disabled':
      return 'public_catalog_disabled';
    case 'orders_not_entitled':
      return 'orders_not_entitled';
    case 'commercially_blocked':
      return 'commercially_blocked';
    case 'empty_cart':
      return 'empty_cart';
    case 'invalid_cart':
    case 'invalid_total':
      return status === 'invalid_total' ? 'invalid_total' : 'invalid_cart';
    case 'invalid_product':
      return 'invalid_product';
    case 'invalid_quantity':
      return 'invalid_quantity';
    case 'duplicate_product_in_cart':
      return 'duplicate_product_in_cart';
    case 'product_not_found':
      return 'product_not_found';
    case 'product_wrong_pharmacy':
      return 'product_wrong_pharmacy';
    case 'product_inactive':
      return 'product_inactive';
    case 'product_not_visible':
      return 'product_not_visible';
    case 'product_unavailable':
      return 'product_unavailable';
    case 'invalid_customer_name':
      return 'invalid_customer_name';
    case 'invalid_customer_phone':
      return 'invalid_customer_phone';
    case 'invalid_note':
      return 'invalid_note';
    case 'privacy_required':
      return 'privacy_required';
    case 'rate_limited':
      return 'rate_limited';
    case 'invalid_request':
      return 'invalid_request';
    default:
      return 'unavailable';
  }
}
