/** Redacción de secretos de presupuesto (pure; sin Next). */

export function redactQuoteSecrets(message: string): string {
  return message
    .replace(/\/q\/[A-Za-z0-9_-]{20,}/g, '/q/[redacted]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]');
}
