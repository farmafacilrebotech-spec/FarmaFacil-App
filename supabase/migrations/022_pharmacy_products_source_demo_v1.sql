-- =============================================================================
-- 022_pharmacy_products_source_demo_v1.sql
-- Origen de productos de catálogo (manual / import / demo) para limpieza futura.
--
-- Alcance:
--   - source: procedencia del alta
--   - source_ref: clave estable de plantilla (p. ej. farmafacil_demo_v1:DEMO-001)
--   - No vincula a una tabla de plantilla: es una copia etiquetada
--   - Único (pharmacy_id, source_ref) cuando source_ref no es NULL
--
-- NO APLICAR todavía desde este entorno salvo indicación explícita.
-- =============================================================================

ALTER TABLE public.pharmacy_products
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_ref text;

ALTER TABLE public.pharmacy_products
  DROP CONSTRAINT IF EXISTS pharmacy_products_source_chk;

ALTER TABLE public.pharmacy_products
  ADD CONSTRAINT pharmacy_products_source_chk
  CHECK (source = ANY (ARRAY['manual', 'import', 'demo']));

ALTER TABLE public.pharmacy_products
  DROP CONSTRAINT IF EXISTS pharmacy_products_source_ref_blank_chk;

ALTER TABLE public.pharmacy_products
  ADD CONSTRAINT pharmacy_products_source_ref_blank_chk
  CHECK (source_ref IS NULL OR length(btrim(source_ref)) > 0);

COMMENT ON COLUMN public.pharmacy_products.source IS
  'Origen del producto: manual | import | demo. Permite limpiar datos de demostración.';
COMMENT ON COLUMN public.pharmacy_products.source_ref IS
  'Referencia estable de plantilla (p. ej. farmafacil_demo_v1:DEMO-001). No es FK.';

CREATE INDEX IF NOT EXISTS pharmacy_products_pharmacy_source_idx
  ON public.pharmacy_products (pharmacy_id, source);

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_products_pharmacy_source_ref_uidx
  ON public.pharmacy_products (pharmacy_id, source_ref)
  WHERE source_ref IS NOT NULL AND length(btrim(source_ref)) > 0;

-- =============================================================================
-- Down (manual):
-- DROP INDEX IF EXISTS public.pharmacy_products_pharmacy_source_ref_uidx;
-- DROP INDEX IF EXISTS public.pharmacy_products_pharmacy_source_idx;
-- ALTER TABLE public.pharmacy_products DROP CONSTRAINT IF EXISTS pharmacy_products_source_ref_blank_chk;
-- ALTER TABLE public.pharmacy_products DROP CONSTRAINT IF EXISTS pharmacy_products_source_chk;
-- ALTER TABLE public.pharmacy_products DROP COLUMN IF EXISTS source_ref;
-- ALTER TABLE public.pharmacy_products DROP COLUMN IF EXISTS source;
-- =============================================================================
