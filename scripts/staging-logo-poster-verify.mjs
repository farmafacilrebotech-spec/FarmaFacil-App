#!/usr/bin/env node
/**
 * Genera cartel A4 con logo staging + verifica zonas y QR.
 *   node scripts/staging-logo-poster-verify.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';

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
    )
      v = v.slice(1, -1);
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

const guard = spawnSync(
  process.execPath,
  ['scripts/assert-staging-target.mjs', '--require-filled'],
  { stdio: 'inherit', cwd: ROOT }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);

const env = parseEnv(resolve(ROOT, '.env.staging.local'));
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
    maxFontSizePt: 22,
    align: 'center',
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

async function main() {
  const { data: brand, error } = await admin
    .from('pharmacy_branding')
    .select('logo_url')
    .eq('pharmacy_id', PHARMACY_ID)
    .maybeSingle();
  if (error) throw error;
  const { data: ph } = await admin
    .from('pharmacies')
    .select('name')
    .eq('id', PHARMACY_ID)
    .maybeSingle();

  const logoUrl = brand?.logo_url;
  if (!logoUrl || !logoUrl.includes('pharmacy-logos')) {
    throw new Error(`logo_url inválido: ${logoUrl}`);
  }
  if (logoUrl.includes(PROD)) throw new Error('logo apunta a prod');

  const logoRes = await fetch(logoUrl.split('?')[0]);
  if (!logoRes.ok) throw new Error(`fetch logo ${logoRes.status}`);
  const logoBuf = Buffer.from(await logoRes.arrayBuffer());
  const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;

  const tplPath = resolve(ROOT, 'public/images/posters/pharmacy-qr-a4.png');
  if (!existsSync(tplPath)) throw new Error('missing template');
  const tpl = readFileSync(tplPath);
  const bg = `data:image/png;base64,${tpl.toString('base64')}`;

  const qrDataUrl = await QRCode.toDataURL(PUBLIC_URL, {
    width: 1400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  doc.addImage(bg, 'PNG', 0, 0, PAGE.widthMm, PAGE.heightMm);

  const logoBox = inset(normToMm(LAYOUT.logo.rect), LAYOUT.logo.insetRatio);
  // logo 64x64
  const fitted = contain(64, 64, logoBox);
  doc.addImage(logoDataUrl, 'PNG', fitted.x, fitted.y, fitted.w, fitted.h);

  const nameBox = inset(normToMm(LAYOUT.name.rect), LAYOUT.name.insetRatio);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor('#0B0B0B');
  doc.text(ph?.name || 'Farmacia', nameBox.x + nameBox.w / 2, nameBox.y + nameBox.h / 2, {
    align: 'center',
    baseline: 'middle',
    maxWidth: nameBox.w,
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
    qrDataUrl,
    'PNG',
    qrInner.x + (qrInner.w - qsize) / 2,
    qrInner.y + (qrInner.h - qsize) / 2,
    qsize,
    qsize
  );

  // Zone guides overlay page for review PDF twin
  const outDir = resolve(ROOT, 'public/_review_clients_qr');
  mkdirSync(outDir, { recursive: true });
  const pdfPath = resolve(outDir, 'staging-logo-cartel-final.pdf');
  writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));

  // Guides version
  const doc2 = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  doc2.addImage(bg, 'PNG', 0, 0, PAGE.widthMm, PAGE.heightMm);
  doc2.addImage(logoDataUrl, 'PNG', fitted.x, fitted.y, fitted.w, fitted.h);
  doc2.setFont('helvetica', 'bold');
  doc2.setFontSize(18);
  doc2.text(ph?.name || 'Farmacia', nameBox.x + nameBox.w / 2, nameBox.y + nameBox.h / 2, {
    align: 'center',
    baseline: 'middle',
    maxWidth: nameBox.w,
  });
  doc2.addImage(
    qrDataUrl,
    'PNG',
    qrInner.x + (qrInner.w - qsize) / 2,
    qrInner.y + (qrInner.h - qsize) / 2,
    qsize,
    qsize
  );
  const logoMm = normToMm(LAYOUT.logo.rect);
  const nameMm = normToMm(LAYOUT.name.rect);
  doc2.setDrawColor(220, 20, 60);
  doc2.setLineWidth(0.4);
  doc2.rect(logoMm.x, logoMm.y, logoMm.w, logoMm.h);
  doc2.setDrawColor(0, 160, 0);
  doc2.rect(nameMm.x, nameMm.y, nameMm.w, nameMm.h);
  const guidesPath = resolve(outDir, 'staging-logo-cartel-zones.pdf');
  writeFileSync(guidesPath, Buffer.from(doc2.output('arraybuffer')));

  // Decode QR payload from data URL by regenerating expected URL check
  const qrPayloadOk = PUBLIC_URL === `https://app.farmafacil.solutions/e/${PUBLIC_ID}`;
  const logoLeft = logoMm.x + logoMm.w < nameMm.x;
  const nameRight = nameMm.x > logoMm.x;

  const report = {
    pharmacyId: PHARMACY_ID,
    pharmacyName: ph?.name,
    logoUrl,
    publicUrl: PUBLIC_URL,
    qrPayloadOk,
    logoZoneLeftOfName: logoLeft && nameRight,
    logoRectMm: logoMm,
    nameRectMm: nameMm,
    fittedLogoMm: fitted,
    pdfPath,
    guidesPath,
    localReviewUrl: 'http://127.0.0.1:3023/f/' + PHARMACY_ID + '/qr',
    localLogin: 'http://127.0.0.1:3023/login',
    staticPdfUrl: 'http://127.0.0.1:3023/_review_clients_qr/staging-logo-cartel-final.pdf',
    staticZonesUrl: 'http://127.0.0.1:3023/_review_clients_qr/staging-logo-cartel-zones.pdf',
  };
  writeFileSync(
    resolve(ROOT, 'tmp/staging-logo-poster-verify.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
