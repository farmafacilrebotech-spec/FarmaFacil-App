-- =============================================================================
-- 020_pharmacy_products_catalog_v1.sql
-- Catálogo de productos por farmacia (tenant).
--
-- Alcance:
--   - Tabla public.pharmacy_products con pharmacy_id obligatorio
--   - Soft-deactivate (is_active), sin DELETE de negocio
--   - Unicidad parcial de EAN y SKU por farmacia
--   - RLS: lectura/escritura solo con membership active (o platform write)
--   - GRANT SELECT/INSERT/UPDATE a authenticated (sin DELETE)
--
-- Matching import (app):
--   1) EAN no vacío → match por (pharmacy_id, ean)
--   2) si no, SKU no vacío → match por (pharmacy_id, sku)
--   3) si no, alta nueva (nombre obligatorio)
--
-- Fuera de alcance:
--   - medicamentos con receta / lógica clínica
--   - service_role en operaciones normales de app
--   - módulo/permission keys catalog_* (V1: membership active basta)
-- =============================================================================

CREATE TABLE public.pharmacy_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  sku text,
  ean text,
  name text NOT NULL,
  description text,
  brand text,
  category text,
  price numeric(12, 2) NOT NULL DEFAULT 0
    CONSTRAINT pharmacy_products_price_nonneg_chk CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0
    CONSTRAINT pharmacy_products_stock_nonneg_chk CHECK (stock >= 0),
  min_stock integer NOT NULL DEFAULT 0
    CONSTRAINT pharmacy_products_min_stock_nonneg_chk CHECK (min_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_products_name_not_blank_chk CHECK (length(btrim(name)) > 0),
  CONSTRAINT pharmacy_products_sku_blank_or_value_chk CHECK (
    sku IS NULL OR length(btrim(sku)) > 0
  ),
  CONSTRAINT pharmacy_products_ean_blank_or_value_chk CHECK (
    ean IS NULL OR length(btrim(ean)) > 0
  ),
  CONSTRAINT pharmacy_products_identifier_or_name_chk CHECK (
    -- Al menos nombre (obligatorio) + opcionalmente sku y/o ean.
    -- No se exige sku ni ean de forma conjunta.
    length(btrim(name)) > 0
  )
);

COMMENT ON TABLE public.pharmacy_products IS
  'Catálogo de productos por farmacia. Soft-deactivate vía is_active; sin hard delete de negocio.';
COMMENT ON COLUMN public.pharmacy_products.sku IS
  'Código interno / referencia. Único por farmacia cuando no es NULL.';
COMMENT ON COLUMN public.pharmacy_products.ean IS
  'Código de barras EAN. Único por farmacia cuando no es NULL. Preferido para matching de import.';
COMMENT ON COLUMN public.pharmacy_products.price IS
  'PVP en EUR. >= 0.';
COMMENT ON COLUMN public.pharmacy_products.is_active IS
  'false = archivado/desactivado. No se elimina la fila.';

CREATE INDEX pharmacy_products_pharmacy_id_idx
  ON public.pharmacy_products (pharmacy_id);

CREATE INDEX pharmacy_products_pharmacy_active_idx
  ON public.pharmacy_products (pharmacy_id, is_active);

CREATE INDEX pharmacy_products_pharmacy_name_idx
  ON public.pharmacy_products (pharmacy_id, lower(name));

CREATE INDEX pharmacy_products_pharmacy_category_idx
  ON public.pharmacy_products (pharmacy_id, category)
  WHERE category IS NOT NULL;

-- Unicidad parcial: permite varios NULL, evita duplicar EAN/SKU reales.
CREATE UNIQUE INDEX pharmacy_products_pharmacy_ean_uidx
  ON public.pharmacy_products (pharmacy_id, ean)
  WHERE ean IS NOT NULL AND length(btrim(ean)) > 0;

CREATE UNIQUE INDEX pharmacy_products_pharmacy_sku_uidx
  ON public.pharmacy_products (pharmacy_id, sku)
  WHERE sku IS NOT NULL AND length(btrim(sku)) > 0;

CREATE TRIGGER pharmacy_products_set_updated_at
  BEFORE UPDATE ON public.pharmacy_products
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacy_products_select ON public.pharmacy_products
  FOR SELECT TO authenticated
  USING (public.ff_can_read_pharmacy(pharmacy_id));

CREATE POLICY pharmacy_products_insert ON public.pharmacy_products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_is_active_member(pharmacy_id)
  );

CREATE POLICY pharmacy_products_update ON public.pharmacy_products
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_is_active_member(pharmacy_id)
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_is_active_member(pharmacy_id)
  );

-- Sin policy DELETE: archivado = is_active = false.

-- -----------------------------------------------------------------------------
-- Grants (alineado con 015/018: sin DELETE)
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_products TO authenticated;

-- =============================================================================
-- Down (manual, no ejecutar en prod sin revisión):
-- REVOKE ALL ON TABLE public.pharmacy_products FROM authenticated;
-- DROP POLICY IF EXISTS pharmacy_products_update ON public.pharmacy_products;
-- DROP POLICY IF EXISTS pharmacy_products_insert ON public.pharmacy_products;
-- DROP POLICY IF EXISTS pharmacy_products_select ON public.pharmacy_products;
-- DROP TRIGGER IF EXISTS pharmacy_products_set_updated_at ON public.pharmacy_products;
-- DROP TABLE IF EXISTS public.pharmacy_products;
-- =============================================================================
