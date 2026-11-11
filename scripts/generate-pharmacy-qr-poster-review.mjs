/**
 * Genera 9 variantes + comparativa del cartel Canva (descarga panel OFF).
 *
 * node scripts/generate-pharmacy-qr-poster-review.mjs
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
const TEMPLATE = path.join(ROOT, 'public/images/posters/pharmacy-qr-a4.png');
const OUT = path.join(ROOT, 'public/_review_clients_qr');
const DESKTOP = path.join(os.homedir(), 'Desktop', 'farmafacil-cartel-review');

const TEMPLATE_PX = { width: 4419, height: 6250 };
const PAGE = { widthMm: 210, heightMm: 297 };

function px(x, y, w, h) {
  return {
    x: x / TEMPLATE_PX.width,
    y: y / TEMPLATE_PX.height,
    w: w / TEMPLATE_PX.width,
    h: h / TEMPLATE_PX.height,
  };
}

/** Mismo layout que pharmacy-qr-poster-layout.ts (zonas anotación). */
const LAYOUT = {
  logo: { rect: px(275, 177, 604, 610), insetRatio: 0.06 },
  name: {
    rect: px(983, 177, 3180, 623),
    insetRatio: 0.05,
    maxFontSizePt: 22,
    minFontSizePt: 9,
    maxLines: 2,
    fallbackColor: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: { rect: px(2777, 4651, 1373, 1392), quietZoneRatio: 0.04 },
};

const PUBLIC_ID = process.env.POSTER_PUBLIC_ID || '2mo6cq0yjss6ratr';
const PUBLIC_URL = `https://app.farmafacil.solutions/e/${PUBLIC_ID}`;

function normToMm(n) {
  return {
    x: n.x * PAGE.widthMm,
    y: n.y * PAGE.heightMm,
    w: n.w * PAGE.widthMm,
    h: n.h * PAGE.heightMm,
  };
}

function containRect(srcW, srcH, box) {
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

function insetRect(box, insetRatio) {
  const pad = Math.min(box.w, box.h) * insetRatio;
  return {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(box.w - pad * 2, 0),
    h: Math.max(box.h - pad * 2, 0),
  };
}

function qrInner(zone, quiet) {
  const pad = Math.min(zone.w, zone.h) * quiet;
  const inner = {
    x: zone.x + pad,
    y: zone.y + pad,
    w: zone.w - pad * 2,
    h: zone.h - pad * 2,
  };
  const size = Math.min(inner.w, inner.h);
  return {
    x: inner.x + (inner.w - size) / 2,
    y: inner.y + (inner.h - size) / 2,
    w: size,
    h: size,
  };
}

function ptToMm(pt) {
  return (pt * 25.4) / 72;
}

function hexToRgb(hex) {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) {
    return { r: 11, g: 11, b: 11 };
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function contrastOnWhite(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return 1.05 / (L + 0.05);
}

function resolveNameColor(primaryHex, fallback = '#0B0B0B') {
  const candidate = (primaryHex || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(candidate)) {
    return { color: fallback, usedFallback: true };
  }
  if (contrastOnWhite(candidate) >= 3) {
    return { color: candidate.toUpperCase(), usedFallback: false };
  }
  return { color: fallback, usedFallback: true };
}

function fitName(doc, text, zoneMm, style) {
  const t = text.trim() || 'Farmacia';
  doc.setFont('helvetica', style.fontStyle);
  for (let pt = style.maxFontSizePt; pt >= style.minFontSizePt; pt -= 0.5) {
    doc.setFontSize(pt);
    const lines = doc.splitTextToSize(t, Math.max(zoneMm.w, 1));
    if (lines.length > style.maxLines) continue;
    const lineH = ptToMm(pt) * 1.2;
    if (lines.length * lineH <= zoneMm.h + 0.01) {
      return { fontSizePt: pt, lines, warning: null };
    }
  }
  doc.setFontSize(style.minFontSizePt);
  const lines = doc
    .splitTextToSize(t, Math.max(zoneMm.w, 1))
    .slice(0, style.maxLines);
  return {
    fontSizePt: style.minFontSizePt,
    lines,
    warning: 'Nombre demasiado largo para el tamaño mínimo legible',
  };
}

function makeSampleLogos() {
  const py = `
from PIL import Image, ImageDraw
out = ${JSON.stringify(OUT)}
# Horizontal
h = Image.new('RGBA', (640, 200), (0,0,0,0))
d = ImageDraw.Draw(h)
d.rounded_rectangle([8,40,632,160], radius=24, fill=(26,187,179,255))
d.text((40, 78), 'FARMACIA HORIZONTAL', fill=(255,255,255,255))
h.save(out + '/_sample_logo_horizontal.png')
# Circular
c = Image.new('RGBA', (400, 400), (0,0,0,0))
d = ImageDraw.Draw(c)
d.ellipse([10,10,390,390], fill=(11,11,11,255))
d.ellipse([70,70,330,330], fill=(26,187,179,255))
d.ellipse([140,140,260,260], fill=(255,255,255,255))
c.save(out + '/_sample_logo_circular.png')
# Circular con márgenes transparentes excesivos
pad = Image.new('RGBA', (800, 800), (0,0,0,0))
pad.paste(c, (200, 200), c)
pad.save(out + '/_sample_logo_padded.png')
print('logos_ok')
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}

/** Recorta márgenes transparentes si el área útil < 88% (misma regla que poster.ts). */
function trimLogoIfNeeded(logoPath) {
  const outPath = logoPath.replace(/\.png$/i, '.trimmed.png');
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(logoPath)}).convert('RGBA')
w, h = im.size
alpha = im.split()[3]
bbox = alpha.getbbox()
if not bbox:
    im.save(${JSON.stringify(outPath)})
    print(w, h, 0)
else:
    trimmed = im.crop(bbox)
    tw, th = trimmed.size
    if (tw * th) / (w * h) > 0.88:
        im.save(${JSON.stringify(outPath)})
        print(w, h, 0)
    else:
        trimmed.save(${JSON.stringify(outPath)})
        print(tw, th, 1)
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const [lw, lh, trimmed] = r.stdout.trim().split(/\s+/).map(Number);
  return { path: outPath, width: lw, height: lh, trimmed: Boolean(trimmed) };
}

async function buildPdf({ pharmacyName, logoPath, primaryColor }) {
  const bg = await readFile(TEMPLATE);
  const bgData = `data:image/png;base64,${bg.toString('base64')}`;
  const qrData = await QRCode.toDataURL(PUBLIC_URL, {
    width: 1400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addImage(bgData, 'PNG', 0, 0, PAGE.widthMm, PAGE.heightMm, undefined, 'NONE');

  let logoW = 0;
  let logoH = 0;
  let logoData = null;
  let logoTrimmed = false;
  if (logoPath) {
    const trimmed = trimLogoIfNeeded(logoPath);
    logoW = trimmed.width;
    logoH = trimmed.height;
    logoTrimmed = trimmed.trimmed;
    const buf = await readFile(trimmed.path);
    logoData = `data:image/png;base64,${buf.toString('base64')}`;
  }

  let usedLogo = false;
  if (logoData && logoW > 0 && logoH > 0) {
    const logoBox = insetRect(
      normToMm(LAYOUT.logo.rect),
      LAYOUT.logo.insetRatio
    );
    const fitted = containRect(logoW, logoH, logoBox);
    if (fitted.w > 0 && fitted.h > 0) {
      doc.addImage(
        logoData,
        'PNG',
        fitted.x,
        fitted.y,
        fitted.w,
        fitted.h,
        undefined,
        'NONE'
      );
      usedLogo = true;
    }
  }

  const colorRes = resolveNameColor(primaryColor, LAYOUT.name.fallbackColor);
  const nameBox = insetRect(
    normToMm(LAYOUT.name.rect),
    LAYOUT.name.insetRatio
  );
  const fit = fitName(doc, pharmacyName, nameBox, LAYOUT.name);
  const rgb = hexToRgb(colorRes.color);
  doc.setFont('helvetica', LAYOUT.name.fontStyle);
  doc.setFontSize(fit.fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  const lineH = ptToMm(fit.fontSizePt) * 1.2;
  const blockH = fit.lines.length * lineH;
  const startY =
    nameBox.y + Math.max((nameBox.h - blockH) / 2, 0) + lineH * 0.8;
  doc.text(fit.lines, nameBox.x + nameBox.w / 2, startY, {
    align: 'center',
    maxWidth: nameBox.w,
  });

  const qrBox = qrInner(
    normToMm(LAYOUT.qr.rect),
    LAYOUT.qr.quietZoneRatio
  );
  doc.addImage(
    qrData,
    'PNG',
    qrBox.x,
    qrBox.y,
    qrBox.w,
    qrBox.h,
    undefined,
    'NONE'
  );

  return {
    buffer: Buffer.from(doc.output('arraybuffer')),
    usedLogo,
    logoTrimmed,
    nameWarning: fit.warning,
    fontSizePt: fit.fontSizePt,
    nameColor: colorRes.color,
    nameColorFallback: colorRes.usedFallback,
  };
}

function pdfToPng(pdfPath, pngPath, dpi = 120) {
  const py = `
import fitz
doc=fitz.open(${JSON.stringify(pdfPath)})
page=doc[0]
pix=page.get_pixmap(matrix=fitz.Matrix(${dpi}/72, ${dpi}/72), alpha=False)
pix.save(${JSON.stringify(pngPath)})
print(page.rect.width, page.rect.height)
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}

function decodeQr(pngPath) {
  const py = `
import cv2
img=cv2.imread(${JSON.stringify(pngPath)})
det=cv2.QRCodeDetector()
val,_,_=det.detectAndDecode(img)
print(val or '')
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

function buildComparison(variantPngs, outPath) {
  const py = `
from PIL import Image, ImageDraw, ImageFont
import os
paths = ${JSON.stringify(variantPngs)}
labels = ${JSON.stringify(variantPngs.map((p) => path.basename(p).replace(/^cartel-/, '').replace(/\.png$/, '')))}
thumbs = []
label_h = 36
cols = 3
rows = (len(paths) + cols - 1) // cols
# load first for aspect
first = Image.open(paths[0])
tw = 420
th = int(first.height * tw / first.width)
cell_w = tw + 24
cell_h = th + label_h + 24
canvas = Image.new('RGB', (cols * cell_w, rows * cell_h), (245, 247, 248))
draw = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
except Exception:
    font = ImageFont.load_default()
for i, p in enumerate(paths):
    r, c = divmod(i, cols)
    x0 = c * cell_w + 12
    y0 = r * cell_h + 8
    draw.text((x0, y0), f"{i+1}. {labels[i]}", fill=(20,20,20), font=font)
    im = Image.open(p).convert('RGB').resize((tw, th), Image.Resampling.LANCZOS)
    canvas.paste(im, (x0, y0 + label_h))
canvas.save(${JSON.stringify(outPath)}, quality=92)
print(canvas.size[0], canvas.size[1])
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}

const SHORT = 'Farmacia Centro';
const LONG =
  'Farmacia Fase7 Staging Clientes QR Con Nombre Muy Largo';

const VARIANTS = [
  {
    id: '01-logo-circular-nombre-corto',
    name: SHORT,
    logo: '_sample_logo_circular.png',
    primaryColor: '#0B0B0B',
  },
  {
    id: '02-logo-horizontal-nombre-corto',
    name: SHORT,
    logo: '_sample_logo_horizontal.png',
    primaryColor: '#0B0B0B',
  },
  {
    id: '03-logo-circular-nombre-largo',
    name: LONG,
    logo: '_sample_logo_circular.png',
    primaryColor: '#0B0B0B',
  },
  {
    id: '04-logo-horizontal-nombre-largo',
    name: LONG,
    logo: '_sample_logo_horizontal.png',
    primaryColor: '#0B0B0B',
  },
  {
    id: '05-sin-logo-nombre-corto',
    name: SHORT,
    logo: null,
    primaryColor: '#0B0B0B',
  },
  {
    id: '06-sin-logo-nombre-largo',
    name: LONG,
    logo: null,
    primaryColor: '#0B0B0B',
  },
  {
    id: '07-logo-margenes-transparentes',
    name: SHORT,
    logo: '_sample_logo_padded.png',
    primaryColor: '#0B0B0B',
  },
  {
    id: '08-nombre-color-turquesa',
    name: SHORT,
    logo: '_sample_logo_circular.png',
    // #1ABBB3 falla contraste (~2.4); turquesa oscuro legible sobre blanco
    primaryColor: '#0D9488',
  },
  {
    id: '09-nombre-color-claro-fallback',
    name: SHORT,
    logo: '_sample_logo_circular.png',
    primaryColor: '#E8F8F7',
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(DESKTOP, { recursive: true });

  // Limpiar variantes antiguas en Desktop
  const cleanPy = `
import os, glob
d=${JSON.stringify(DESKTOP)}
for p in glob.glob(d + '/cartel-*.pdf') + glob.glob(d + '/cartel-*.png') + glob.glob(d + '/comparativa-*.png') + glob.glob(d + '/review-report.json'):
    os.remove(p)
print('cleaned')
`;
  spawnSync('python3', ['-c', cleanPy], { encoding: 'utf8' });

  makeSampleLogos();

  const summary = [];
  const pngs = [];
  for (const v of VARIANTS) {
    const logoPath = v.logo ? path.join(OUT, v.logo) : null;
    const result = await buildPdf({
      pharmacyName: v.name,
      logoPath,
      primaryColor: v.primaryColor,
    });
    const base = `cartel-${v.id}`;
    const pdfPath = path.join(OUT, `${base}.pdf`);
    const pngPath = path.join(OUT, `${base}.png`);
    await writeFile(pdfPath, result.buffer);
    pdfToPng(pdfPath, pngPath, 110);
    const qr = decodeQr(pngPath);
    await copyFile(pdfPath, path.join(DESKTOP, `${base}.pdf`));
    await copyFile(pngPath, path.join(DESKTOP, `${base}.png`));
    pngs.push(pngPath);
    summary.push({
      id: v.id,
      name: v.name,
      primaryColorRequested: v.primaryColor,
      usedLogo: result.usedLogo,
      logoTrimmed: result.logoTrimmed,
      fontSizePt: result.fontSizePt,
      nameColor: result.nameColor,
      nameColorFallback: result.nameColorFallback,
      nameWarning: result.nameWarning,
      qrDecoded: qr,
      qrOk: qr === PUBLIC_URL,
      pdf: path.join(DESKTOP, `${base}.pdf`),
      png: path.join(DESKTOP, `${base}.png`),
    });
  }

  const comparisonOut = path.join(OUT, 'comparativa-9-variantes.png');
  buildComparison(pngs, comparisonOut);
  await copyFile(
    comparisonOut,
    path.join(DESKTOP, 'comparativa-9-variantes.png')
  );
  // PDF ejemplo = variante 1
  await copyFile(
    path.join(DESKTOP, 'cartel-01-logo-circular-nombre-corto.pdf'),
    path.join(DESKTOP, 'ejemplo-cartel-a4.pdf')
  );

  const report = {
    publicUrl: PUBLIC_URL,
    publicId: PUBLIC_ID,
    template: TEMPLATE,
    templatePx: '4419×6250',
    logoRectPx: '275,177 604×610 (zona roja)',
    nameRectPx: '983,177 3180×623 (zona verde)',
    qrPx: '2777,4651 1373×1392',
    pdfDownloadEnabled: false,
    composition: 'logoRect + nameRect independientes (anotación Canva)',
    comparison: path.join(DESKTOP, 'comparativa-9-variantes.png'),
    examplePdf: path.join(DESKTOP, 'ejemplo-cartel-a4.pdf'),
    variants: summary,
  };
  await writeFile(
    path.join(OUT, 'review-report.json'),
    JSON.stringify(report, null, 2)
  );
  await copyFile(
    path.join(OUT, 'review-report.json'),
    path.join(DESKTOP, 'review-report.json')
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
