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

export type AdPosterPageFormat = 'a4' | 'a3';

/** Escala tipográfica/márgenes A3 respecto a A4. */
export function adPosterScale(format: AdPosterPageFormat): number {
  return format === 'a3' ? Math.SQRT2 : 1;
}
