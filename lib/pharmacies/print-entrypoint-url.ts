/**
 * URL pública para impresión / descargas de QR de farmacia.
 * Siempre dominio canónico de producción — nunca localhost ni staging.
 *
 * Constantes locales (sin imports cruzados) para que el módulo sea
 * testeable con node --experimental-strip-types.
 */

const CANONICAL_PRODUCTION_APP_URL = 'https://app.farmafacil.solutions';

function pharmacyEntrypointPath(publicId: string): string {
  const id = publicId.trim().toLowerCase();
  return `/e/${encodeURIComponent(id)}`;
}

export function pharmacyPrintPublicUrl(publicId: string): string {
  const id = publicId.trim();
  if (!id) {
    throw new Error('publicId vacío');
  }
  return `${CANONICAL_PRODUCTION_APP_URL.replace(/\/$/, '')}${pharmacyEntrypointPath(id)}`;
}

/** True si la URL es apta para cartel/impreso (canónica de producción). */
export function isPrintSafePharmacyPublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (/localhost|127\.0\.0\.1/i.test(u.hostname)) return false;
    if (/\.supabase\.co$/i.test(u.hostname)) return false;
    // Staging / previews
    if (/staging|netlify|vercel/i.test(u.hostname)) return false;
    return (
      u.origin.replace(/\/$/, '') ===
      CANONICAL_PRODUCTION_APP_URL.replace(/\/$/, '')
    );
  } catch {
    return false;
  }
}
