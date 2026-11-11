/**
 * Genera PDFs/PNG de revisión del cartel Canva (NO activa la descarga del panel).
 *
 * Requiere:
 *   public/images/posters/pharmacy-qr-a4.png
 *   y zonas configured en pharmacy-qr-poster-layout.ts
 *
 * Uso:
 *   node scripts/generate-pharmacy-qr-poster-review.mjs
 */

import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public/images/posters/pharmacy-qr-a4.png');

async function main() {
  try {
    await access(TEMPLATE);
  } catch {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: 'missing_canva_template',
          expected: TEMPLATE,
          message:
            'Falta el PNG Canva. Colócalo en public/images/posters/pharmacy-qr-a4.png, configura las zonas en pharmacy-qr-poster-layout.ts y vuelve a ejecutar.',
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: 'zones_not_configured',
        message:
          'Plantilla encontrada, pero las coordenadas definitivas aún no están configuradas (configured:false). Mide las zonas vacías del PNG y actualiza pharmacy-qr-poster-layout.ts antes de generar ejemplos.',
        template: TEMPLATE,
      },
      null,
      2
    )
  );
  process.exit(3);
}

main();
