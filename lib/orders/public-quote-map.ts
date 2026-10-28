function parseRpcPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

export type PublicQuoteLine = {
  productName: string;
  quantity: number;
  availability: 'pending' | 'available' | 'unavailable' | string;
  unitPrice: number;
  lineTotal: number;
};

export type PublicQuoteState =
  | 'awaiting_decision'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'stale_version'
  | 'cancelled';

export type PublicQuoteView =
  | {
      ok: true;
      quoteState: PublicQuoteState;
      pharmacyName: string;
      displayNumber: string;
      quoteVersion: number;
      currency: string;
      totalAmount: number;
      expiresAt: string | null;
      decidedAt: string | null;
      decision: 'accepted' | 'rejected' | null;
      canDecide: boolean;
      lines: PublicQuoteLine[];
    }
  | { ok: false; error: string; code: string };

export type PublicQuoteDecisionResult =
  | {
      ok: true;
      unchanged: boolean;
      decision: 'accepted' | 'rejected';
      decidedAt: string;
      displayNumber?: string;
      totalAmount?: number;
      quoteVersion?: number;
    }
  | { ok: false; error: string; code: string };

function mapLines(raw: unknown): PublicQuoteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const o = (row && typeof row === 'object' ? row : {}) as Record<
      string,
      unknown
    >;
    return {
      productName: String(o.product_name ?? ''),
      quantity: Number(o.quantity ?? 0),
      availability: String(o.availability ?? 'pending'),
      unitPrice: Number(o.unit_price ?? 0),
      lineTotal: Number(o.line_total ?? 0),
    };
  });
}

const GET_ERRORS: Record<string, string> = {
  invalid_token: 'Este enlace no es válido o ya no está disponible.',
  invalid_request: 'Solicitud no válida.',
};

export function mapPublicQuoteGetPayload(data: unknown): PublicQuoteView {
  const payload = parseRpcPayload(data);
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'ok') {
    const decisionRaw = payload!.decision;
    return {
      ok: true,
      quoteState: String(payload!.quote_state) as PublicQuoteState,
      pharmacyName: String(payload!.pharmacy_name ?? 'Farmacia'),
      displayNumber: String(payload!.display_number ?? ''),
      quoteVersion: Number(payload!.quote_version ?? 0),
      currency: String(payload!.currency ?? 'EUR'),
      totalAmount: Number(payload!.total_amount ?? 0),
      expiresAt:
        payload!.expires_at == null ? null : String(payload!.expires_at),
      decidedAt:
        payload!.decided_at == null ? null : String(payload!.decided_at),
      decision:
        decisionRaw === 'accepted' || decisionRaw === 'rejected'
          ? decisionRaw
          : null,
      canDecide: payload!.can_decide === true,
      lines: mapLines(payload!.lines),
    };
  }

  return {
    ok: false,
    error: GET_ERRORS[status] ?? 'No se ha podido cargar el presupuesto.',
    code: status || 'unknown',
  };
}

const DECIDE_ERRORS: Record<string, string> = {
  invalid_token: 'Este enlace no es válido o ya no está disponible.',
  invalid_request: 'Solicitud no válida.',
  already_decided: 'Este presupuesto ya tiene una decisión registrada.',
  stale_version:
    'El presupuesto se ha actualizado. Pide a la farmacia un enlace nuevo.',
  quote_expired: 'Este presupuesto ha caducado.',
  order_cancelled: 'La solicitud fue cancelada.',
  valuation_required: 'El presupuesto aún no está listo.',
};

export function mapPublicQuoteDecidePayload(
  data: unknown
): PublicQuoteDecisionResult {
  const payload = parseRpcPayload(data);
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'ok') {
    const decision = payload!.decision;
    if (decision !== 'accepted' && decision !== 'rejected') {
      return {
        ok: false,
        error: 'Respuesta de decisión incompleta.',
        code: 'unknown',
      };
    }
    return {
      ok: true,
      unchanged: payload!.unchanged === true,
      decision,
      decidedAt: String(payload!.decided_at ?? ''),
      displayNumber:
        payload!.display_number == null
          ? undefined
          : String(payload!.display_number),
      totalAmount:
        payload!.total_amount == null
          ? undefined
          : Number(payload!.total_amount),
      quoteVersion:
        payload!.quote_version == null
          ? undefined
          : Number(payload!.quote_version),
    };
  }

  return {
    ok: false,
    error: DECIDE_ERRORS[status] ?? 'No se ha podido registrar la decisión.',
    code: status || 'unknown',
  };
}
