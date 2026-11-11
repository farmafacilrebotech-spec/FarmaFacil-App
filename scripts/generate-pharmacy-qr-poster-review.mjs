/**
 * Genera PDFs/PNG de revisión del cartel Canva (no activa descarga del panel).
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

const LAYOUT = {
  logo: px(549, 171, 3320, 317),
  name: px(305, 513, 3809, 293),
  nameNoLogo: px(305, 195, 3809, 610),
  qr: px(2777, 4651, 1373, 1392),
  quietZoneRatio: 0.04,
  nameStyle: {
    maxFontSizePt: 18,
    minFontSizePt: 9,
    maxLines: 2,
    color: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
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
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
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
from PIL import Image, ImageDraw, ImageFont
out = ${JSON.stringify(OUT)}
# Horizontal logo
h = Image.new('RGBA', (640, 200), (0,0,0,0))
d = ImageDraw.Draw(h)
d.rounded_rectangle([8,40,632,160], radius=24, fill=(26,187,179,255))
d.text((40, 78), 'FARMACIA HORIZONTAL', fill=(255,255,255,255))
h.save(out + '/_sample_logo_horizontal.png')
# Circular logo
c = Image.new('RGBA', (400, 400), (0,0,0,0))
d = ImageDraw.Draw(c)
d.ellipse([10,10,390,390], fill=(11,11,11,255))
d.ellipse([70,70,330,330], fill=(26,187,179,255))
d.ellipse([140,140,260,260], fill=(255,255,255,255))
c.save(out + '/_sample_logo_circular.png')
print('logos_ok')
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}

async function buildPdf({ pharmacyName, logoPath }) {
  const bg = await readFile(TEMPLATE);
  const bgData = `data:image/png;base64,${bg.toString('base64')}`;
  const qrData = await QRCode.toDataURL(PUBLIC_URL, {
    width: 1200,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addImage(bgData, 'PNG', 0, 0, PAGE.widthMm, PAGE.heightMm, undefined, 'FAST');

  let usedLogo = false;
  if (logoPath) {
    const logoBuf = await readFile(logoPath);
    const logoData = `data:image/png;base64,${logoBuf.toString('base64')}`;
    // dimensions via python
    const dim = spawnSync(
      'python3',
      [
        '-c',
        `from PIL import Image; im=Image.open(${JSON.stringify(logoPath)}); print(im.size[0], im.size[1])`,
      ],
      { encoding: 'utf8' }
    );
    const [lw, lh] = dim.stdout.trim().split(/\s+/).map(Number);
    const box = normToMm(LAYOUT.logo);
    const fitted = containRect(lw, lh, box);
    doc.addImage(
      logoData,
      'PNG',
      fitted.x,
      fitted.y,
      fitted.w,
      fitted.h,
      undefined,
      'FAST'
    );
    usedLogo = true;
  }

  const nameZone = normToMm(usedLogo ? LAYOUT.name : LAYOUT.nameNoLogo);
  const fit = fitName(doc, pharmacyName, nameZone, LAYOUT.nameStyle);
  const rgb = hexToRgb(LAYOUT.nameStyle.color);
  doc.setFont('helvetica', LAYOUT.nameStyle.fontStyle);
  doc.setFontSize(fit.fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  const lineH = ptToMm(fit.fontSizePt) * 1.2;
  const blockH = fit.lines.length * lineH;
  const startY =
    nameZone.y + Math.max((nameZone.h - blockH) / 2, 0) + lineH * 0.8;
  doc.text(fit.lines, nameZone.x + nameZone.w / 2, startY, {
    align: 'center',
    maxWidth: nameZone.w,
  });

  const qrBox = qrInner(normToMm(LAYOUT.qr), LAYOUT.quietZoneRatio);
  doc.addImage(
    qrData,
    'PNG',
    qrBox.x,
    qrBox.y,
    qrBox.w,
    qrBox.h,
    undefined,
    'FAST'
  );

  return {
    buffer: Buffer.from(doc.output('arraybuffer')),
    usedLogo,
    nameWarning: fit.warning,
    fontSizePt: fit.fontSizePt,
  };
}

function pdfToPng(pdfPath, pngPath) {
  const py = `
import fitz
doc=fitz.open(${JSON.stringify(pdfPath)})
page=doc[0]
pix=page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72), alpha=False)
pix.save(${JSON.stringify(pngPath)})
print(page.rect.width, page.rect.height)
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}

function decodeQr(pngPath) {
  const py = `
import fitz, cv2
# Prefer decoding from the PDF render already saved
img=cv2.imread(${JSON.stringify(pngPath)})
det=cv2.QRCodeDetector()
val,_,_=det.detectAndDecode(img)
print(val or '')
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

const VARIANTS = [
  {
    id: 'logo-horizontal-nombre-corto',
    name: 'Farmacia Centro',
    logo: '_sample_logo_horizontal.png',
  },
  {
    id: 'logo-circular-nombre-corto',
    name: 'Farmacia Centro',
    logo: '_sample_logo_circular.png',
  },
  {
    id: 'sin-logo-nombre-corto',
    name: 'Farmacia Centro',
    logo: null,
  },
  {
    id: 'logo-circular-nombre-largo',
    name: 'Farmacia Fase7 Staging Clientes QR Con Nombre Muy Largo',
    logo: '_sample_logo_circular.png',
  },
  {
    id: 'sin-logo-nombre-largo',
    name: 'Farmacia Fase7 Staging Clientes QR Con Nombre Muy Largo',
    logo: null,
  },
  {
    id: 'logo-horizontal-nombre-extremo',
    name: 'Farmacia Supercalifragilisticaespialidosa Del Barrio Norte Este Oeste Con Anexo Clínico Especializado',
    logo: '_sample_logo_horizontal.png',
  },
  {
    id: 'staging-fase7-real-publicid',
    name: 'Farmacia Fase7 Staging',
    logo: '_sample_logo_circular.png',
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(DESKTOP, { recursive: true });
  makeSampleLogos();

  const summary = [];
  for (const v of VARIANTS) {
    const logoPath = v.logo ? path.join(OUT, v.logo) : null;
    const result = await buildPdf({
      pharmacyName: v.name,
      logoPath,
    });
    const base = `cartel-${v.id}`;
    const pdfPath = path.join(OUT, `${base}.pdf`);
    const pngPath = path.join(OUT, `${base}.png`);
    await writeFile(pdfPath, result.buffer);
    pdfToPng(pdfPath, pngPath);
    const qr = decodeQr(pngPath);
    await copyFile(pdfPath, path.join(DESKTOP, `${base}.pdf`));
    await copyFile(pngPath, path.join(DESKTOP, `${base}.png`));
    summary.push({
      id: v.id,
      name: v.name,
      usedLogo: result.usedLogo,
      fontSizePt: result.fontSizePt,
      nameWarning: result.nameWarning,
      qrDecoded: qr,
      qrOk: qr === PUBLIC_URL,
      pdf: pdfPath,
      png: pngPath,
      desktop: path.join(DESKTOP, `${base}.pdf`),
    });
  }

  const report = {
    publicUrl: PUBLIC_URL,
    publicId: PUBLIC_ID,
    template: TEMPLATE,
    layoutPx: {
      logo: '549,171 3320×317',
      name: '305,513 3809×293',
      nameNoLogo: '305,195 3809×610',
      qrInner: '2777,4651 1373×1392',
      templatePx: '4419×6250',
    },
    pdfDownloadEnabled: false,
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
