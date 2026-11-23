#!/usr/bin/env node
/**
 * QA 2026-11-23 · Bloque 2.2 — Catálogo propio de muestra para "Farmacia Piloto Integral" (STAGING).
 *
 *   node scripts/staging-seed-piloto-integral-catalog.mjs --dry-run
 *   node scripts/staging-seed-piloto-integral-catalog.mjs --apply
 *
 * Guardrails:
 *  - Aborta si NEXT_PUBLIC_SUPABASE_URL de .env.staging.local no es dazfdcjscnpfvhcyjddt
 *    (o contiene el ref de producción).
 *  - Solo toca la farmacia f55f94af-... (verifica nombre y catalog_mode=own).
 *  - SOLO INSERTA filas nuevas source='manual' (source_ref `qa_piloto_integral_v1:<sku>`).
 *    No actualiza ni borra nada: los triggers `pharmacy_products_guard_generic` (054) y
 *    `pharmacy_products_enforce_catalog_write` (074) bloquean UPDATE con service_role
 *    (auth.uid() NULL → sin permiso de plataforma/catálogo) y las 100 filas `generic`
 *    del maestro son de solo lectura para farmacia. Idempotente: si el source_ref existe, se omite.
 *  - No imprime secretos.
 *
 * Estados resultantes (UI kiosko/cliente: available = status != confirm && stock > 0):
 *   - disponible        → availability_status=available, stock>0
 *   - agotado           → availability_status=available, stock=0
 *   - confirmar         → availability_status=confirm_with_pharmacy
 *   - no disponible     → availability_status=unavailable
 *
 * Todos los datos son FICTICIOS (parafarmacia, sin medicamentos, EAN con prefijo de uso interno 29).
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGING_REF = 'dazfdcjscnpfvhcyjddt';
const PROD_REF = 'gsnohwsvjxpjfcsstnfd';
const PHARMACY_ID = 'f55f94af-2d0f-424b-81d3-a4f687abd495';
const SOURCE_REF_PREFIX = 'qa_piloto_integral_v1:';

const apply = process.argv.includes('--apply');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const o = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    o[t.slice(0, i).trim()] = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return o;
}

const env = loadEnv(resolve(root, '.env.staging.local'));
const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url.includes(STAGING_REF) || url.includes(PROD_REF)) {
  console.error('ABORT: URL no es staging', STAGING_REF);
  process.exit(2);
}
if (!key) {
  console.error('ABORT: falta SUPABASE_SERVICE_ROLE_KEY en .env.staging.local');
  process.exit(2);
}

/** EAN-13 válido a partir de 12 dígitos. */
function ean13(base12) {
  const d = base12.split('').map(Number);
  const sum = d.reduce((a, n, i) => a + n * (i % 2 === 0 ? 1 : 3), 0);
  return base12 + String((10 - (sum % 10)) % 10);
}

// [sku, name, brand, category, price, stock, min_stock, availability_status]
const ROWS = [
  // --- Disponibles (stock > 0), precios variados ---
  ['PI-QA-001', 'Gel de ducha hidratante 500 ml (QA)', 'QA Labs', 'Higiene corporal', 4.95, 42, 10, 'available'],
  ['PI-QA-002', 'Champú suave uso diario 400 ml (QA)', 'QA Labs', 'Cuidado capilar', 5.5, 35, 8, 'available'],
  ['PI-QA-003', 'Crema de manos reparadora 75 ml (QA)', 'QA Labs', 'Cuidado corporal', 3.8, 60, 12, 'available'],
  ['PI-QA-004', 'Protector solar facial SPF50 50 ml (QA)', 'Solaria Test', 'Fotoprotección', 18.9, 24, 6, 'available'],
  ['PI-QA-005', 'Hidratante facial piel sensible 50 ml (QA)', 'Dermo Test', 'Cuidado facial', 14.25, 18, 5, 'available'],
  ['PI-QA-006', 'Agua micelar 400 ml (QA)', 'Dermo Test', 'Cuidado facial', 7.9, 30, 8, 'available'],
  ['PI-QA-007', 'Pasta dental blanqueante 100 ml (QA)', 'Sonrisa QA', 'Higiene bucal', 3.45, 80, 20, 'available'],
  ['PI-QA-008', 'Cepillo dental medio pack 2 (QA)', 'Sonrisa QA', 'Higiene bucal', 2.9, 55, 15, 'available'],
  ['PI-QA-009', 'Apósitos surtidos caja 20 uds (QA)', 'CuraFácil Test', 'Primeros auxilios', 2.65, 70, 15, 'available'],
  ['PI-QA-010', 'Gasas estériles 10 uds (QA)', 'CuraFácil Test', 'Primeros auxilios', 1.8, 90, 20, 'available'],
  ['PI-QA-011', 'Termómetro digital (QA)', 'CuraFácil Test', 'Material sanitario', 9.99, 14, 4, 'available'],
  ['PI-QA-012', 'Suero fisiológico monodosis 30 uds (QA)', 'CuraFácil Test', 'Primeros auxilios', 4.1, 40, 10, 'available'],
  ['PI-QA-013', 'Gel hidroalcohólico 250 ml (QA)', 'QA Labs', 'Higiene', 2.5, 100, 25, 'available'],
  ['PI-QA-014', 'Repelente de insectos adultos 100 ml (QA)', 'Solaria Test', 'Cuidado estacional', 8.75, 16, 5, 'available'],
  ['PI-QA-015', 'Barrita energética sabor avellana (QA)', 'Vita Test', 'Nutrición', 1.95, 120, 30, 'available'],
  ['PI-QA-016', 'Complemento vitamina C efervescente 20 uds (QA)', 'Vita Test', 'Complementos', 6.2, 28, 8, 'available'],
  ['PI-QA-017', 'Bálsamo labial hidratante (QA)', 'Dermo Test', 'Cuidado facial', 2.35, 65, 15, 'available'],
  // Stock bajo (<= min_stock) para pruebas de alertas
  ['PI-QA-018', 'Compresas menstruales ultrafinas 12 uds (QA)', 'Intima Test', 'Higiene íntima', 2.15, 3, 8, 'available'],
  ['PI-QA-019', 'Toallitas húmedas bebé 72 uds (QA)', 'BabyCare Test', 'Bebé', 3.2, 2, 6, 'available'],
  // --- Agotados (available + stock = 0) ---
  ['PI-QA-020', 'Crema pañal 100 ml (QA)', 'BabyCare Test', 'Bebé', 5.4, 0, 4, 'available'],
  ['PI-QA-021', 'Colonia infantil 200 ml (QA)', 'BabyCare Test', 'Bebé', 6.8, 0, 3, 'available'],
  ['PI-QA-022', 'Mascarillas quirúrgicas caja 50 uds (QA)', 'CuraFácil Test', 'Material sanitario', 5.95, 0, 5, 'available'],
  ['PI-QA-023', 'Tensiómetro de brazo (QA)', 'CuraFácil Test', 'Material sanitario', 34.5, 0, 2, 'available'],
  ['PI-QA-024', 'Mascarilla capilar nutritiva 200 ml (QA)', 'QA Labs', 'Cuidado capilar', 9.3, 0, 4, 'available'],
  ['PI-QA-025', 'Lubricante íntimo base agua 50 ml (QA)', 'Intima Test', 'Higiene íntima', 7.1, 0, 3, 'available'],
  // --- Confirmar con farmacia (sin disponibilidad confirmada) ---
  ['PI-QA-026', 'Sérum facial vitamina C 30 ml (QA)', 'Dermo Test', 'Cuidado facial', 24.0, 0, 0, 'confirm_with_pharmacy'],
  ['PI-QA-027', 'Contorno de ojos 15 ml (QA)', 'Dermo Test', 'Cuidado facial', 19.5, 5, 0, 'confirm_with_pharmacy'],
  ['PI-QA-028', 'Faja lumbar talla M (QA)', 'Ortho Test', 'Ortopedia', 29.9, 0, 0, 'confirm_with_pharmacy'],
  ['PI-QA-029', 'Calcetín compresión suave talla L (QA)', 'Ortho Test', 'Ortopedia', 12.5, 0, 0, 'confirm_with_pharmacy'],
  ['PI-QA-030', 'Test de embarazo digital (QA)', 'Intima Test', 'Autodiagnóstico', 11.9, 0, 0, 'confirm_with_pharmacy'],
  ['PI-QA-031', 'Aceite corporal reafirmante 150 ml (QA)', 'QA Labs', 'Cuidado corporal', 13.4, 0, 0, 'confirm_with_pharmacy'],
  // --- No disponibles (descatalogados en la muestra) ---
  ['PI-QA-032', 'Kit viaje higiene edición verano (QA)', 'QA Labs', 'Higiene', 6.5, 0, 0, 'unavailable'],
  ['PI-QA-033', 'Crema solar infantil 200 ml edición limitada (QA)', 'Solaria Test', 'Fotoprotección', 15.2, 0, 0, 'unavailable'],
  ['PI-QA-034', 'Pastillero semanal (QA)', 'CuraFácil Test', 'Material sanitario', 3.1, 0, 0, 'unavailable'],
];

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: ph, error: phErr } = await admin
  .from('pharmacies')
  .select('id,name,status')
  .eq('id', PHARMACY_ID)
  .single();
if (phErr || !ph) {
  console.error('ABORT: farmacia no encontrada');
  process.exit(2);
}
if (!/piloto integral/i.test(ph.name)) {
  console.error('ABORT: el nombre de la farmacia no coincide con Piloto Integral');
  process.exit(2);
}
const { data: st } = await admin
  .from('pharmacy_settings')
  .select('catalog_mode')
  .eq('pharmacy_id', PHARMACY_ID)
  .maybeSingle();
if (st?.catalog_mode !== 'own') {
  console.error('ABORT: catalog_mode != own (no se cambia modo desde este script)');
  process.exit(2);
}

const refs = ROWS.map(([sku]) => SOURCE_REF_PREFIX + sku);
const { data: existing, error: exErr } = await admin
  .from('pharmacy_products')
  .select('source_ref')
  .eq('pharmacy_id', PHARMACY_ID)
  .in('source_ref', refs);
if (exErr) {
  console.error('ABORT: lectura existentes', exErr.message);
  process.exit(2);
}
const have = new Set((existing ?? []).map((r) => r.source_ref));

const toInsert = ROWS.filter(([sku]) => !have.has(SOURCE_REF_PREFIX + sku)).map(
  ([sku, name, brand, category, price, stock, min_stock, availability_status], i) => ({
    pharmacy_id: PHARMACY_ID,
    sku,
    ean: ean13('29' + String(1000000000 + Number(sku.slice(-3)) * 7).padStart(10, '0')),
    name,
    brand,
    category,
    price,
    stock,
    min_stock,
    is_active: true,
    is_featured: i % 9 === 0,
    source: 'manual',
    source_ref: SOURCE_REF_PREFIX + sku,
    availability_status,
  })
);

const summary = {};
for (const r of toInsert) {
  const k =
    r.availability_status === 'available'
      ? r.stock > 0
        ? 'disponible'
        : 'agotado'
      : r.availability_status;
  summary[k] = (summary[k] ?? 0) + 1;
}
console.log(
  JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    pharmacy: ph.name,
    pharmacy_status: ph.status,
    already_present: have.size,
    to_insert: toInsert.length,
    by_state: summary,
  })
);

if (!apply || toInsert.length === 0) process.exit(0);

const { error: insErr, count } = await admin
  .from('pharmacy_products')
  .insert(toInsert, { count: 'exact' });
if (insErr) {
  console.error('INSERT error:', insErr.message);
  process.exit(1);
}
console.log(`OK inserted=${count ?? toInsert.length}`);
