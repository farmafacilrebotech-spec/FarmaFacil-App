/**
 * Valoración por línea de solicitudes public_qr (espejo draft 060).
 * Pura / testeable sin BD. El total lo calcula siempre el servidor.
 */

export const LINE_AVAILABILITY_STATUSES = [
  'pending',
  'available',
  'unavailable',
] as const;

export type LineAvailabilityStatus = (typeof LINE_AVAILABILITY_STATUSES)[number];

export type ValuationLineInput = {
  itemId: string;
  availability: 'available' | 'unavailable';
  /** Obligatorio y > 0 si available (MVP). Ignorado si unavailable. */
  unitPrice?: number | null;
  staffNote?: string | null;
};

export type ValuationLineContext = {
  itemId: string;
  quantity: number;
};

export type ValidatedValuationLine = {
  itemId: string;
  availability: 'available' | 'unavailable';
  unitPrice: number;
  lineTotal: number;
  staffNote: string | null;
};

export type ValidateValuationOk = {
  ok: true;
  lines: ValidatedValuationLine[];
  /** Total servidor: solo líneas available. */
  totalAmount: number;
  availableCount: number;
};

export type ValidateValuationError = {
  ok: false;
  code:
    | 'empty'
    | 'count_mismatch'
    | 'duplicate_item'
    | 'unknown_item'
    | 'incomplete'
    | 'invalid_availability'
    | 'invalid_quantity'
    | 'invalid_amount'
    | 'invalid_note'
    | 'zero_price_not_allowed';
  message: string;
  itemId?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEuroAmount(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (value < 0 || value > 9_999_999.99) return false;
  return Math.round(value * 100) / 100 === value;
}

/**
 * Valida el payload de valoración (sin pending: al confirmar hay que decidir).
 * No acepta un total enviado por el cliente.
 */
export function validatePublicQrLineValuation(input: {
  existingLines: readonly ValuationLineContext[];
  submitted: readonly ValuationLineInput[];
}): ValidateValuationOk | ValidateValuationError {
  const existing = input.existingLines;
  if (existing.length === 0) {
    return { ok: false, code: 'empty', message: 'El pedido no tiene líneas.' };
  }
  if (input.submitted.length !== existing.length) {
    return {
      ok: false,
      code: 'count_mismatch',
      message: 'Debes valorar todas las líneas del pedido.',
    };
  }

  const byId = new Map(existing.map((l) => [l.itemId, l]));
  const seen = new Set<string>();
  const lines: ValidatedValuationLine[] = [];
  let totalAmount = 0;
  let availableCount = 0;

  for (const row of input.submitted) {
    if (!row.itemId || !UUID_RE.test(row.itemId)) {
      return {
        ok: false,
        code: 'unknown_item',
        message: 'Identificador de línea no válido.',
        itemId: row.itemId,
      };
    }
    if (seen.has(row.itemId)) {
      return {
        ok: false,
        code: 'duplicate_item',
        message: 'Hay líneas duplicadas en la valoración.',
        itemId: row.itemId,
      };
    }
    seen.add(row.itemId);

    const ctx = byId.get(row.itemId);
    if (!ctx) {
      return {
        ok: false,
        code: 'unknown_item',
        message: 'La línea no pertenece a este pedido.',
        itemId: row.itemId,
      };
    }
    if (!Number.isInteger(ctx.quantity) || ctx.quantity < 1 || ctx.quantity > 99) {
      return {
        ok: false,
        code: 'invalid_quantity',
        message: 'Cantidad de línea no válida.',
        itemId: row.itemId,
      };
    }

    if (row.availability !== 'available' && row.availability !== 'unavailable') {
      return {
        ok: false,
        code: 'invalid_availability',
        message: 'Indica si el producto está disponible o no.',
        itemId: row.itemId,
      };
    }

    let note: string | null = null;
    if (row.staffNote != null && String(row.staffNote).trim() !== '') {
      note = String(row.staffNote).trim();
      if (note.length > 280 || /[\u0000-\u001f\u007f]/.test(note)) {
        return {
          ok: false,
          code: 'invalid_note',
          message: 'La observación no es válida (máx. 280 caracteres).',
          itemId: row.itemId,
        };
      }
    }

    if (row.availability === 'unavailable') {
      lines.push({
        itemId: row.itemId,
        availability: 'unavailable',
        unitPrice: 0,
        lineTotal: 0,
        staffNote: note,
      });
      continue;
    }

    const unit = row.unitPrice;
    if (unit == null || !isValidEuroAmount(unit)) {
      return {
        ok: false,
        code: 'invalid_amount',
        message: 'Precio unitario no válido (euros, 2 decimales).',
        itemId: row.itemId,
      };
    }
    if (unit <= 0) {
      return {
        ok: false,
        code: 'zero_price_not_allowed',
        message:
          'Un producto disponible debe tener precio mayor que 0 € (MVP).',
        itemId: row.itemId,
      };
    }

    const lineTotal = Math.round(unit * ctx.quantity * 100) / 100;
    availableCount += 1;
    totalAmount = Math.round((totalAmount + lineTotal) * 100) / 100;
    lines.push({
      itemId: row.itemId,
      availability: 'available',
      unitPrice: unit,
      lineTotal,
      staffNote: note,
    });
  }

  for (const ctx of existing) {
    if (!seen.has(ctx.itemId)) {
      return {
        ok: false,
        code: 'incomplete',
        message: 'Faltan líneas por valorar.',
        itemId: ctx.itemId,
      };
    }
  }

  return { ok: true, lines, totalAmount, availableCount };
}

/** ¿Pedido QR histórico sellado (total 058 sin desglose)? */
export function isLegacyTotalOnlyPublicQr(input: {
  source: string;
  quoteLegacyTotalOnly?: boolean | null;
  amountConfirmedAt: string | null;
  linesValuedAt: string | null;
  items: readonly { unitPrice: number; availabilityStatus?: string | null }[];
}): boolean {
  if (input.source !== 'public_qr') return false;
  if (input.quoteLegacyTotalOnly === true) return true;
  // Fallback UI si la columna aún no existe: total confirmado, sin lines_valued, precios 0.
  if (!input.amountConfirmedAt || input.linesValuedAt) return false;
  return input.items.every((i) => i.unitPrice === 0);
}

/**
 * Gate espejo SQL: ¿puede public_qr pasar a preparing?
 */
export function publicQrMayEnterPreparing(input: {
  source: string;
  linesValuedAt: string | null;
  customerAcceptedAt: string | null;
  customerRejectedAt?: string | null;
  quoteLegacyTotalOnly?: boolean | null;
}):
  | { ok: true }
  | {
      ok: false;
      code:
        | 'valuation_required'
        | 'quote_awaiting_customer_acceptance'
        | 'quote_rejected';
    } {
  if (input.source !== 'public_qr') return { ok: true };

  if (input.customerRejectedAt) {
    return { ok: false, code: 'quote_rejected' };
  }

  if (input.linesValuedAt) {
    if (!input.customerAcceptedAt) {
      return { ok: false, code: 'quote_awaiting_customer_acceptance' };
    }
    return { ok: true };
  }

  if (input.quoteLegacyTotalOnly === true) {
    return { ok: true };
  }

  return { ok: false, code: 'valuation_required' };
}

export function filterOrderStatusOptionsForPublicQr(input: {
  source: string;
  status: string;
  linesValuedAt: string | null;
  customerAcceptedAt: string | null;
  customerRejectedAt?: string | null;
  quoteLegacyTotalOnly?: boolean | null;
  options: readonly string[];
}): string[] {
  if (input.source !== 'public_qr') {
    return [...input.options];
  }
  const gate = publicQrMayEnterPreparing({
    source: input.source,
    linesValuedAt: input.linesValuedAt,
    customerAcceptedAt: input.customerAcceptedAt,
    customerRejectedAt: input.customerRejectedAt,
    quoteLegacyTotalOnly: input.quoteLegacyTotalOnly,
  });
  if (gate.ok) return [...input.options];

  // Nuevas solicitudes QR: sin aceptación (ni legacy) no ofrecer preparing ni ready.
  if (input.status === 'request_pending') {
    return input.options.filter((o) => o !== 'preparing' && o !== 'ready');
  }
  // Defensa: si ya está en preparing sin aceptación, no ofrecer ready.
  if (input.status === 'preparing') {
    return input.options.filter((o) => o !== 'ready');
  }
  return [...input.options];
}
