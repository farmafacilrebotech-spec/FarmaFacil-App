#!/usr/bin/env node
/**
 * Genera PDFs de revisión tipográfica del nombre (MAYÚSCULAS + Source Sans 3).
 * No altera zonas de logo/QR.
 *
 *   node scripts/generate-pharmacy-qr-poster-name-review.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const { jsPDF } = require('jspdf');
const QRCode = require('qrcode');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPLATE = resolve(ROOT, 'public/images/posters/pharmacy-qr-a4.png');
const FONT = resolve(ROOT, 'public/fonts/SourceSans3-Bold.ttf');
const OUT = resolve(ROOT, 'public/_review_clients_qr');
const DESKTOP = resolve(homedir(), 'Desktop', 'farmafacil-cartel-review');

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
  logo: { rect: px(275, 177, 604, 610), insetRatio: 0.06 },
  name: {
    rect: px(983, 177, 3180, 623),
    insetRatio: 0.05,
    maxFontSizePt: 40,
    minFontSizePt: 14,
    maxLines: 2,
    fallbackColor: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: { rect: px(2777, 4651, 1373, 1392), quietZoneRatio: 0.04 },
};

function normToMm(n) {
  return {
    x: n.x * PAGE.widthMm,
    y: n.y * PAGE.heightMm,
    w: n.w * PAGE.widthMm,
    h: n.h * PAGE.heightMm,
  };
}
function inset(box, r) {
  const pad = Math.min(box.w, box.h) * r;
  return {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(box.w - pad * 2, 0),
    h: Math.max(box.h - pad * 2, 0),
  };
}
function ptToMm(pt) {
  return (pt * 25.4) / 72;
}
function contain(srcW, srcH, box) {
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
function contrastOnWhite(hex) {
  const raw = hex.replace('#', '');
  const n = Number.parseInt(raw, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return 1.05 / (L + 0.05);
}
function resolveColor(primary) {
  if (!primary || !/^#[0-9A-Fa-f]{6}$/.test(primary)) {
    return { color: '#0B0B0B', fallback: true };
  }
  if (contrastOnWhite(primary) >= 3) return { color: primary.toUpperCase(), fallback: false };
  return { color: '#0B0B0B', fallback: true };
}
function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function registerFont(doc) {
  const b64 = readFileSync(FONT).toString('base64');
  doc.addFileToVFS('SourceSans3-Bold.ttf', b64);
  doc.addFont('SourceSans3-Bold.ttf', 'SourceSans3', 'bold');
  doc.addFont('SourceSans3-Bold.ttf', 'SourceSans3', 'normal');
}

function fitName(doc, name, zone) {
  const text = (name.trim() || 'Farmacia').toLocaleUpperCase('es-ES');
  doc.setFont('SourceSans3', 'bold');
  for (let pt = LAYOUT.name.maxFontSizePt; pt >= LAYOUT.name.minFontSizePt; pt -= 0.5) {
    doc.setFontSize(pt);
    const lines = doc.splitTextToSize(text, Math.max(zone.w, 1));
    if (lines.length > 2) continue;
    const lineH = ptToMm(pt) * 1.15;
    if (lines.length * lineH <= zone.h + 0.01) {
      return { lines, fontSizePt: pt, warning: null };
    }
  }
  doc.setFontSize(LAYOUT.name.minFontSizePt);
  const lines = doc.splitTextToSize(text, Math.max(zone.w, 1)).slice(0, 2);
  return { lines, fontSizePt: LAYOUT.name.minFontSizePt, warning: 'overflow' };
}

function makeLogoPng() {
  // tiny blue square PNG 64x64 via zlib-less: reuse existing smoke logo if any
  try {
    return readFileSync(resolve(ROOT, 'tmp/smoke-logo.png'));
  } catch {
    // 1x1 will be replaced by solid via jsPDF - generate minimal valid via child
    const { spawnSync } = require('node:child_process');
    spawnSync(
      process.execPath,
      [
        '-e',
        `const zlib=require('zlib');const fs=require('fs');function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}return ~c>>>0;}function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}const w=64,h=64;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w;x++){const i=y*(w*4+1)+1+x*4;raw[i]=0;raw[i+1]=90;raw[i+2]=180;raw[i+3]=255;}}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/smoke-logo.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));`,
      ],
      { cwd: ROOT }
    );
    return readFileSync(resolve(ROOT, 'tmp/smoke-logo.png'));
  }
}

async function buildVariant({ name, primary, withLogo, file }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  registerFont(doc);
  const bg = `data:image/png;base64,${readFileSync(TEMPLATE).toString('base64')}`;
  doc.addImage(bg, 'PNG', 0, 0, PAGE.widthMm, PAGE.heightMm);

  if (withLogo) {
    const logoBuf = makeLogoPng();
    const logoData = `data:image/png;base64,${logoBuf.toString('base64')}`;
    const logoBox = inset(normToMm(LAYOUT.logo.rect), LAYOUT.logo.insetRatio);
    const fitted = contain(64, 64, logoBox);
    doc.addImage(logoData, 'PNG', fitted.x, fitted.y, fitted.w, fitted.h);
  }

  const colorRes = resolveColor(primary);
  const rgb = hexToRgb(colorRes.color);
  const nameBox = inset(normToMm(LAYOUT.name.rect), LAYOUT.name.insetRatio);
  const fit = fitName(doc, name, nameBox);
  doc.setFont('SourceSans3', 'bold');
  doc.setFontSize(fit.fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  const lineH = ptToMm(fit.fontSizePt) * 1.15;
  const blockH = fit.lines.length * lineH;
  const startY = nameBox.y + Math.max((nameBox.h - blockH) / 2, 0) + lineH * 0.78;
  doc.text(fit.lines, nameBox.x + nameBox.w / 2, startY, {
    align: 'center',
    maxWidth: nameBox.w,
  });

  const publicUrl = 'https://app.farmafacil.solutions/e/2mo6cq0yjss6ratr';
  const qr = await QRCode.toDataURL(publicUrl, {
    width: 1400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });
  const qrZone = normToMm(LAYOUT.qr.rect);
  const qpad = Math.min(qrZone.w, qrZone.h) * LAYOUT.qr.quietZoneRatio;
  const qrInner = {
    x: qrZone.x + qpad,
    y: qrZone.y + qpad,
    w: qrZone.w - 2 * qpad,
    h: qrZone.h - 2 * qpad,
  };
  const qsize = Math.min(qrInner.w, qrInner.h);
  doc.addImage(
    qr,
    'PNG',
    qrInner.x + (qrInner.w - qsize) / 2,
    qrInner.y + (qrInner.h - qsize) / 2,
    qsize,
    qsize
  );

  const path = resolve(OUT, file);
  writeFileSync(path, Buffer.from(doc.output('arraybuffer')));
  copyFileSync(path, resolve(DESKTOP, file));
  return {
    file,
    fontSizePt: fit.fontSizePt,
    lines: fit.lines,
    color: colorRes.color,
    colorFallback: colorRes.fallback,
    displayName: fit.lines.join(' / '),
    publicUrl,
  };
}

mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const variants = [
  {
    name: 'Farmacia Sol',
    primary: '#0B5FFF',
    withLogo: true,
    file: 'cartel-name-short-dark.pdf',
  },
  {
    name: 'Farmacia Peñíscola Ñuñez',
    primary: '#0D9488',
    withLogo: true,
    file: 'cartel-name-accents.pdf',
  },
  {
    name: 'Farmacia Comunitaria Del Barrio Norte Con Anexo Clínico Especializado',
    primary: '#111827',
    withLogo: true,
    file: 'cartel-name-long.pdf',
  },
  {
    name: 'Farmacia Alba',
    primary: '#FDE68A',
    withLogo: false,
    file: 'cartel-name-light-primary-no-logo.pdf',
  },
];

const results = [];
for (const v of variants) {
  results.push(await buildVariant(v));
}
writeFileSync(
  resolve(OUT, 'cartel-name-review.json'),
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2)
);
console.log(JSON.stringify(results, null, 2));
