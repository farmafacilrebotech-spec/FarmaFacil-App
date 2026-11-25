/**
 * Configuración servidor del envío corporativo Fase B.
 * Por defecto OFF. No expone secretos al cliente.
 */

import {
  isStagingAppEnv,
  isStagingHost,
} from '../env/staging-runtime-guard.ts';

export type CorporateEmailSendMode =
  | { enabled: false; reason: 'flag_off' }
  | { enabled: true; dryRun: boolean };

/** Prefijo obligatorio en envíos de prueba / staging. */
export const STAGING_EMAIL_SUBJECT_PREFIX = '[PRUEBA STAGING]';

/**
 * FF_CORPORATE_EMAIL_SEND_ENABLED=1|true activa el camino de envío.
 * Con send ON, dry-run es el default seguro salvo
 * FF_CORPORATE_EMAIL_DRY_RUN=0|false|no (envío real a Resend).
 *
 * En staging (FF_APP_ENV=staging o host staging) el dry-run sigue siendo el
 * default aunque el flag live esté mal configurado: solo
 * FF_CORPORATE_EMAIL_DRY_RUN=0 + FF_ALLOW_STAGING_LIVE_EMAIL=1 permiten live.
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
  const liveRequested = dryRaw === '0' || dryRaw === 'false' || dryRaw === 'no';
  if (!liveRequested) {
    return { enabled: true, dryRun: true };
  }

  if (isStagingEmailProtectionActive(env)) {
    const allowLive = ['1', 'true', 'yes'].includes(
      (env.FF_ALLOW_STAGING_LIVE_EMAIL ?? '').trim().toLowerCase()
    );
    if (!allowLive) {
      return { enabled: true, dryRun: true };
    }
  }

  return { enabled: true, dryRun: false };
}

/** Staging app env, host Vercel staging, o URL pública de staging. */
export function isStagingEmailProtectionActive(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (isStagingAppEnv(env)) return true;
  const vercelUrl = (env.VERCEL_URL ?? '').toLowerCase();
  if (isStagingHost(vercelUrl)) return true;
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? env.FF_PUBLIC_APP_URL ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '');
  if (isStagingHost(appUrl.split('/')[0] ?? '')) return true;
  return ['1', 'true', 'yes'].includes(
    (env.FF_FORCE_STAGING_EMAIL_PREFIX ?? '').trim().toLowerCase()
  );
}

/**
 * Asegura el prefijo [PRUEBA STAGING] en asuntos de prueba/staging.
 * Idempotente si ya está presente (también acepta legado [PRUEBA]).
 */
export function applyStagingEmailSubjectPrefix(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const trimmed = (subject ?? '').trim();
  if (!isStagingEmailProtectionActive(env)) {
    return trimmed;
  }
  if (/^\[PRUEBA STAGING\]/i.test(trimmed)) return trimmed;
  if (/^\[PRUEBA\]/i.test(trimmed)) {
    return `${STAGING_EMAIL_SUBJECT_PREFIX}${trimmed.replace(/^\[PRUEBA\]/i, '')}`;
  }
  return `${STAGING_EMAIL_SUBJECT_PREFIX} ${trimmed || 'Comunicación FarmaFácil'}`.trim();
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
