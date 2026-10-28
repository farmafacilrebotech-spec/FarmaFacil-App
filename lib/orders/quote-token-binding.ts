import { createHash } from 'node:crypto';

/** Fingerprint estable (sha256 hex) del token plaintext. */
export function quoteTokenFingerprint(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export function quoteSessionKeyFromFingerprint(fingerprint: string): string {
  return fingerprint.slice(0, 32);
}

export function quoteTokenCookieName(sessionKey: string): string {
  const key = sessionKey.trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/.test(key)) {
    throw new Error('invalid_quote_session_key');
  }
  return `ff_q_${key}`;
}

export function sessionKeyMatchesToken(
  sessionKey: string,
  token: string
): boolean {
  const fp = quoteTokenFingerprint(token);
  return quoteSessionKeyFromFingerprint(fp) === sessionKey.trim().toLowerCase();
}
