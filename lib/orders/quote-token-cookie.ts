import { cookies } from 'next/headers';

import {
  quoteSessionKeyFromFingerprint,
  quoteTokenCookieName,
  quoteTokenFingerprint,
  sessionKeyMatchesToken,
} from '@/lib/orders/quote-token-binding';

export { redactQuoteSecrets } from '@/lib/orders/quote-secrets';
export {
  quoteSessionKeyFromFingerprint,
  quoteTokenCookieName,
  quoteTokenFingerprint,
} from '@/lib/orders/quote-token-binding';

const MAX_AGE_SEC = 60 * 60 * 2;

/** Solo Server Action / Route Handler (Next no permite set en RSC). */
export function setPublicQuoteTokenCookie(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length < 20) {
    throw new Error('invalid_quote_token');
  }
  const fingerprint = quoteTokenFingerprint(trimmed);
  const sessionKey = quoteSessionKeyFromFingerprint(fingerprint);
  const name = quoteTokenCookieName(sessionKey);
  cookies().set(name, trimmed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/q',
    maxAge: MAX_AGE_SEC,
  });
  return sessionKey;
}

export function readPublicQuoteTokenForSession(
  sessionKey: string
): string | null {
  let name: string;
  try {
    name = quoteTokenCookieName(sessionKey);
  } catch {
    return null;
  }
  const value = cookies().get(name)?.value ?? null;
  if (!value || value.trim().length < 20) return null;
  const trimmed = value.trim();
  if (!sessionKeyMatchesToken(sessionKey, trimmed)) {
    return null;
  }
  return trimmed;
}

export function clearPublicQuoteTokenCookie(sessionKey: string): void {
  let name: string;
  try {
    name = quoteTokenCookieName(sessionKey);
  } catch {
    return;
  }
  cookies().set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/q',
    maxAge: 0,
  });
}

/** Calcula sessionKey sin escribir cookie (válido en RSC). */
export function computeQuoteSessionKey(token: string): string | null {
  const trimmed = token.trim();
  if (trimmed.length < 20) return null;
  return quoteSessionKeyFromFingerprint(quoteTokenFingerprint(trimmed));
}
