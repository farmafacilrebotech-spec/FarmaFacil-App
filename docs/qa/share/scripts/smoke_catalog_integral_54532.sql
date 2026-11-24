-- =============================================================================
-- Smoke integral catálogo — BD desechable ff-catalog-mig-smoke:54532
-- Datos 100% sintéticos. No toca staging/prod.
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- 0) Helpers de sesión para smoke (auth.uid + permisos por GUC)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- pharmacy-scoped: set ff.smoke_pharmacy_id / ff.smoke_platform = '1'
CREATE OR REPLACE FUNCTION public.ff_has_platform_permission(p text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('ff.smoke_platform', true), '') = '1'
$$;

CREATE OR REPLACE FUNCTION public.ff_has_pharmacy_permission(pid uuid, perm text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('ff.smoke_platform', true), '') = '1'
    OR (
      nullif(current_setting('ff.smoke_pharmacy_id', true), '')::uuid IS NOT DISTINCT FROM pid
      AND coalesce(current_setting('ff.smoke_perm', true), '') = perm
    )
$$;

CREATE OR REPLACE FUNCTION public.ff_pharmacy_is_operable(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true
$$;

-- Role authenticated for RLS checks (if missing)
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Minimal product RLS for multifarmacia isolation tests
ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pharmacy_products_smoke_tenant ON public.pharmacy_products;
CREATE POLICY pharmacy_products_smoke_tenant ON public.pharmacy_products
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.manage')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.manage')
  );

GRANT SELECT ON public.pharmacy_products TO authenticated;
GRANT SELECT ON public.pharmacy_catalog_import_jobs TO authenticated;
GRANT SELECT ON public.pharmacy_catalog_import_job_items TO authenticated;
GRANT SELECT ON public.pharmacy_category_import_equivalences TO authenticated;

-- -----------------------------------------------------------------------------
-- 1) Seed sintético: 2 farmacias + 1 perfil operador
-- -----------------------------------------------------------------------------
TRUNCATE public.pharmacy_catalog_import_job_items,
         public.pharmacy_catalog_import_jobs,
         public.pharmacy_category_import_equivalences,
         public.pharmacy_products,
         public.pharmacy_featured_categories
  CASCADE;

-- keep pharmacies/profiles but reset known smoke ids
DELETE FROM public.pharmacies
 WHERE id IN (
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
 );
DELETE FROM public.profiles
 WHERE id = 'cccccccc-cccc-cccc-cccc-ccccccccccc3';

INSERT INTO public.profiles (id)
VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc3');

INSERT INTO public.pharmacies (id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2');

-- Session as pharmacy A manager
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', false);
SELECT set_config('ff.smoke_platform', '', false);
SELECT set_config('ff.smoke_pharmacy_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', false);
SELECT set_config('ff.smoke_perm', 'catalog.manage', false);

-- Equivalencia confirmada A: familia "Higiene oral" → salud_bucodental
INSERT INTO public.pharmacy_category_import_equivalences (
  pharmacy_id, supplier_key, source_format, source_family, source_subfamily, category_id
)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'synth_supplier',
  'csv',
  'Higiene oral',
  NULL,
  c.id
FROM public.ff_catalog_categories c
WHERE c.slug = 'salud_bucodental';

-- -----------------------------------------------------------------------------
-- 2) Importación real (batch create)
-- -----------------------------------------------------------------------------
\echo '=== T1 import create ==='
SELECT public.ff_pharmacy_products_import_batch_v1(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  $j$[
    {"row_index":0,"name":"Crema solar FPS50","sku":"SKU-SOL-50","ean":"8410000000001","national_code":"CN001","brand":"SunLab","laboratory":"LabA","category":"Protección solar","price":12.5,"stock":10,"min_stock":2,"price_provided":true,"stock_provided":true,"min_stock_provided":true},
    {"row_index":1,"name":"Champú suave","sku":"SKU-CAP-01","ean":"8410000000002","brand":"HairCo","category":"Cuidado capilar","price":8.9,"stock":5,"price_provided":true,"stock_provided":true},
    {"row_index":2,"name":"Pasta dental menta","sku":"SKU-ORAL-01","ean":"8410000000003","source_family":"Higiene oral","price":4.2,"stock":20,"price_provided":true,"stock_provided":true},
    {"row_index":3,"name":"Producto sin mapear","sku":"SKU-PEND-01","ean":"8410000000004","source_family":"Familia desconocida XYZ","price":1,"stock":1,"price_provided":true,"stock_provided":true},
    {"row_index":4,"name":"x","sku":"","ean":"","price_provided":false,"stock_provided":false}
  ]$j$::jsonb,
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'synth_catalog_v1.csv',
  true
) AS t1_result;

-- Expect: 3 classified + 1 pending + 1 skip; products in A only
\echo '=== T1 counts ==='
SELECT classification_status, count(*)
FROM public.pharmacy_products
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
GROUP BY 1 ORDER BY 1;

SELECT count(*) AS products_a FROM public.pharmacy_products
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

SELECT status, summary FROM public.pharmacy_catalog_import_jobs
WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';

-- -----------------------------------------------------------------------------
-- 3) Reimportación + idempotencia (mismo job_id + row_index → replayed)
-- -----------------------------------------------------------------------------
\echo '=== T2 idempotent replay same job ==='
SELECT public.ff_pharmacy_products_import_batch_v1(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  $j$[
    {"row_index":0,"name":"Crema solar FPS50","sku":"SKU-SOL-50","ean":"8410000000001","national_code":"CN001","brand":"SunLab","laboratory":"LabA","category":"Protección solar","price":12.5,"stock":10,"min_stock":2,"price_provided":true,"stock_provided":true,"min_stock_provided":true},
    {"row_index":1,"name":"Champú suave","sku":"SKU-CAP-01","ean":"8410000000002","brand":"HairCo","category":"Cuidado capilar","price":8.9,"stock":5,"price_provided":true,"stock_provided":true}
  ]$j$::jsonb,
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'synth_catalog_v1.csv',
  true
) AS t2_replay;

SELECT count(*) AS products_a_after_replay FROM public.pharmacy_products
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

-- -----------------------------------------------------------------------------
-- 4) Duplicados: nuevo job, mismo EAN → update (no segundo create)
-- -----------------------------------------------------------------------------
\echo '=== T3 duplicate ean → update ==='
-- bump stock via pharmacy edit first
UPDATE public.pharmacy_products
SET stock = 99, updated_at = now()
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  AND ean = '8410000000001';

SELECT public.ff_pharmacy_products_import_batch_v1(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  $j$[
    {"row_index":0,"name":"Crema solar FPS50 PLUS","sku":"SKU-SOL-50","ean":"8410000000001","national_code":"CN001","brand":"SunLab","category":"Protección solar","price":13.0,"stock":1,"price_provided":true,"stock_provided":false}
  ]$j$::jsonb,
  'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid,
  'synth_reimport_v2.csv',
  true
) AS t3_dup;

SELECT name, stock, price
FROM public.pharmacy_products
WHERE ean = '8410000000001'
  AND pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
-- Expect: name updated, stock STILL 99 (stock_provided=false), price 13.0

-- -----------------------------------------------------------------------------
-- 5) Equivalencias (familia → category_id)
-- -----------------------------------------------------------------------------
\echo '=== T4 equivalences ==='
SELECT p.name, p.source_family, p.classification_status, c.slug
FROM public.pharmacy_products p
LEFT JOIN public.ff_catalog_categories c ON c.id = p.category_id
WHERE p.ean IN ('8410000000003','8410000000004')
ORDER BY p.ean;
-- 0003 → salud_bucodental / classified; 0004 → pending_classification

-- -----------------------------------------------------------------------------
-- 6) Historial + reversión
-- -----------------------------------------------------------------------------
\echo '=== T5 history + revert ==='
SELECT id, status, source_filename, summary->>'created' AS created
FROM public.pharmacy_catalog_import_jobs
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
ORDER BY created_at;

-- Mark a create product as pharmacy-edited so revert soft-skips
UPDATE public.pharmacy_products
SET updated_at = now() + interval '1 minute', name = name || ' (editado)'
WHERE ean = '8410000000002'
  AND pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

SELECT public.ff_pharmacy_products_import_revert_v1(
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid
) AS t5_revert;

SELECT ean, is_active, name
FROM public.pharmacy_products
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  AND ean IN ('8410000000002','8410000000003','8410000000004')
ORDER BY ean;
-- 0002 edited → stays active; creates without edit → deactivated

SELECT status FROM public.pharmacy_catalog_import_jobs
WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';

-- -----------------------------------------------------------------------------
-- 7) RLS / aislamiento multifarmacia
-- -----------------------------------------------------------------------------
\echo '=== T6 RLS multifarmacia ==='
-- Seed one product into B as platform
SELECT set_config('ff.smoke_platform', '1', false);
INSERT INTO public.pharmacy_products (pharmacy_id, name, ean, sku, source, price, stock)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  'Solo farmacia B',
  '8499999999999',
  'SKU-B-ONLY',
  'manual',
  3.0,
  7
);

-- Switch to A-only session
SELECT set_config('ff.smoke_platform', '', false);
SELECT set_config('ff.smoke_pharmacy_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', false);
SELECT set_config('ff.smoke_perm', 'catalog.manage', false);

-- Direct table as role authenticated
SET ROLE authenticated;
SELECT count(*) AS visible_as_a FROM public.pharmacy_products;
SELECT count(*) AS b_leak FROM public.pharmacy_products
WHERE pharmacy_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
RESET ROLE;

-- Cross-pharmacy import denied
DO $$
BEGIN
  PERFORM public.ff_pharmacy_products_import_batch_v1(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
    '[{"row_index":0,"name":"Intrusion","ean":"8400000000099","price_provided":false,"stock_provided":false}]'::jsonb,
    NULL, 'intrusion.csv', true
  );
  RAISE EXCEPTION 'FAIL: cross-pharmacy import should be denied';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK cross-pharmacy denied: %', SQLERRM;
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%catalog_permission%' THEN
      RAISE NOTICE 'OK cross-pharmacy denied: %', SQLERRM;
    ELSE
      RAISE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8) Stock no bloqueante
-- -----------------------------------------------------------------------------
\echo '=== T7 stock non-blocking ==='
SELECT set_config('ff.smoke_platform', '', false);
SELECT set_config('ff.smoke_pharmacy_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', false);

-- Reactivate / ensure product for stock test
UPDATE public.pharmacy_products
SET is_active = true, stock = 50
WHERE ean = '8410000000001'
  AND pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

SELECT public.ff_pharmacy_products_import_batch_v1(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  $j$[
    {"row_index":0,"name":"Crema solar FPS50 PLUS","ean":"8410000000001","category":"Protección solar","stock":0,"stock_provided":false,"price":14,"price_provided":true},
    {"row_index":1,"name":"Nuevo sin stock col","ean":"8410000000091","sku":"SKU-NS","category":"Dermocosmética","price":2,"price_provided":true}
  ]$j$::jsonb,
  'dddddddd-dddd-dddd-dddd-ddddddddddd3'::uuid,
  'synth_stock.csv',
  true
) AS t7_stock;

SELECT ean, stock, price, name
FROM public.pharmacy_products
WHERE pharmacy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  AND ean IN ('8410000000001','8410000000091')
ORDER BY ean;
-- 0001 stock unchanged 50; 0091 stock default 0; import succeeds without stock_provided

-- -----------------------------------------------------------------------------
-- 9) Rendimiento escritura real (500 filas = 1 batch max)
-- -----------------------------------------------------------------------------
\echo '=== T8 perf 500-row batch ==='
SELECT set_config('ff.smoke_platform', '1', false);

DO $$
DECLARE
  v_rows jsonb := '[]'::jsonb;
  i int;
  t0 timestamptz;
  t1 timestamptz;
  v_res jsonb;
  v_ms numeric;
BEGIN
  FOR i IN 0..499 LOOP
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'row_index', i,
      'name', 'Perf product ' || i,
      'ean', '85000000' || lpad(i::text, 5, '0'),
      'sku', 'PERF-' || i,
      'category', 'Dermocosmética',
      'price', 1.5,
      'price_provided', true,
      'stock', 3,
      'stock_provided', true
    ));
  END LOOP;

  t0 := clock_timestamp();
  v_res := public.ff_pharmacy_products_import_batch_v1(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
    v_rows,
    'dddddddd-dddd-dddd-dddd-ddddddddddd4'::uuid,
    'perf_500.csv',
    true
  );
  t1 := clock_timestamp();
  v_ms := extract(epoch FROM (t1 - t0)) * 1000;

  RAISE NOTICE 'PERF_500_MS=% RESULT=%', round(v_ms, 1), v_res;
  INSERT INTO public.pharmacy_catalog_import_jobs (id, pharmacy_id, status, source_filename, summary)
  VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'completed',
    '_perf_marker',
    jsonb_build_object('perf_500_ms', v_ms, 'batch_result', v_res)
  )
  ON CONFLICT (id) DO UPDATE SET summary = excluded.summary;
END $$;

SELECT summary->>'perf_500_ms' AS perf_500_ms,
       summary->'batch_result' AS batch_result
FROM public.pharmacy_catalog_import_jobs
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5';

SELECT count(*) AS products_b FROM public.pharmacy_products
WHERE pharmacy_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

\echo '=== SMOKE INTEGRAL DONE ==='
