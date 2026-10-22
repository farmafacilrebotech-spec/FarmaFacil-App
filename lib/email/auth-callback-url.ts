/**
 * Query SSR con token_hash (sin #access_token). Puro / testeable.
 * No incluir valores en logs.
 */
export function buildAuthTokenSearchParams(input: {
  hashedToken: string;
  otpType: string;
  nextPath: string;
}): URLSearchParams {
  return new URLSearchParams({
    token_hash: input.hashedToken,
    type: input.otpType,
    next: input.nextPath,
  });
}

/**
 * Callback directo (verifyOtp en GET). Preferir buildInviteOpenUrl en emails
 * para evitar que un prefetch consuma el OTP de un solo uso.
 */
export function buildAuthCallbackUrl(input: {
  appBaseUrl: string;
  hashedToken: string;
  otpType: string;
  nextPath: string;
}): string {
  const params = buildAuthTokenSearchParams(input);
  return `${input.appBaseUrl}/auth/callback?${params.toString()}`;
}

/**
 * Landing del email: NO verifica el OTP en el GET.
 * El usuario pulsa "Continuar" → /auth/callback (un solo consumo).
 */
export function buildInviteOpenUrl(input: {
  appBaseUrl: string;
  hashedToken: string;
  otpType: string;
  nextPath: string;
}): string {
  const params = buildAuthTokenSearchParams(input);
  return `${input.appBaseUrl}/auth/invite-open?${params.toString()}`;
}
