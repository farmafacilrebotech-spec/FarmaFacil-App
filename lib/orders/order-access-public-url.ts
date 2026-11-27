import {
  CANONICAL_PRODUCTION_APP_URL,
  getAppBaseUrl,
} from '../auth/app-url.ts';

const STAGING_PUBLIC_APP_URL = 'https://farmafacil-staging.vercel.app';

/**
 * Base URL para QR de ticket.
 *
 * Importante: `getAppBaseUrl()` en NODE_ENV=production descarta hosts `*.vercel.app`
 * y cae al dominio canónico de producción. Si se usara primero, los QR emitidos en
 * STAGING apuntarían a `app.farmafacil.solutions/o/…` (token inexistente allí).
 * Por eso staging se resuelve **antes** que el canónico Auth.
 */
export function orderAccessPublicBaseUrl(): string {
  const env = (process.env.FF_APP_ENV ?? '').trim().toLowerCase();
  if (env === 'staging') {
    return STAGING_PUBLIC_APP_URL;
  }

  const configured = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    ''
  ).replace(/\/$/, '');
  if (configured && /farmafacil-staging/i.test(configured)) {
    return configured;
  }

  const base = getAppBaseUrl();
  if (base) return base.replace(/\/$/, '');
  return CANONICAL_PRODUCTION_APP_URL.replace(/\/$/, '');
}

export function orderAccessPublicUrl(token: string): string {
  return `${orderAccessPublicBaseUrl()}/o/${encodeURIComponent(token)}`;
}
