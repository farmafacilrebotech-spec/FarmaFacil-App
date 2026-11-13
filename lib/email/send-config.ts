/**
 * Configuración servidor del envío corporativo Fase B.
 * Por defecto OFF. No expone secretos al cliente.
 */

export type CorporateEmailSendMode =
  | { enabled: false; reason: 'flag_off' }
  | { enabled: true; dryRun: boolean };

/**
 * FF_CORPORATE_EMAIL_SEND_ENABLED=1|true activa el camino de envío.
 * Con send ON, dry-run es el default seguro salvo
 * FF_CORPORATE_EMAIL_DRY_RUN=0|false|no (envío real a Resend).
 */
export function getCorporateEmailSendMode(
  env: NodeJS.ProcessEnv = process.env
): CorporateEmailSendMode {
  const raw = (env.FF_CORPORATE_EMAIL_SEND_ENABLED ?? '').trim().toLowerCase();
  const enabled = raw === '1' || raw === 'true' || raw === 'yes';
  if (!enabled) {
    return { enabled: false, reason: 'flag_off' };
  }

  const dryRaw = (env.FF_CORPORATE_EMAIL_DRY_RUN ?? '').trim().toLowerCase();
  const live = dryRaw === '0' || dryRaw === 'false' || dryRaw === 'no';
  return { enabled: true, dryRun: !live };
}

export function corporateEmailSendReadiness(
  env: NodeJS.ProcessEnv = process.env
): {
  mode: CorporateEmailSendMode;
  resendConfigured: boolean;
  fromConfigured: boolean;
  fromDomain: string | null;
  missing: string[];
} {
  const mode = getCorporateEmailSendMode(env);
  const missing: string[] = [];
  const apiKey = Boolean(env.RESEND_API_KEY?.trim());
  const from = env.EMAIL_FROM?.trim() || '';
  if (!apiKey) missing.push('RESEND_API_KEY');
  if (!from) missing.push('EMAIL_FROM');
  const domain = from.match(/@([\w.-]+)/)?.[1] ?? null;
  return {
    mode,
    resendConfigured: apiKey,
    fromConfigured: Boolean(from),
    fromDomain: domain,
    missing,
  };
}
