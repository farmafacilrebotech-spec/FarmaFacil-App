/**
 * Parse/encode de cookie kiosko sin dependencia de next/headers (testeable).
 */

export function encodeKioskSessionCookie(
  sessionId: string,
  credential: string
): string {
  return `v1.${sessionId}.${credential}`;
}

export function parseKioskSessionCookie(
  raw: string | undefined | null
): { sessionId: string; credential: string } | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length < 3) return null;
  if (parts[0] !== 'v1') return null;
  const sessionId = parts[1] ?? '';
  const credential = parts.slice(2).join('.');
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  if (!credential || credential.length < 16) return null;
  return { sessionId, credential };
}
