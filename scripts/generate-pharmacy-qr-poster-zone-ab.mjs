/**
 * Comparativa A/B de zonas del cartel (guías vs limpio).
 * Usa logoRect / nameRect independientes medidos de la anotación.
 *
 * node scripts/generate-pharmacy-qr-poster-zone-ab.mjs
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
    color: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: { rect: px(2777, 4651, 1373, 1392), quietZoneRatio: 0.04 },
};

const PUBLIC_ID = process.env.POSTER_PUBLIC_ID || '2mo6cq0yjss6ratr';
const PUBLIC_URL = `https://app.farmafacil.solutions/e/${PUBLIC_ID}`;
const NAME = 'Farmacia Centro';

function normToMm(n) {
  return {
    x: n.x * PAGE.widthMm,
    y: n.y * PAGE.heightMm,
    w: n.w * PAGE.widthMm,
    h: n.h * PAGE.heightMm,
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
      return { fontSizePt: pt, lines };
    }
  }
  doc.setFontSize(style.minFontSizePt);
  return {
    fontSizePt: style.minFontSizePt,
    lines: doc
      .splitTextToSize(t, Math.max(zoneMm.w, 1))
      .slice(0, style.maxLines),
  };
}

function makeCircularLogo() {
  const logoPath = path.join(OUT, '_sample_logo_circular.png');
  const py = `
from PIL import Image, ImageDraw
c = Image.new('RGBA', (400, 400), (0,0,0,0))
d = ImageDraw.Draw(c)
d.ellipse([10,10,390,390], fill=(11,11,11,255))
d.ellipse([70,70,330,330], fill=(26,187,179,255))
d.ellipse([140,140,260,260], fill=(255,255,255,255))
c.save(${JSON.stringify(logoPath)})
print('ok')
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return logoPath;
}

async function buildPdf({ logoPath, showGuides }) {
  const bg = await readFile(TEMPLATE);
  const bgData = `data:image/png;base64,${bg.toString('base64')}`;
  const qrData = await QRCode.toDataURL(PUBLIC_URL, {
    width: 1400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addImage(
    bgData,
    'PNG',
    0,
    0,
    PAGE.widthMm,
    PAGE.heightMm,
    undefined,
    'NONE'
  );

  if (logoPath) {
    const logoBuf = await readFile(logoPath);
    const logoData = `data:image/png;base64,${logoBuf.toString('base64')}`;
    const dim = spawnSync(
      'python3',
      [
        '-c',
        `from PIL import Image; im=Image.open(${JSON.stringify(logoPath)}); print(im.size[0], im.size[1])`,
      ],
      { encoding: 'utf8' }
    );
    const [lw, lh] = dim.stdout.trim().split(/\s+/).map(Number);
    const box = insetRect(normToMm(LAYOUT.logo.rect), LAYOUT.logo.insetRatio);
    const fitted = containRect(lw, lh, box);
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
  }

  const nameBox = insetRect(normToMm(LAYOUT.name.rect), LAYOUT.name.insetRatio);
  const fit = fitName(doc, NAME, nameBox, LAYOUT.name);
  const rgb = hexToRgb(LAYOUT.name.color);
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

  const qrBox = qrInner(normToMm(LAYOUT.qr.rect), LAYOUT.qr.quietZoneRatio);
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

  if (showGuides) {
    const logo = normToMm(LAYOUT.logo.rect);
    const name = normToMm(LAYOUT.name.rect);
    doc.setDrawColor(220, 20, 20);
    doc.setLineWidth(0.4);
    doc.rect(logo.x, logo.y, logo.w, logo.h);
    doc.setDrawColor(20, 160, 40);
    doc.rect(name.x, name.y, name.w, name.h);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function pdfToPng(pdfPath, pngPath, dpi = 130) {
  const py = `
import fitz
doc=fitz.open(${JSON.stringify(pdfPath)})
page=doc[0]
pix=page.get_pixmap(matrix=fitz.Matrix(${dpi}/72, ${dpi}/72), alpha=False)
pix.save(${JSON.stringify(pngPath)})
print('ok')
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}

function buildSideBySide(aPath, bPath, outPath) {
  const py = `
from PIL import Image, ImageDraw, ImageFont
a=Image.open(${JSON.stringify(aPath)}).convert('RGB')
b=Image.open(${JSON.stringify(bPath)}).convert('RGB')
tw=460
th=int(a.height*tw/a.width)
a=a.resize((tw,th), Image.Resampling.LANCZOS)
b=b.resize((tw,th), Image.Resampling.LANCZOS)
label_h=40
gap=24
canvas=Image.new('RGB', (tw*2+gap+48, th+label_h+32), (245,247,248))
d=ImageDraw.Draw(canvas)
try:
    font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
except Exception:
    font=ImageFont.load_default()
d.text((24, 10), 'A — Guías rojo/verde + elementos', fill=(20,20,20), font=font)
d.text((24+tw+gap, 10), 'B — Limpio (sin guías)', fill=(20,20,20), font=font)
canvas.paste(a, (24, label_h))
canvas.paste(b, (24+tw+gap, label_h))
canvas.save(${JSON.stringify(outPath)}, quality=93)
print(canvas.size)
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(DESKTOP, { recursive: true });
  const logoPath = makeCircularLogo();

  const variants = [
    { id: 'A-guias', showGuides: true },
    { id: 'B-limpio', showGuides: false },
  ];
  const pngs = {};
  for (const v of variants) {
    const buf = await buildPdf({ logoPath, showGuides: v.showGuides });
    const pdfPath = path.join(OUT, `zona-${v.id}.pdf`);
    const pngPath = path.join(OUT, `zona-${v.id}.png`);
    await writeFile(pdfPath, buf);
    pdfToPng(pdfPath, pngPath);
    await copyFile(pdfPath, path.join(DESKTOP, `zona-${v.id}.pdf`));
    await copyFile(pngPath, path.join(DESKTOP, `zona-${v.id}.png`));
    pngs[v.id] = pngPath;
  }

  const compareOut = path.join(OUT, 'comparativa-zonas-AB.png');
  buildSideBySide(pngs['A-guias'], pngs['B-limpio'], compareOut);
  await copyFile(compareOut, path.join(DESKTOP, 'comparativa-zonas-AB.png'));

  const report = {
    publicUrl: PUBLIC_URL,
    templatePx: '4419×6250',
    logoRectPx: '275,177 604×610 (zona roja)',
    nameRectPx: '983,177 3180×623 (zona verde)',
    measuredFrom:
      'anotación 724×1024 → escala 6.1036 (teal y≈122 / 861)',
    pdfDownloadEnabled: false,
    comparison: path.join(DESKTOP, 'comparativa-zonas-AB.png'),
    a: path.join(DESKTOP, 'zona-A-guias.png'),
    b: path.join(DESKTOP, 'zona-B-limpio.png'),
  };
  await writeFile(
    path.join(OUT, 'zone-ab-report.json'),
    JSON.stringify(report, null, 2)
  );
  await copyFile(
    path.join(OUT, 'zone-ab-report.json'),
    path.join(DESKTOP, 'zone-ab-report.json')
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
