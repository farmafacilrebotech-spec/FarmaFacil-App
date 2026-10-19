/**
 * URL pública codificada en el QR de farmacia (public_entrypoints.public_id).
 * No autentica: la ruta /e/[publicId] es informativa / futura puerta de cliente.
 */

import {
  CANONICAL_PRODUCTION_APP_URL,
  getAppBaseUrl,
} from '@/lib/auth/app-url';
import { pharmacyEntrypointPath } from '@/lib/kiosk/entrypoint-path';

export { pharmacyEntrypointPath };

export function pharmacyEntrypointPublicUrl(publicId: string): string {
  const base =
    getAppBaseUrl() ??
    (process.env.NODE_ENV === 'production'
      ? CANONICAL_PRODUCTION_APP_URL
      : 'http://localhost:3000');
  return `${base.replace(/\/$/, '')}${pharmacyEntrypointPath(publicId)}`;
}
