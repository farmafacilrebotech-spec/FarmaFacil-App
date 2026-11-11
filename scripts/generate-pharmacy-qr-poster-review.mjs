/**
 * Genera PDF A4 real + PNG de revisión del cartel QR.
 * Uso:
 *   node scripts/generate-pharmacy-qr-poster-review.mjs
 *
 * Salida (gitignored):
 *   public/_review_clients_qr/farmafacil-cartel-qr-{publicId}.pdf
 *   public/_review_clients_qr/farmafacil-cartel-qr-{publicId}.png
 *   también copia a ~/Desktop
 */

import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { jsPDF } = require('jspdf');
const QRCode = require('qrcode');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PUBLIC_ID = process.env.POSTER_PUBLIC_ID || '2mo6cq0yjss6ratr';
const PHARMACY_NAME =
  process.env.POSTER_PHARMACY_NAME ||
  'Farmacia Fase7 Staging Clientes QR Con Nombre Muy Largo Para Probar Desbordamiento';
const PUBLIC_URL = `https://app.farmafacil.solutions/e/${PUBLIC_ID}`;

const COLORS = {
  black: [11, 11, 11],
  teal: [26, 187, 179],
  white: [255, 255, 255],
  softGray: [245, 247, 248],
  muted: [100, 116, 139],
};

const COPY = {
  headline: 'Tu farmacia, más cerca de ti',
  benefits:
    'Consulta productos, descubre promociones y realiza tus pedidos desde tu móvil',
  cta: 'ESCANEA Y DESCUBRE TU FARMACIA',
  footer: 'Con la tecnología de FarmaFácil',
};

function circularizeLogoWithPython(srcPng, outPng, size = 640) {
  const py = `
from PIL import Image, ImageDraw
src = Image.open(${JSON.stringify(srcPng)}).convert("RGBA").resize((${size}, ${size}), Image.Resampling.LANCZOS)
out = Image.new("RGBA", (${size}, ${size}), (255, 255, 255, 255))
mask = Image.new("L", (${size}, ${size}), 0)
ImageDraw.Draw(mask).ellipse((0, 0, ${size}, ${size}), fill=255)
out.paste(src, (0, 0), mask=mask)
# Aplanar a RGB blanco (jsPDF)
flat = Image.new("RGB", (${size}, ${size}), (255, 255, 255))
flat.paste(out, mask=out.split()[-1])
flat.save(${JSON.stringify(outPng)}, "PNG")
print("ok")
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`circularize failed: ${r.stderr || r.stdout}`);
  }
}

function fill(doc, x, y, w, h, rgb) {
  doc.setFillColor(...rgb);
  doc.rect(x, y, w, h, 'F');
}

async function buildPdf({ pharmacyName, publicUrl, logoPngPath }) {
  const logoBuf = await readFile(logoPngPath);
  const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 960,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const side = 16;
  const contentW = pageW - side * 2;

  fill(doc, 0, 0, pageW, pageH, COLORS.white);
  fill(doc, 0, 0, pageW, 14, COLORS.black);
  fill(doc, 0, 14, pageW, 2.5, COLORS.teal);

  let y = 26;
  const logoSize = 44;
  doc.addImage(
    logoDataUrl,
    'PNG',
    (pageW - logoSize) / 2,
    y,
    logoSize,
    logoSize,
    undefined,
    'FAST'
  );
  y += logoSize + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.black);
  const headlineLines = doc.splitTextToSize(COPY.headline, contentW);
  doc.text(headlineLines, pageW / 2, y, { align: 'center' });
  y += headlineLines.length * 9 + 5;

  doc.setFontSize(15);
  doc.setTextColor(...COLORS.teal);
  const nameLines = doc.splitTextToSize(pharmacyName.trim() || 'Farmacia', contentW);
  doc.text(nameLines, pageW / 2, y, { align: 'center' });
  y += nameLines.length * 6.5 + 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.muted);
  const benefitLines = doc.splitTextToSize(COPY.benefits, contentW * 0.92);
  doc.text(benefitLines, pageW / 2, y, { align: 'center' });
  y += benefitLines.length * 5.4 + 9;

  const qrPanelPad = 7;
  const qrSize = 108;
  const panelW = qrSize + qrPanelPad * 2;
  const panelH = qrSize + qrPanelPad * 2;
  const panelX = (pageW - panelW) / 2;
  const panelY = Math.min(Math.max(y, 112), pageH - 52 - panelH);

  fill(doc, panelX, panelY, panelW, panelH, COLORS.softGray);
  doc.setDrawColor(...COLORS.teal);
  doc.setLineWidth(0.45);
  doc.roundedRect(panelX, panelY, panelW, panelH, 3, 3, 'S');
  doc.addImage(
    qrDataUrl,
    'PNG',
    panelX + qrPanelPad,
    panelY + qrPanelPad,
    qrSize,
    qrSize,
    undefined,
    'FAST'
  );

  y = panelY + panelH + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...COLORS.black);
  doc.text(COPY.cta, pageW / 2, y, { align: 'center' });
  y += 6;
  fill(doc, (pageW - 40) / 2, y, 40, 1.3, COLORS.teal);

  fill(doc, 0, pageH - 16, pageW, 16, COLORS.black);
  fill(doc, 0, pageH - 16, pageW, 1.2, COLORS.teal);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text(COPY.footer, pageW / 2, pageH - 7, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

function pdfToPng(pdfPath, pngPath) {
  const py = `
import fitz
doc = fitz.open(${JSON.stringify(pdfPath)})
page = doc[0]
# ~150 DPI preview
pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72), alpha=False)
pix.save(${JSON.stringify(pngPath)})
print(page.rect.width, page.rect.height, pix.width, pix.height)
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`pdfToPng failed: ${r.stderr || r.stdout}`);
  }
  console.log('render:', r.stdout.trim());
}

async function main() {
  const outDir = path.join(ROOT, 'public', '_review_clients_qr');
  await mkdir(outDir, { recursive: true });

  const logoSrc = path.join(
    ROOT,
    'public/images/logos/farmafacil-logo-512.png'
  );
  const logoCircle = path.join(outDir, '_logo-circular-tmp.png');
  circularizeLogoWithPython(logoSrc, logoCircle);

  const pdfBuf = await buildPdf({
    pharmacyName: PHARMACY_NAME,
    publicUrl: PUBLIC_URL,
    logoPngPath: logoCircle,
  });

  const base = `farmafacil-cartel-qr-${PUBLIC_ID}`;
  const pdfPath = path.join(outDir, `${base}.pdf`);
  const pngPath = path.join(outDir, `${base}.png`);
  await writeFile(pdfPath, pdfBuf);
  pdfToPng(pdfPath, pngPath);

  // También un caso de nombre corto
  const shortPdf = await buildPdf({
    pharmacyName: 'Farmacia Fase7 Staging',
    publicUrl: PUBLIC_URL,
    logoPngPath: logoCircle,
  });
  await writeFile(path.join(outDir, `${base}-nombre-corto.pdf`), shortPdf);

  const desktop = path.join(os.homedir(), 'Desktop');
  let desktopPdf = null;
  let desktopPng = null;
  try {
    desktopPdf = path.join(desktop, `${base}.pdf`);
    desktopPng = path.join(desktop, `${base}-preview.png`);
    await copyFile(pdfPath, desktopPdf);
    await copyFile(pngPath, desktopPng);
  } catch (err) {
    desktopPdf = null;
    desktopPng = null;
    console.warn('Desktop copy skipped:', err?.message || err);
  }

  console.log(
    JSON.stringify(
      {
        publicUrl: PUBLIC_URL,
        pharmacyName: PHARMACY_NAME,
        pdf: pdfPath,
        png: pngPath,
        desktopPdf,
        desktopPng,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
