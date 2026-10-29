import type {
  CommercialQuoteStatus,
  QuoteEmailSendEntry,
  QuoteInternalMeta,
  QuoteStatusHistoryEntry,
} from './quote-types';

export function emptyQuoteInternalMeta(): QuoteInternalMeta {
  return { v: 1, history: [], emailSends: [] };
}

export function parseQuoteInternalMeta(
  raw: string | null | undefined
): QuoteInternalMeta {
  if (!raw || !raw.trim()) return emptyQuoteInternalMeta();
  try {
    const parsed = JSON.parse(raw) as Partial<QuoteInternalMeta>;
    if (!parsed || parsed.v !== 1 || typeof parsed !== 'object') {
      return emptyQuoteInternalMeta();
    }
    return {
      v: 1,
      history: Array.isArray(parsed.history)
        ? (parsed.history as QuoteStatusHistoryEntry[])
        : [],
      emailSends: Array.isArray(parsed.emailSends)
        ? (parsed.emailSends as QuoteEmailSendEntry[])
        : [],
    };
  } catch {
    return emptyQuoteInternalMeta();
  }
}

export function serializeQuoteInternalMeta(meta: QuoteInternalMeta): string {
  return JSON.stringify({
    v: 1,
    history: meta.history,
    emailSends: meta.emailSends,
  });
}

export function appendStatusHistory(
  meta: QuoteInternalMeta,
  entry: QuoteStatusHistoryEntry
): QuoteInternalMeta {
  return {
    ...meta,
    history: [...meta.history, entry],
  };
}

export function appendEmailSend(
  meta: QuoteInternalMeta,
  entry: QuoteEmailSendEntry
): QuoteInternalMeta {
  return {
    ...meta,
    emailSends: [...meta.emailSends, entry],
  };
}

const ALLOWED: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
  draft: ['sent', 'rejected', 'expired'],
  sent: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: ['expired'],
  rejected: ['draft'],
  expired: ['draft'],
};

export function canTransitionQuoteStatus(
  from: CommercialQuoteStatus,
  to: CommercialQuoteStatus
): boolean {
  if (from === to) return false;
  return (ALLOWED[from] ?? []).includes(to);
}
