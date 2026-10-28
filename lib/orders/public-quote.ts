import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

import {
  mapPublicQuoteDecidePayload,
  mapPublicQuoteGetPayload,
  type PublicQuoteDecisionResult,
  type PublicQuoteView,
} from '@/lib/orders/public-quote-map';
import {
  isQuoteRateRpcMissingMessage,
  quoteRateAllowShared,
} from '@/lib/orders/quote-rate-limit';
import { redactQuoteSecrets } from '@/lib/orders/quote-secrets';
import { createClient } from '@/lib/supabase/server';

function quoteClientBucketKey(): string {
  const h = headers();
  const forwarded = h.get('x-forwarded-for');
  const ip =
    (forwarded ? forwarded.split(',')[0]?.trim() : null) ||
    h.get('x-real-ip')?.trim() ||
    'unknown';
  const ua = h.get('user-agent')?.slice(0, 80) ?? '';
  return createHash('sha256')
    .update(`quote-r4-v1:${ip}:${ua}`, 'utf8')
    .digest('hex');
}

async function enforceQuoteRateLimit(): Promise<boolean> {
  const key = quoteClientBucketKey();
  const supabase = createClient();
  const result = await quoteRateAllowShared(key, async (bucketKey) => {
    const { data, error } = await supabase.rpc(
      'ff_public_qr_quote_rate_allow_v1',
      { p_bucket_key: bucketKey }
    );
    if (error) {
      if (isQuoteRateRpcMissingMessage(error.message)) {
        return { missing: true as const };
      }
      console.error(
        '[orders] quote rate rpc error',
        redactQuoteSecrets(error.message).slice(0, 120)
      );
      return { error: true as const };
    }
    const payload =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    if (!payload || typeof payload.allowed !== 'boolean') {
      return { error: true as const };
    }
    return { allowed: payload.allowed === true };
  });
  return result.allowed;
}

/** Carga presupuesto público. No loguea el token. */
export async function getPublicQrQuoteByToken(
  token: string
): Promise<PublicQuoteView> {
  const trimmed = (token ?? '').trim();
  if (trimmed.length < 20) {
    return {
      ok: false,
      error: 'Este enlace no es válido o ya no está disponible.',
      code: 'invalid_token',
    };
  }

  if (!(await enforceQuoteRateLimit())) {
    return {
      ok: false,
      error: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
      code: 'rate_limited',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_get_public_qr_quote_by_token_v1',
    { p_token: trimmed }
  );

  if (error) {
    console.error(
      '[orders] get public quote',
      redactQuoteSecrets(error.message).slice(0, 120)
    );
    if (
      /ff_get_public_qr_quote_by_token|does not exist|schema cache/i.test(
        error.message
      )
    ) {
      return {
        ok: false,
        error: 'El servicio de presupuestos no está disponible.',
        code: 'rpc_unavailable',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido cargar el presupuesto.',
      code: 'network_error',
    };
  }

  return mapPublicQuoteGetPayload(data);
}

export async function decidePublicQrQuoteByToken(input: {
  token: string;
  decision: 'accepted' | 'rejected';
}): Promise<PublicQuoteDecisionResult> {
  const trimmed = (input.token ?? '').trim();
  if (trimmed.length < 20) {
    return {
      ok: false,
      error: 'Este enlace no es válido o ya no está disponible.',
      code: 'invalid_token',
    };
  }

  if (!(await enforceQuoteRateLimit())) {
    return {
      ok: false,
      error: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
      code: 'rate_limited',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_decide_public_qr_quote_by_token_v1',
    {
      p_token: trimmed,
      p_decision: input.decision,
    }
  );

  if (error) {
    console.error(
      '[orders] decide public quote',
      redactQuoteSecrets(error.message).slice(0, 120)
    );
    if (
      /ff_decide_public_qr_quote_by_token|does not exist|schema cache/i.test(
        error.message
      )
    ) {
      return {
        ok: false,
        error: 'El servicio de presupuestos no está disponible.',
        code: 'rpc_unavailable',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido registrar la decisión.',
      code: 'network_error',
    };
  }

  return mapPublicQuoteDecidePayload(data);
}
