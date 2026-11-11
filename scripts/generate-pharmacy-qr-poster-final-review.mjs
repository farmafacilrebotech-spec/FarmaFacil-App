#!/usr/bin/env node
/**
 * Cartel PDF final de revisión (tipografía + logo staging).
 * Misma zona logo/nombre/QR que la app; nombre MAYÚSCULAS + Source Sans 3 Bold.
 *
 *   node scripts/generate-pharmacy-qr-poster-final-review.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const { jsPDF } = require('jspdf');
const QRCode = require('qrcode');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STAGING = 'dazfdcjscnpfvhcyjddt';
const PROD = 'gsnohwsvjxpjfcsstnfd';
const PHARMACY_ID = '98ea2742-5b57-4271-8448-b132cae70598';
const PUBLIC_ID = '2mo6cq0yjss6ratr';
const PUBLIC_URL = `https://app.farmafacil.solutions/e/${PUBLIC_ID}`;
const TEMPLATE = resolve(ROOT, 'public/images/posters/pharmacy-qr-a4.png');
const FONT = resolve(ROOT, 'public/fonts/SourceSans3-Bold.ttf');
const OUT = resolve(ROOT, 'public/_review_clients_qr');
const DESKTOP = resolve(homedir(), 'Desktop', 'farmafacil-cartel-review');
const OUT_FILE = 'cartel-final-revision-tipografia.pdf';

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

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
  if (contrastOnWhite(primary) >= 3) {
    return { color: primary.toUpperCase(), fallback: false };
  }
  return { color: '#0B0B0B', fallback: true };
}
function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    return { width: 512, height: 512 };
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
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
    if (lines.length > LAYOUT.name.maxLines) continue;
    const lineH = ptToMm(pt) * 1.15;
    if (lines.length * lineH <= zone.h + 0.01) {
      return { lines, fontSizePt: pt, warning: null, display: text };
    }
  }
  doc.setFontSize(LAYOUT.name.minFontSizePt);
  const lines = doc
    .splitTextToSize(text, Math.max(zone.w, 1))
    .slice(0, LAYOUT.name.maxLines);
  return {
    lines,
    fontSizePt: LAYOUT.name.minFontSizePt,
    warning: 'overflow',
    display: text,
  };
}

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled'],
  { stdio: 'inherit', cwd: ROOT }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

const envPath = existsSync(resolve(ROOT, '.env.staging.local'))
  ? resolve(ROOT, '.env.staging.local')
  : resolve(ROOT, '.env.local');
const env = parseEnv(envPath);
if (!(env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGING)) {
  console.error('ABORT: not staging');
  process.exit(1);
}
if ((env.NEXT_PUBLIC_SUPABASE_URL || '').includes(PROD)) {
  console.error('ABORT: prod');
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: brand, error: brandErr } = await admin
  .from('pharmacy_branding')
  .select('logo_url,primary_color')
  .eq('pharmacy_id', PHARMACY_ID)
  .maybeSingle();
if (brandErr) throw brandErr;

const { data: ph, error: phErr } = await admin
  .from('pharmacies')
  .select('name')
  .eq('id', PHARMACY_ID)
  .maybeSingle();
if (phErr) throw phErr;

const pharmacyName = ph?.name || 'Farmacia';
const primary = brand?.primary_color || '#0D9488';
const logoUrl = brand?.logo_url || null;

let logoDataUrl = null;
let logoW = 0;
let logoH = 0;
if (logoUrl) {
  if (logoUrl.includes(PROD)) throw new Error('logo apunta a prod');
  const logoRes = await fetch(logoUrl.split('?')[0]);
  if (!logoRes.ok) throw new Error(`fetch logo ${logoRes.status}`);
  const logoBuf = Buffer.from(await logoRes.arrayBuffer());
  const size = pngSize(logoBuf);
  logoW = size.width;
  logoH = size.height;
  const ct = (logoRes.headers.get('content-type') || '').toLowerCase();
  const mime = ct.includes('jpeg') || ct.includes('jpg')
    ? 'image/jpeg'
    : 'image/png';
  logoDataUrl = `data:${mime};base64,${logoBuf.toString('base64')}`;
}

if (!existsSync(TEMPLATE) || !existsSync(FONT)) {
  throw new Error('Falta plantilla o fuente SourceSans3-Bold.ttf');
}

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
  compress: true,
});
registerFont(doc);
const bg = `data:image/png;base64,${readFileSync(TEMPLATE).toString('base64')}`;
doc.addImage(bg, 'PNG', 0, 0, PAGE.widthMm, PAGE.heightMm);

if (logoDataUrl && logoW > 0 && logoH > 0) {
  const logoBox = inset(normToMm(LAYOUT.logo.rect), LAYOUT.logo.insetRatio);
  const fitted = contain(logoW, logoH, logoBox);
  const fmt = logoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
  doc.addImage(logoDataUrl, fmt, fitted.x, fitted.y, fitted.w, fitted.h);
}

const colorRes = resolveColor(primary);
const rgb = hexToRgb(colorRes.color);
const nameBox = inset(normToMm(LAYOUT.name.rect), LAYOUT.name.insetRatio);
const fit = fitName(doc, pharmacyName, nameBox);
doc.setFont('SourceSans3', 'bold');
doc.setFontSize(fit.fontSizePt);
doc.setTextColor(rgb.r, rgb.g, rgb.b);
const lineH = ptToMm(fit.fontSizePt) * 1.15;
const blockH = fit.lines.length * lineH;
const startY =
  nameBox.y + Math.max((nameBox.h - blockH) / 2, 0) + lineH * 0.78;
doc.text(fit.lines, nameBox.x + nameBox.w / 2, startY, {
  align: 'center',
  maxWidth: nameBox.w,
});

const qr = await QRCode.toDataURL(PUBLIC_URL, {
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

mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });
const pdfBuf = Buffer.from(doc.output('arraybuffer'));
const localPath = resolve(OUT, OUT_FILE);
const desktopPath = resolve(DESKTOP, OUT_FILE);
writeFileSync(localPath, pdfBuf);
copyFileSync(localPath, desktopPath);

const report = {
  at: new Date().toISOString(),
  pharmacyId: PHARMACY_ID,
  pharmacyName,
  displayName: fit.lines.join(' / '),
  fontSizePt: fit.fontSizePt,
  nameWarning: fit.warning,
  primaryConfigured: primary,
  nameColor: colorRes.color,
  nameColorFallback: colorRes.fallback,
  usedLogo: Boolean(logoDataUrl),
  logoUrl,
  logoSizePx: logoDataUrl ? { w: logoW, h: logoH } : null,
  publicUrl: PUBLIC_URL,
  qrPayloadOk: PUBLIC_URL === `https://app.farmafacil.solutions/e/${PUBLIC_ID}`,
  desktopPath,
  localPath,
  staticUrl: `http://127.0.0.1:3023/_review_clients_qr/${OUT_FILE}`,
  saQrUrl: `http://127.0.0.1:3023/farmacias/${PHARMACY_ID}`,
  ownerQrUrl: `http://127.0.0.1:3023/f/${PHARMACY_ID}/qr`,
};
writeFileSync(
  resolve(ROOT, 'tmp/cartel-final-revision-tipografia.json'),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
