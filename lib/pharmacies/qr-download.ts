/**
 * Generación de artefactos QR descargables (PNG alta resolución / SVG).
 * Usa la misma URL pública oficial del entrypoint.
 */

import QRCode from 'qrcode';

export const QR_PNG_EXPORT_SIZE = 1024;

export async function buildOfficialQrPngDataUrl(
  publicUrl: string,
  size = QR_PNG_EXPORT_SIZE
): Promise<string> {
  return QRCode.toDataURL(publicUrl, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export async function buildOfficialQrSvgString(
  publicUrl: string
): Promise<string> {
  return QRCode.toString(publicUrl, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadTextFile(
  filename: string,
  contents: string,
  mime = 'image/svg+xml;charset=utf-8'
): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function officialQrFilenames(publicId: string): {
  png: string;
  svg: string;
} {
  const safe = publicId.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'farmacia';
  return {
    png: `farmafacil-qr-${safe}.png`,
    svg: `farmafacil-qr-${safe}.svg`,
  };
}
