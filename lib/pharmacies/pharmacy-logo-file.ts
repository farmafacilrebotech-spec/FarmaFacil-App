/**
 * Validación de archivos de logo de farmacia (sin I/O de Storage).
 * PNG / JPEG / WebP. Sin SVG (falta sanitización segura).
 */

export const PHARMACY_LOGO_BUCKET = 'pharmacy-logos';
export const PHARMACY_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const PHARMACY_LOGO_MIN_EDGE = 32;
export const PHARMACY_LOGO_MAX_EDGE = 4096;

export const PHARMACY_LOGO_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type PharmacyLogoMime = (typeof PHARMACY_LOGO_ALLOWED_MIME)[number];

export type PharmacyLogoProbe = {
  mime: PharmacyLogoMime;
  extension: 'png' | 'jpg' | 'webp';
  width: number;
  height: number;
};

function readU32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset]! << 24) |
      (buf[offset + 1]! << 16) |
      (buf[offset + 2]! << 8) |
      buf[offset + 3]!) >>>
    0
  );
}

function readU16LE(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function readU24LE(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16);
}

function isPng(buf: Uint8Array): boolean {
  return (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function isJpeg(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8;
}

function isWebp(buf: Uint8Array): boolean {
  return (
    buf.length >= 16 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  );
}

function pngSize(buf: Uint8Array): { width: number; height: number } | null {
  // IHDR starts at byte 16
  if (buf.length < 24) return null;
  return {
    width: readU32BE(buf, 16),
    height: readU32BE(buf, 20),
  };
}

function jpegSize(buf: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (buf[offset + 2]! << 8) | buf[offset + 3]!;
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 8 < buf.length) {
      const height = (buf[offset + 5]! << 8) | buf[offset + 6]!;
      const width = (buf[offset + 7]! << 8) | buf[offset + 8]!;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(buf: Uint8Array): { width: number; height: number } | null {
  // VP8X
  if (
    buf.length >= 30 &&
    buf[12] === 0x56 &&
    buf[13] === 0x50 &&
    buf[14] === 0x38 &&
    buf[15] === 0x58
  ) {
    const width = 1 + readU24LE(buf, 24);
    const height = 1 + readU24LE(buf, 27);
    return { width, height };
  }
  // VP8 (lossy)
  if (
    buf.length >= 30 &&
    buf[12] === 0x56 &&
    buf[13] === 0x50 &&
    buf[14] === 0x38 &&
    buf[15] === 0x20
  ) {
    const width = readU16LE(buf, 26) & 0x3fff;
    const height = readU16LE(buf, 28) & 0x3fff;
    return { width, height };
  }
  // VP8L (lossless)
  if (
    buf.length >= 25 &&
    buf[12] === 0x56 &&
    buf[13] === 0x50 &&
    buf[14] === 0x38 &&
    buf[15] === 0x4c
  ) {
    const b0 = buf[21]!;
    const b1 = buf[22]!;
    const b2 = buf[23]!;
    const b3 = buf[24]!;
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

/** Detecta tipo real por magic bytes + dimensiones. */
export function probePharmacyLogoBuffer(
  buf: Uint8Array
):
  | { ok: true; probe: PharmacyLogoProbe }
  | { ok: false; error: string } {
  if (buf.byteLength === 0) {
    return { ok: false, error: 'El archivo está vacío.' };
  }
  if (buf.byteLength > PHARMACY_LOGO_MAX_BYTES) {
    return {
      ok: false,
      error: 'El logo no puede superar 2 MB.',
    };
  }

  // SVG / XML → rechazar
  const head = new TextDecoder()
    .decode(buf.slice(0, 64))
    .trimStart()
    .toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return {
      ok: false,
      error: 'SVG no está permitido. Usa PNG, JPG o WebP.',
    };
  }

  let mime: PharmacyLogoMime | null = null;
  let extension: PharmacyLogoProbe['extension'] | null = null;
  let size: { width: number; height: number } | null = null;

  if (isPng(buf)) {
    mime = 'image/png';
    extension = 'png';
    size = pngSize(buf);
  } else if (isJpeg(buf)) {
    mime = 'image/jpeg';
    extension = 'jpg';
    size = jpegSize(buf);
  } else if (isWebp(buf)) {
    mime = 'image/webp';
    extension = 'webp';
    size = webpSize(buf);
  } else {
    return {
      ok: false,
      error: 'Formato no válido. Solo PNG, JPG o WebP.',
    };
  }

  if (!size || size.width < 1 || size.height < 1) {
    return { ok: false, error: 'No se han podido leer las dimensiones del logo.' };
  }
  if (
    size.width < PHARMACY_LOGO_MIN_EDGE ||
    size.height < PHARMACY_LOGO_MIN_EDGE
  ) {
    return {
      ok: false,
      error: `El logo debe medir al menos ${PHARMACY_LOGO_MIN_EDGE}×${PHARMACY_LOGO_MIN_EDGE} px.`,
    };
  }
  if (
    size.width > PHARMACY_LOGO_MAX_EDGE ||
    size.height > PHARMACY_LOGO_MAX_EDGE
  ) {
    return {
      ok: false,
      error: `El logo no puede superar ${PHARMACY_LOGO_MAX_EDGE} px por lado.`,
    };
  }

  return {
    ok: true,
    probe: {
      mime,
      extension,
      width: size.width,
      height: size.height,
    },
  };
}

export function pharmacyLogoObjectPath(
  pharmacyId: string,
  extension: PharmacyLogoProbe['extension']
): string {
  const id = pharmacyId.trim().toLowerCase();
  return `${id}/logo.${extension}`;
}

/** Predicado de rol tenant (UI). SuperAdmin se gestiona por permiso de plataforma. */
export function roleCanManagePharmacyLogo(roleKey: string): boolean {
  const k = String(roleKey);
  return k === 'PHARMACY_OWNER' || k === 'PHARMACY_ADMIN';
}
