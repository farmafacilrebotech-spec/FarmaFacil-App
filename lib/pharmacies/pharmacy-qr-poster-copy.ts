/**
 * Copy e identidad visual del cartel QR A4.
 * Sin dependencias — testeable con node --experimental-strip-types.
 */

/** Identidad visual del cartel (aprobada). */
export const POSTER_COLORS = {
  black: { r: 11, g: 11, b: 11 }, // #0B0B0B
  teal: { r: 26, g: 187, b: 179 }, // #1ABBB3
  white: { r: 255, g: 255, b: 255 },
  softGray: { r: 245, g: 247, b: 248 }, // #F5F7F8
  muted: { r: 100, g: 116, b: 139 },
} as const;

export const POSTER_COPY = {
  headline: 'Tu farmacia, más cerca de ti',
  benefits:
    'Consulta productos, descubre promociones y realiza tus pedidos desde tu móvil',
  cta: 'ESCANEA Y DESCUBRE TU FARMACIA',
  footer: 'Con la tecnología de FarmaFácil',
} as const;
