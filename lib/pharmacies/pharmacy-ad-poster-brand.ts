/**
 * Constantes de campaña publicitaria (sin I/O ni path aliases — testeable en node).
 */

export const AD_POSTER_BRAND = {
  black: '#0B0B0B',
  turquoise: '#1ABBB3',
  white: '#F7F9FA',
  silver: '#C5CCD3',
} as const;

export const AD_POSTER_COPY = {
  headline: '¿Y si llevaras tu farmacia en el bolsillo?',
  pillars: 'Consulta · Pide · Recoge',
  cta: '¡Descúbrelo aquí!',
} as const;

/** Logo circular oficial FarmaFácil. */
export const AD_POSTER_FF_MARK_SRC = '/images/logos/farmafacil-mark.png';

/** Pantalla del smartphone: catálogo / búsqueda kiosko. */
export const AD_POSTER_PHONE_SCREEN_SRC = '/images/kiosk/kiosk-search.png';

export type AdPosterPageFormat = 'a4' | 'a3' | 'a5';

/**
 * Escala tipográfica/márgenes respecto a A4 (la composición A4 se escala
 * de forma uniforme; no hay rediseño por formato).
 * A3 = √2; A5 = 148/210 (ancho de página, mantiene todo dentro de 210 mm).
 */
export function adPosterScale(format: AdPosterPageFormat): number {
  if (format === 'a3') return Math.SQRT2;
  if (format === 'a5') return 148 / 210;
  return 1;
}
