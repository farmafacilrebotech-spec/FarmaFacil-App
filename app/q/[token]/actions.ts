'use server';

import { decidePublicQrQuoteByToken } from '@/lib/orders/public-quote';
import type { PublicQuoteDecisionResult } from '@/lib/orders/public-quote-map';
import {
  clearPublicQuoteTokenCookie,
  computeQuoteSessionKey,
  readPublicQuoteTokenForSession,
  setPublicQuoteTokenCookie,
} from '@/lib/orders/quote-token-cookie';

/**
 * Establece cookie httpOnly ligada a ESTE presupuesto.
 * El cliente envía el token de la URL; el servidor exige que coincida con sessionKey.
 */
export async function establishPublicQuoteSessionAction(input: {
  token: string;
  sessionKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = (input.token ?? '').trim();
  const sessionKey = (input.sessionKey ?? '').trim().toLowerCase();
  if (token.length < 20 || !/^[a-f0-9]{16,64}$/.test(sessionKey)) {
    return { ok: false, error: 'Sesión de presupuesto no válida.' };
  }
  const expected = computeQuoteSessionKey(token);
  if (!expected || expected !== sessionKey) {
    return { ok: false, error: 'El enlace no coincide con la sesión.' };
  }
  setPublicQuoteTokenCookie(token);
  return { ok: true };
}

/**
 * Decide usando cookie ligada a sessionKey del presupuesto visualizado.
 */
export async function decidePublicQuoteAction(input: {
  decision: 'accepted' | 'rejected';
  sessionKey: string;
}): Promise<PublicQuoteDecisionResult> {
  const sessionKey = (input.sessionKey ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/.test(sessionKey)) {
    return {
      ok: false,
      error: 'Sesión del enlace no válida. Abre de nuevo el enlace.',
      code: 'invalid_token',
    };
  }

  const token = readPublicQuoteTokenForSession(sessionKey);
  if (!token) {
    return {
      ok: false,
      error: 'Sesión del enlace no disponible. Abre de nuevo el enlace.',
      code: 'invalid_token',
    };
  }

  const result = await decidePublicQrQuoteByToken({
    token,
    decision: input.decision,
  });

  if (!result.ok && result.code === 'invalid_token') {
    clearPublicQuoteTokenCookie(sessionKey);
  }

  return result;
}
