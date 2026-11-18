#!/usr/bin/env node
/**
 * Regenera lib/commercial/quote-template-source.ts a partir de la plantilla
 * corporativa anclada (PRE-05). Sustituye el logo embebido por {{ logo_src }}.
 *
 *   node scripts/sync-quote-template-source.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(
  root,
  'docs/commercial/templates/FarmaFacil_plantilla_presupuesto.html'
);
const out = join(root, 'lib/commercial/quote-template-source.ts');

export function slimTemplate(html) {
  return html.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{100,}/g, '{{ logo_src }}');
}

const slim = slimTemplate(readFileSync(src, 'utf8'));
const lines = slim.split('\n').map((l) => `  ${JSON.stringify(l)},`);
writeFileSync(
  out,
  `/**
 * GENERADO por scripts/sync-quote-template-source.mjs — no editar a mano.
 * Origen: docs/commercial/templates/FarmaFacil_plantilla_presupuesto.html
 * (logo embebido sustituido por {{ logo_src }}). Evita fs en runtime
 * (serverless / edge / navegador).
 */
export const COMMERCIAL_QUOTE_TEMPLATE_SOURCE: string = [
${lines.join('\n')}
].join('\\n');
`
);
console.log(`OK ${out} (${slim.length} chars)`);
