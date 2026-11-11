/**
 * Composición dinámica logo+nombre dentro de la franja superior Canva.
 * Sin I/O — testeable con node --experimental-strip-types.
 */

export type RectMm = { x: number; y: number; w: number; h: number };

export type HeaderBandConfig = {
  /** Contenedor entre las dos líneas turquesa (mm A4). */
  band: RectMm;
  padXRatio: number;
  padYMm: number;
  gapMm: number;
  nameMinFontPt: number;
  nameMaxFontPt: number;
  nameMaxFontNoLogoPt: number;
  nameMaxLines: 1 | 2;
};

export type HeaderSlots = {
  logoSlot: RectMm | null;
  nameSlot: RectMm;
  nameMaxFontPt: number;
};

function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

/** Contraste WCAG relativo frente a blanco (#FFFFFF). */
export function contrastOnWhite(hex: string): number {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (full.length !== 6 || Number.isNaN(Number.parseInt(full, 16))) {
    return 21;
  }
  const n = Number.parseInt(full, 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return 1.05 / (L + 0.05);
}

/** Color de nombre: primario si contraste ≥ 3; si no, oscuro legible. */
export function resolvePosterNameColor(
  primaryHex: string | null | undefined,
  fallback = '#0B0B0B',
  minContrast = 3
): { color: string; usedFallback: boolean } {
  const candidate = primaryHex?.trim() || '';
  if (!/^#[0-9A-Fa-f]{6}$/.test(candidate)) {
    return { color: fallback, usedFallback: true };
  }
  if (contrastOnWhite(candidate) >= minContrast) {
    return { color: candidate.toUpperCase(), usedFallback: false };
  }
  return { color: fallback, usedFallback: true };
}

/**
 * Reparte logo (arriba) y nombre (abajo) dentro del band común.
 * aspect = width/height del logo ya recortado de transparencia.
 */
export function layoutHeaderSlots(
  band: RectMm,
  opts: {
    hasLogo: boolean;
    logoAspect?: number; // w/h
    padXRatio?: number;
    padYMm?: number;
    gapMm?: number;
    nameMinFontPt?: number;
    nameMaxFontPt?: number;
    nameMaxFontNoLogoPt?: number;
    nameMaxLines?: 1 | 2;
  }
): HeaderSlots {
  const padXRatio = opts.padXRatio ?? 0.07;
  const padYMm = opts.padYMm ?? 1.2;
  const gapMm = opts.gapMm ?? 2.2;
  const nameMinFontPt = opts.nameMinFontPt ?? 9;
  const nameMaxFontPt = opts.nameMaxFontPt ?? 16;
  const nameMaxFontNoLogoPt = opts.nameMaxFontNoLogoPt ?? 20;
  const nameMaxLines = opts.nameMaxLines ?? 2;

  const padX = band.w * padXRatio;
  const inner: RectMm = {
    x: band.x + padX,
    y: band.y + padYMm,
    w: Math.max(band.w - padX * 2, 1),
    h: Math.max(band.h - padYMm * 2, 1),
  };

  if (!opts.hasLogo) {
    return {
      logoSlot: null,
      nameSlot: inner,
      nameMaxFontPt: nameMaxFontNoLogoPt,
    };
  }

  const aspect = opts.logoAspect && opts.logoAspect > 0 ? opts.logoAspect : 1;
  const nameMinH = ptToMm(nameMinFontPt) * 1.25 * nameMaxLines + 0.8;
  const logoMaxH = Math.max(inner.h - gapMm - nameMinH, inner.h * 0.35);

  let logoSlotH: number;
  if (aspect >= 1.45) {
    // Horizontal: más ancho, menos alto relativo
    logoSlotH = Math.min(logoMaxH, inner.h * 0.52);
  } else if (aspect <= 1.12) {
    // Circular / cuadrado: más alto
    logoSlotH = Math.min(logoMaxH, inner.h * 0.64);
  } else {
    logoSlotH = Math.min(logoMaxH, inner.h * 0.58);
  }

  const logoSlot: RectMm = {
    x: inner.x,
    y: inner.y,
    w: inner.w,
    h: logoSlotH,
  };

  const nameTop = logoSlot.y + logoSlot.h + gapMm;
  const nameSlot: RectMm = {
    x: inner.x,
    y: nameTop,
    w: inner.w,
    h: Math.max(inner.y + inner.h - nameTop, nameMinH * 0.8),
  };

  return { logoSlot, nameSlot, nameMaxFontPt };
}

export function containRect(
  srcW: number,
  srcH: number,
  box: RectMm
): RectMm {
  if (srcW <= 0 || srcH <= 0 || box.w <= 0 || box.h <= 0) {
    return { x: box.x, y: box.y, w: 0, h: 0 };
  }
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  };
}
