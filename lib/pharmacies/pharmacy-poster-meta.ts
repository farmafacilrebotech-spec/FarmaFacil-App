/**
 * Metadatos de carteles PDF: nombres de archivo y marca de pruebas (staging).
 * Sin I/O ni path aliases — testeable con node --experimental-strip-types.
 */

/** Sufijo obligatorio en nombres de archivo generados desde staging (K07). */
export const STAGING_POSTER_FILENAME_TAG = 'PRUEBA-STAGING';

/** Texto de la marca de agua diagonal (solo ASCII: fuente base del PDF). */
export const STAGING_POSTER_WATERMARK_TEXT = 'PRUEBA - STAGING';

export type PosterMaterialKind =
  | 'acceso'
  | 'flyer'
  | 'pliego-flyers'
  | 'publicitario'
  | 'pack';

const UUID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * Identificador seguro para nombres de archivo.
 * Un UUID nunca se usa como nombre visible: se sustituye por «farmacia».
 */
export function posterFilenameSafeId(publicId: string | null | undefined): string {
  const raw = (publicId ?? '').trim();
  if (!raw || UUID_RE.test(raw)) return 'farmacia';
  return raw.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'farmacia';
}

/**
 * Nombre de descarga descriptivo.
 *   producción: farmafacil-cartel-acceso-a4-<id>.pdf
 *   staging:    farmafacil-cartel-acceso-a4-<id>-PRUEBA-STAGING.pdf
 * Pack: farmafacil-pack-bienvenida[-<formatoCartel>]-<id>[-PRUEBA-STAGING].pdf
 */
export function posterDownloadFilename(input: {
  kind: PosterMaterialKind;
  publicId: string | null | undefined;
  format?: string;
  staging?: boolean;
}): string {
  const id = posterFilenameSafeId(input.publicId);
  const fmt = input.format ? `-${input.format.toLowerCase()}` : '';
  const base =
    input.kind === 'pack'
      ? `farmafacil-pack-bienvenida${fmt}-${id}`
      : input.kind === 'flyer'
        ? `farmafacil-flyer${fmt}-${id}`
        : input.kind === 'pliego-flyers'
          ? `farmafacil-pliego-flyers${fmt}-${id}`
          : `farmafacil-cartel-${input.kind}${fmt}-${id}`;
  return input.staging
    ? `${base}-${STAGING_POSTER_FILENAME_TAG}.pdf`
    : `${base}.pdf`;
}

/** Título de metadatos PDF (lo usan visores y «Guardar como»). */
export function posterPdfTitle(input: {
  kind: PosterMaterialKind;
  pharmacyName: string;
  staging?: boolean;
}): string {
  const label =
    input.kind === 'acceso'
      ? 'Cartel de acceso'
      : input.kind === 'flyer'
        ? 'Flyer de acceso'
        : input.kind === 'pliego-flyers'
          ? 'Pliego de flyers'
          : input.kind === 'publicitario'
            ? 'Cartel publicitario'
            : 'Pack de bienvenida';
  const name = input.pharmacyName.trim();
  const core = name ? `FarmaFácil · ${label} · ${name}` : `FarmaFácil · ${label}`;
  return input.staging ? `${core} · ${STAGING_POSTER_FILENAME_TAG}` : core;
}
