import { createHash, randomBytes } from 'node:crypto';

import { getAppBaseUrl } from '@/lib/auth/app-url';
import { requireOrdersManage } from '@/lib/orders/authz';
import { parseRpcPayload } from '@/lib/orders/parse-rpc-payload';
import { redactQuoteSecrets } from '@/lib/orders/quote-secrets';
import { createClient } from '@/lib/supabase/server';

export type IssueQuoteLinkResult =
  | {
      ok: true;
      url: string;
      expiresAt: string;
      quoteVersion: number;
      displayNumber: string;
      totalAmount: number;
    }
  | { ok: false; error: string; code?: string };

function generateQuoteTokenPlaintext(): string {
  // ≥256 bits CSPRNG, base64url (~43 chars).
  return randomBytes(32).toString('base64url');
}

/** Hash local espejo SQL (no se loguea el plaintext). */
export function hashQuoteTokenLocal(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const ISSUE_ERRORS: Record<string, string> = {
  unauthenticated: 'Debes iniciar sesión.',
  forbidden: 'No tienes permiso para generar el enlace.',
  not_found: 'Pedido no encontrado.',
  not_public_qr: 'Solo aplica a solicitudes del catálogo QR.',
  legacy_total_only: 'Los pedidos históricos de total único no usan este enlace.',
  valuation_required: 'Confirma la valoración antes de generar el enlace.',
  order_closed: 'El pedido está cerrado.',
  already_accepted: 'El presupuesto ya fue aceptado.',
  already_rejected: 'El presupuesto ya fue rechazado.',
  quote_expired: 'El presupuesto ha caducado. Vuelve a valorar para renovarlo.',
  invalid_request: 'No se ha podido generar el enlace.',
};

/**
 * Emite enlace /q/[token]. El plaintext solo vive en esta respuesta.
 * No registrar el token en logs.
 */
export async function issuePublicQrQuoteLink(input: {
  pharmacyId: string;
  orderId: string;
}): Promise<IssueQuoteLinkResult> {
  const auth = await requireOrdersManage(input.pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, code: 'forbidden' };
  }

  const token = generateQuoteTokenPlaintext();
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_issue_public_qr_quote_token_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_order_id: input.orderId,
      p_token_plaintext: token,
    }
  );

  if (error) {
    console.error(
      '[orders] issue quote link',
      redactQuoteSecrets(error.message.replace(token, '[redacted]')).slice(0, 160)
    );
    if (/ff_issue_public_qr_quote_token|does not exist|schema cache/i.test(error.message)) {
      return {
        ok: false,
        error:
          'El enlace de presupuesto aún no está disponible (migración 062 pendiente).',
        code: 'rpc_unavailable',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido generar el enlace.',
      code: 'network_error',
    };
  }

  const payload = parseRpcPayload(data);
  const status = payload && 'status' in payload ? String(payload.status) : '';
  if (status !== 'ok') {
    return {
      ok: false,
      error: ISSUE_ERRORS[status] ?? 'No se ha podido generar el enlace.',
      code: status || 'unknown',
    };
  }

  const returnedToken = String(payload!.token ?? '');
  if (!returnedToken || returnedToken !== token) {
    return {
      ok: false,
      error: 'Respuesta de enlace incompleta.',
      code: 'unknown',
    };
  }

  const base = getAppBaseUrl() || 'http://127.0.0.1:3010';
  const url = `${base.replace(/\/$/, '')}/q/${returnedToken}`;

  return {
    ok: true,
    url,
    expiresAt: String(payload!.expires_at ?? ''),
    quoteVersion: Number(payload!.quote_version ?? 0),
    displayNumber: String(payload!.display_number ?? ''),
    totalAmount: Number(payload!.total_amount ?? 0),
  };
}
