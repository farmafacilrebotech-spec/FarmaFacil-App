/**
 * Rate-limit R4 /q get+decide.
 * - Preferido: Postgres (063) → compartido entre instancias (Vercel).
 * - Fallback memoria SOLO si la RPC aún no existe.
 * - Cualquier otro fallo de Postgres → DENEGAR (fail-closed).
 */

export const QUOTE_RATE_WINDOW_MS = 15 * 60 * 1000;
export const QUOTE_RATE_MAX_ATTEMPTS = 40;
export const QUOTE_RATE_BLOCK_MS = 15 * 60 * 1000;

type Bucket = {
  windowStartedAt: number;
  attemptCount: number;
  blockedUntil: number | null;
};

const buckets = new Map<string, Bucket>();

export function quoteRateAllowMemory(
  bucketKey: string,
  nowMs = Date.now()
): boolean {
  const existing = buckets.get(bucketKey) ?? null;
  if (existing?.blockedUntil != null && existing.blockedUntil > nowMs) {
    return false;
  }

  let bucket = existing;
  if (!bucket || bucket.windowStartedAt + QUOTE_RATE_WINDOW_MS < nowMs) {
    bucket = {
      windowStartedAt: nowMs,
      attemptCount: 0,
      blockedUntil: null,
    };
  }

  const attemptCount = bucket.attemptCount + 1;
  const next: Bucket = {
    ...bucket,
    attemptCount,
    blockedUntil:
      attemptCount >= QUOTE_RATE_MAX_ATTEMPTS
        ? nowMs + QUOTE_RATE_BLOCK_MS
        : bucket.blockedUntil,
  };
  buckets.set(bucketKey, next);
  return attemptCount <= QUOTE_RATE_MAX_ATTEMPTS;
}

/** @deprecated tests → quoteRateAllowMemory */
export function quoteRateAllow(bucketKey: string, nowMs = Date.now()): boolean {
  return quoteRateAllowMemory(bucketKey, nowMs);
}

export function quoteRateResetForTests(): void {
  buckets.clear();
}

export type QuoteRateRpcResult =
  | { allowed: boolean }
  | { missing: true }
  | { error: true };

export type QuoteRateAllowResult = {
  allowed: boolean;
  source: 'postgres' | 'memory' | 'denied';
};

export function isQuoteRateRpcMissingMessage(message: string): boolean {
  return /ff_public_qr_quote_rate_allow|does not exist|schema cache|could not find the function/i.test(
    message
  );
}

/**
 * Fail-closed: error de BD ≠ missing → denied.
 * Missing RPC (063 no aplicada) → memoria local.
 */
export async function quoteRateAllowShared(
  bucketKey: string,
  rpcAllow: (key: string) => Promise<QuoteRateRpcResult>
): Promise<QuoteRateAllowResult> {
  if (!/^[a-f0-9]{32,128}$/i.test(bucketKey)) {
    return { allowed: false, source: 'denied' };
  }

  try {
    const remote = await rpcAllow(bucketKey);
    if ('missing' in remote && remote.missing) {
      return {
        allowed: quoteRateAllowMemory(bucketKey),
        source: 'memory',
      };
    }
    if ('error' in remote && remote.error) {
      return { allowed: false, source: 'denied' };
    }
    if ('allowed' in remote) {
      return { allowed: remote.allowed, source: 'postgres' };
    }
    return { allowed: false, source: 'denied' };
  } catch {
    return { allowed: false, source: 'denied' };
  }
}
