/**
 * Genera QR PNG de acceso LAN para QA móvil (staging :3070).
 * Uso: node scripts/qa-mobile-generate-qr.mjs [origin]
 */
import QRCode from 'qrcode';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const origin = (process.argv[2] || 'http://192.168.1.16:3070').replace(/\/$/, '');
const outDir = join(root, 'docs/qa-mobile/qr');
mkdirSync(outDir, { recursive: true });

const targets = [
  {
    key: 'A-staging1-generic',
    name: 'Farmacia Staging 1',
    path: '/e/91dntkqzz29hscvt',
  },
  {
    key: 'B-piloto-integral-own',
    name: 'Farmacia Piloto Integral',
    path: '/e/8132f4yiijl5igfr',
  },
  {
    key: 'C-fase7-assistant',
    name: 'TEST Fase7 QR Requests 20261021',
    path: '/e/2mo6cq0yjss6ratr',
  },
  { key: 'login-panel', name: 'Login panel', path: '/login' },
  { key: 'cuenta-cliente', name: 'Cuenta cliente', path: '/cuenta' },
];

for (const t of targets) {
  const url = `${origin}${t.path}`;
  const png = join(outDir, `qr-${t.key}.png`);
  const txt = join(outDir, `qr-${t.key}.txt`);
  await QRCode.toFile(png, url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  writeFileSync(txt, `${url}\n`);
  console.log(`${t.key}\t${url}\t${png}`);
}
