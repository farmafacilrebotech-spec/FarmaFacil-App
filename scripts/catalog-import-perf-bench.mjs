#!/usr/bin/env node
/**
 * Medición sintética CPU-local (sin BD): preview + chunking 100…20k.
 * No escribe en staging/prod. Salida JSON + markdown.
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Dynamic import of TS via strip-types is awkward from .mjs; inline lightweight clones.
function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
}
function isJunkName(name) {
  const t = String(name ?? '').trim();
  return !t || t === '0' || t === '0.0';
}

function buildSyntheticRows(n, { junkRatio = 0 } = {}) {
  const junkCount = Math.round(n * junkRatio);
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const junk = i < junkCount;
    rows.push({
      rowIndex: i + 2,
      name: junk ? '0' : `Producto sintético ${i}`,
      sku: junk ? '' : `SKU-${i}`,
      ean: junk ? '' : String(8400000000000 + i),
      category: junk ? null : 'Dermocosmética',
      sourceFamily: junk ? 'FAM' : null,
      price: 10 + (i % 50),
    });
  }
  return rows;
}

function simulatePreview(rows) {
  let emptyDiscarded = 0;
  let invalidRows = 0;
  let creates = 0;
  let pending = 0;
  const seenEan = new Set();
  let duplicatesInFile = 0;
  for (const r of rows) {
    if (isJunkName(r.name) && isBlank(r.sku) && isBlank(r.ean)) {
      emptyDiscarded += 1;
      invalidRows += 1;
      continue;
    }
    if (isJunkName(r.name)) {
      invalidRows += 1;
      continue;
    }
    if (r.ean) {
      if (seenEan.has(r.ean)) duplicatesInFile += 1;
      else seenEan.add(r.ean);
    }
    if (!r.category && r.sourceFamily) pending += 1;
    else creates += 1;
  }
  return { emptyDiscarded, invalidRows, creates, pending, duplicatesInFile };
}

function simulateBatchPlan(validCount) {
  const chunks = chunkArray(Array.from({ length: validCount }, (_, i) => i), 100);
  // Coste CPU simulado de serializar lotes (no I/O red).
  let bytes = 0;
  for (const chunk of chunks) {
    bytes += JSON.stringify(
      chunk.map((i) => ({
        pharmacy_id: '00000000-0000-4000-8000-000000000001',
        name: `Producto sintético ${i}`,
        ean: String(8400000000000 + i),
        price: 10,
        stock: 0,
        source: 'import',
      }))
    ).length;
  }
  return { batches: chunks.length, payloadBytes: bytes };
}

const sizes = [100, 1000, 2000, 5000, 10000, 20000];
const results = [];

for (const n of sizes) {
  const rows = buildSyntheticRows(n, { junkRatio: n >= 2000 ? 667 / 2000 : 0 });
  const t0 = performance.now();
  const preview = simulatePreview(rows);
  const t1 = performance.now();
  const plan = simulateBatchPlan(preview.creates + preview.pending);
  const t2 = performance.now();
  results.push({
    products: n,
    previewMs: Number((t1 - t0).toFixed(2)),
    batchPlanMs: Number((t2 - t1).toFixed(2)),
    totalCpuMs: Number((t2 - t0).toFixed(2)),
    emptyOrInvalid: preview.emptyDiscarded + preview.invalidRows,
    creates: preview.creates,
    pending: preview.pending,
    batchesOf100: plan.batches,
    payloadBytes: plan.payloadBytes,
    note:
      n === 2000
        ? 'junkRatio≈667/2000 para simular rechazo de basura del Excel original'
        : null,
  });
}

const outDir = join(root, 'docs/qa/share');
mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'PERF_CATALOG_SYNTHETIC_2026-11-24.json');
writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

const md = [
  '# Rendimiento sintético import catálogo (CPU local, sin BD)',
  '',
  `Generado: ${new Date().toISOString()}`,
  '',
  '| Productos | preview ms | plan lotes ms | total CPU ms | inválidas | creates | lotes×100 | payload bytes |',
  '|----------:|-----------:|--------------:|-------------:|----------:|--------:|----------:|--------------:|',
  ...results.map(
    (r) =>
      `| ${r.products} | ${r.previewMs} | ${r.batchPlanMs} | ${r.totalCpuMs} | ${r.emptyOrInvalid} | ${r.creates} | ${r.batchesOf100} | ${r.payloadBytes} |`
  ),
  '',
  'Notas:',
  '- Medición **local CPU** (parse/validación/planificación). No incluye latencia PostgREST/Vercel↔Supabase.',
  '- Escritura real en staging ya medida históricamente ~4,5 min (1 insert/fila); código actual usa multi-insert ×100 + lotes cliente.',
  '- **No se aplicaron migraciones 089/090** (sin BD aislada; Docker no disponible).',
  '',
].join('\n');
const mdPath = join(outDir, 'PERF_CATALOG_SYNTHETIC_2026-11-24.md');
writeFileSync(mdPath, md);
console.log(md);
console.log('Wrote', jsonPath);
console.log('Wrote', mdPath);
