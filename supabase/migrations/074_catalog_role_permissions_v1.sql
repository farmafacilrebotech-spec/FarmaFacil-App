-- =============================================================================
-- 074_catalog_role_permissions_v1.sql
-- Permisos de catálogo/stock por rol de farmacia + RLS + trigger anti-precio.
--
-- Matriz:
--   PHARMACY_OWNER / PHARMACY_ADMIN: catalog.view + catalog.manage + catalog.stock.update
--   PHARMACIST: catalog.view + catalog.stock.update (sin precios ni datos comerciales)
--   STAFF: catalog.view solamente
--
-- NO APLICAR automáticamente. Depende de: 011 (ff_has_pharmacy_permission),
-- 020/028 (pharmacy_products RLS), seed roles.
-- =============================================================================

INSERT INTO public.permissions (key, module_key, description)
VALUES
  (
    'catalog.view',
    'pharmacies',
    'Ver productos del catálogo de la farmacia'
  ),
  (
    'catalog.manage',
    'pharmacies',
    'Crear/editar productos, precios y datos comerciales del catálogo'
  ),
  (
    'catalog.stock.update',
    'pharmacies',
    'Actualizar stock, stock mínimo y disponibilidad (sin precios)'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

-- OWNER / ADMIN: vista + gestión completa + stock
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN ('PHARMACY_OWNER', 'PHARMACY_ADMIN')
  AND p.key IN ('catalog.view', 'catalog.manage', 'catalog.stock.update')
ON CONFLICT DO NOTHING;

-- PHARMACIST: vista + stock/disponibilidad (sin manage)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'PHARMACIST'
  AND p.key IN ('catalog.view', 'catalog.stock.update')
ON CONFLICT DO NOTHING;

-- STAFF: solo consulta
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'STAFF'
  AND p.key = 'catalog.view'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS: escritura ya no es «cualquier miembro activo»
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS pharmacy_products_insert ON public.pharmacy_products;
CREATE POLICY pharmacy_products_insert ON public.pharmacy_products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.manage')
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

DROP POLICY IF EXISTS pharmacy_products_update ON public.pharmacy_products;
CREATE POLICY pharmacy_products_update ON public.pharmacy_products
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      (
        public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.manage')
        OR public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.stock.update')
      )
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      (
        public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.manage')
        OR public.ff_has_pharmacy_permission(pharmacy_id, 'catalog.stock.update')
      )
      AND public.ff_pharmacy_is_operable(pharmacy_id)
    )
  );

-- SELECT: sin cambio de forma (sigue ff_can_read_pharmacy). catalog.view
-- documenta la matriz; el aislamiento de lectura ya es por membership/plataforma.

-- -----------------------------------------------------------------------------
-- Trigger: stock.update no puede tocar campos comerciales / precio
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_products_enforce_catalog_write_()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform boolean;
  v_manage boolean;
  v_commercial_changed boolean;
BEGIN
  v_platform := public.ff_has_platform_permission('platform.pharmacies.write');
  IF v_platform THEN
    RETURN NEW;
  END IF;

  v_manage := public.ff_has_pharmacy_permission(NEW.pharmacy_id, 'catalog.manage');
  IF v_manage THEN
    RETURN NEW;
  END IF;

  -- Sin manage: solo se permiten cambios de stock/disponibilidad.
  v_commercial_changed :=
    NEW.price IS DISTINCT FROM OLD.price
    OR NEW.name IS DISTINCT FROM OLD.name
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.brand IS DISTINCT FROM OLD.brand
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.subcategory IS DISTINCT FROM OLD.subcategory
    OR NEW.sku IS DISTINCT FROM OLD.sku
    OR NEW.ean IS DISTINCT FROM OLD.ean
    OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.source_ref IS DISTINCT FROM OLD.source_ref
    OR NEW.master_catalog_id IS DISTINCT FROM OLD.master_catalog_id;

  IF v_commercial_changed THEN
    RAISE EXCEPTION 'catalog_permission: se requiere catalog.manage para modificar precio o datos comerciales'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.ff_has_pharmacy_permission(NEW.pharmacy_id, 'catalog.stock.update') THEN
    RAISE EXCEPTION 'catalog_permission: sin permiso de catálogo/stock'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_products_enforce_catalog_write_() IS
  '074: PHARMACIST/stock.update solo stock/disponibilidad; precio y ficha comercial exigen catalog.manage.';

DROP TRIGGER IF EXISTS pharmacy_products_enforce_catalog_write
  ON public.pharmacy_products;
CREATE TRIGGER pharmacy_products_enforce_catalog_write
  BEFORE UPDATE ON public.pharmacy_products
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_pharmacy_products_enforce_catalog_write_();

-- INSERT con solo stock.update debe fallar vía policy (sin catalog.manage).

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS pharmacy_products_enforce_catalog_write ON public.pharmacy_products;
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_products_enforce_catalog_write_();
-- Restaurar policies 028 (member activo) y DELETE role_permissions/permissions catalog.*.
