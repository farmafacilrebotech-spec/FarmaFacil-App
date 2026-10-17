/**
 * Construye URL SSR de callback con token_hash (sin #access_token).
 * Puro: usable en tests sin path aliases.
 */
export function buildAuthCallbackUrl(input: {
  appBaseUrl: string;
  hashedToken: string;
  otpType: string;
  nextPath: string;
}): string {
  const params = new URLSearchParams({
    token_hash: input.hashedToken,
    type: input.otpType,
    next: input.nextPath,
  });
  return `${input.appBaseUrl}/auth/callback?${params.toString()}`;
}
