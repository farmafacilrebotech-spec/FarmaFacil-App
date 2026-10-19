/**
 * Normalización / validación de public_id (espejo CHECK 009 y RPC 044).
 */

/** Formato permitido por public_entrypoints_public_id_format_chk. */
export const PUBLIC_ENTRYPOINT_ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;

/**
 * Propósito del QR oficial de farmacia (DEFAULT 009 / ensure 042).
 * No inventar otros valores en la resolución pública.
 */
export const PUBLIC_PHARMACY_QR_PURPOSE = 'pharmacy_home' as const;

/**
 * Decodifica, recorta y pasa a minúsculas el segmento de URL.
 * No inventa ids: si el formato es inválido, devuelve null.
 */
export function normalizePublicEntrypointId(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    // Si ya venía decodificado o mal formado, seguir con el valor recortado.
  }
  value = value.trim().toLowerCase();
  if (!PUBLIC_ENTRYPOINT_ID_RE.test(value)) {
    return null;
  }
  return value;
}

/** Contrato mínimo de 044: status + public_id + pharmacy_name. */
export function mapResolveEntrypointRpcPayload(
  data: unknown
):
  | {
      ok: true;
      publicId: string;
      pharmacyName: string;
    }
  | { ok: false; reason: 'not_found' | 'inactive' | 'error' } {
  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'not_found') {
    return { ok: false, reason: 'not_found' };
  }
  if (status === 'inactive') {
    return { ok: false, reason: 'inactive' };
  }
  if (status !== 'ok' || !payload) {
    return { ok: false, reason: 'error' };
  }

  const publicId = String(payload.public_id ?? '');
  const pharmacyName = String(payload.pharmacy_name ?? '').trim();
  if (!publicId || !pharmacyName) {
    return { ok: false, reason: 'error' };
  }

  return {
    ok: true,
    publicId,
    pharmacyName,
  };
}
