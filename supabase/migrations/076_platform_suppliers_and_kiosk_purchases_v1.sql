-- =============================================================================
-- 076_platform_suppliers_and_kiosk_purchases_v1.sql
-- Directorio de proveedores FarmaFácil + presupuestos/compras.
-- Reutiliza el diseño WIP 068 (kiosk_purchase_orders) sin duplicar pedidos:
--   se publica aquí como 076 (068 nunca llegó a main; números 068–073 reservados/otros).
-- Documentos en Storage privado. Sin acceso a cuentas farmacia/cliente.
-- Depende de: 065_kiosk_physical_inventory_v1.
-- NO APLICAR en producción sin autorización expresa.
-- ROLLBACK (manual): DROP tables/RPCs/policies/bucket documentados abajo;
--   no ejecutar DROP en prod sin plan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos directorio proveedores (NO PLATFORM_SUPPORT ni farmacia)
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.suppliers.read',
    'suppliers',
    'Ver directorio de proveedores, presupuestos y metadatos de documentos'
  ),
  (
    'platform.suppliers.write',
    'suppliers',
    'Alta/edición/archivo de proveedores, presupuestos y adjuntos'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPERADMIN'
  AND p.key IN (
    'platform.suppliers.read',
    'platform.suppliers.write'
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Directorio de proveedores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trade_name text,
  tax_id text,
  category text,
  email text,
  phone text,
  website text,
  billing_address text,
  payment_terms text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_suppliers_name_chk CHECK (length(btrim(legal_name)) > 0),
  CONSTRAINT platform_suppliers_status_chk CHECK (
    status IN ('active', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS platform_suppliers_status_idx
  ON public.platform_suppliers (status, legal_name);

CREATE INDEX IF NOT EXISTS platform_suppliers_category_idx
  ON public.platform_suppliers (category)
  WHERE category IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL
    REFERENCES public.platform_suppliers (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role_title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_supplier_contacts_name_chk CHECK (length(btrim(full_name)) > 0)
);

CREATE INDEX IF NOT EXISTS platform_supplier_contacts_supplier_idx
  ON public.platform_supplier_contacts (supplier_id);

CREATE TABLE IF NOT EXISTS public.platform_supplier_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL
    REFERENCES public.platform_suppliers (id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_supplier_activity_action_chk CHECK (length(btrim(action)) > 0)
);

CREATE INDEX IF NOT EXISTS platform_supplier_activity_supplier_idx
  ON public.platform_supplier_activity (supplier_id, created_at DESC);

-- Presupuestos de materiales (genérico; kiosk POs siguen siendo el pedido operativo)
CREATE TABLE IF NOT EXISTS public.platform_supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL
    REFERENCES public.platform_suppliers (id) ON DELETE RESTRICT,
  quote_number text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'recibido',
  received_at date,
  valid_until date,
  currency text NOT NULL DEFAULT 'EUR',
  shipping_cents integer,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_supplier_quotes_title_chk CHECK (length(btrim(title)) > 0),
  CONSTRAINT platform_supplier_quotes_status_chk CHECK (
    status IN ('recibido', 'en_revision', 'aprobado', 'rechazado', 'caducado')
  ),
  CONSTRAINT platform_supplier_quotes_shipping_chk CHECK (
    shipping_cents IS NULL OR shipping_cents >= 0
  )
);

CREATE INDEX IF NOT EXISTS platform_supplier_quotes_supplier_idx
  ON public.platform_supplier_quotes (supplier_id, status, received_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.platform_supplier_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL
    REFERENCES public.platform_supplier_quotes (id) ON DELETE CASCADE,
  material_key text NOT NULL,
  description text NOT NULL,
  quantity numeric(12, 3) NOT NULL DEFAULT 1,
  unit text,
  unit_price_cents integer NOT NULL DEFAULT 0,
  vat_bps integer NOT NULL DEFAULT 2100,
  lead_days integer,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT platform_supplier_quote_lines_material_chk CHECK (length(btrim(material_key)) > 0),
  CONSTRAINT platform_supplier_quote_lines_desc_chk CHECK (length(btrim(description)) > 0),
  CONSTRAINT platform_supplier_quote_lines_qty_chk CHECK (quantity > 0),
  CONSTRAINT platform_supplier_quote_lines_price_chk CHECK (unit_price_cents >= 0),
  CONSTRAINT platform_supplier_quote_lines_vat_chk CHECK (vat_bps >= 0 AND vat_bps <= 10000)
);

CREATE INDEX IF NOT EXISTS platform_supplier_quote_lines_material_idx
  ON public.platform_supplier_quote_lines (material_key, quote_id);

CREATE TABLE IF NOT EXISTS public.platform_supplier_quote_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL
    REFERENCES public.platform_supplier_quotes (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  byte_size integer,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_supplier_quote_docs_path_chk CHECK (length(btrim(storage_path)) > 0),
  CONSTRAINT platform_supplier_quote_docs_name_chk CHECK (length(btrim(file_name)) > 0)
);

-- RLS directorio / presupuestos
ALTER TABLE public.platform_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_supplier_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_supplier_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_supplier_quote_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_suppliers_select ON public.platform_suppliers;
CREATE POLICY platform_suppliers_select ON public.platform_suppliers
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_suppliers_write ON public.platform_suppliers;
CREATE POLICY platform_suppliers_write ON public.platform_suppliers
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

DROP POLICY IF EXISTS platform_supplier_contacts_select ON public.platform_supplier_contacts;
CREATE POLICY platform_supplier_contacts_select ON public.platform_supplier_contacts
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_supplier_contacts_write ON public.platform_supplier_contacts;
CREATE POLICY platform_supplier_contacts_write ON public.platform_supplier_contacts
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

DROP POLICY IF EXISTS platform_supplier_activity_select ON public.platform_supplier_activity;
CREATE POLICY platform_supplier_activity_select ON public.platform_supplier_activity
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_supplier_activity_write ON public.platform_supplier_activity;
CREATE POLICY platform_supplier_activity_write ON public.platform_supplier_activity
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

DROP POLICY IF EXISTS platform_supplier_quotes_select ON public.platform_supplier_quotes;
CREATE POLICY platform_supplier_quotes_select ON public.platform_supplier_quotes
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_supplier_quotes_write ON public.platform_supplier_quotes;
CREATE POLICY platform_supplier_quotes_write ON public.platform_supplier_quotes
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

DROP POLICY IF EXISTS platform_supplier_quote_lines_select ON public.platform_supplier_quote_lines;
CREATE POLICY platform_supplier_quote_lines_select ON public.platform_supplier_quote_lines
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_supplier_quote_lines_write ON public.platform_supplier_quote_lines;
CREATE POLICY platform_supplier_quote_lines_write ON public.platform_supplier_quote_lines
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

DROP POLICY IF EXISTS platform_supplier_quote_docs_select ON public.platform_supplier_quote_documents;
CREATE POLICY platform_supplier_quote_docs_select ON public.platform_supplier_quote_documents
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_supplier_quote_docs_write ON public.platform_supplier_quote_documents;
CREATE POLICY platform_supplier_quote_docs_write ON public.platform_supplier_quote_documents
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

GRANT SELECT, INSERT, UPDATE ON public.platform_suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_supplier_contacts TO authenticated;
GRANT SELECT, INSERT ON public.platform_supplier_activity TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_supplier_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_supplier_quote_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_supplier_quote_documents TO authenticated;

-- Bucket privado documentos de presupuestos de proveedor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-docs',
  'supplier-docs',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS supplier_docs_storage_select ON storage.objects;
CREATE POLICY supplier_docs_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'supplier-docs'
    AND public.ff_has_platform_permission('platform.suppliers.read')
  );

DROP POLICY IF EXISTS supplier_docs_storage_insert ON storage.objects;
CREATE POLICY supplier_docs_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-docs'
    AND public.ff_has_platform_permission('platform.suppliers.write')
  );

DROP POLICY IF EXISTS supplier_docs_storage_update ON storage.objects;
CREATE POLICY supplier_docs_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'supplier-docs'
    AND public.ff_has_platform_permission('platform.suppliers.write')
  )
  WITH CHECK (
    bucket_id = 'supplier-docs'
    AND public.ff_has_platform_permission('platform.suppliers.write')
  );


-- -----------------------------------------------------------------------------
-- Permisos financieros / compras (NO se conceden a PLATFORM_SUPPORT)
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.kiosk_purchasing.read',
    'kiosk_purchasing',
    'Ver pedidos a proveedor, importes y documentos (presupuestos/facturas)'
  ),
  (
    'platform.kiosk_purchasing.write',
    'kiosk_purchasing',
    'Crear/editar pedidos a proveedor, adjuntar documentos y registrar recepciones ligadas'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPERADMIN'
  AND p.key IN (
    'platform.kiosk_purchasing.read',
    'platform.kiosk_purchasing.write'
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Pedidos al proveedor
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Datos operativos (visibles con inventario.read)
  supplier_name text NOT NULL,
  order_number text,
  model text,
  quantity integer NOT NULL,
  received_quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'preparado',
  ordered_at date,
  -- Plazo configurable (meses) para ETA; por defecto 2
  delivery_lead_months integer NOT NULL DEFAULT 2,
  estimated_delivery_at date,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_po_quantity_chk CHECK (quantity >= 1 AND quantity <= 5000),
  CONSTRAINT kiosk_po_received_chk CHECK (
    received_quantity >= 0 AND received_quantity <= quantity
  ),
  CONSTRAINT kiosk_po_status_chk CHECK (
    status IN (
      'preparado',
      'pedido',
      'parcialmente_recibido',
      'recibido',
      'cancelado'
    )
  ),
  CONSTRAINT kiosk_po_lead_chk CHECK (
    delivery_lead_months >= 0 AND delivery_lead_months <= 24
  )
);

-- Importes en tabla aparte: RLS solo purchasing (soporte/comercial no ven precios)
CREATE TABLE IF NOT EXISTS public.kiosk_purchase_order_costs (
  purchase_order_id uuid PRIMARY KEY
    REFERENCES public.kiosk_purchase_orders (id) ON DELETE CASCADE,
  unit_price_cents integer,
  shipping_cents integer,
  total_cents integer,
  currency text NOT NULL DEFAULT 'EUR',
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_po_costs_money_chk CHECK (
    (unit_price_cents IS NULL OR unit_price_cents >= 0)
    AND (shipping_cents IS NULL OR shipping_cents >= 0)
    AND (total_cents IS NULL OR total_cents >= 0)
  )
);

COMMENT ON TABLE public.kiosk_purchase_orders IS
  'Pedidos de compra de kioskos al proveedor. Independiente de commercial_quotes.';

CREATE INDEX IF NOT EXISTS kiosk_purchase_orders_status_idx
  ON public.kiosk_purchase_orders (status, ordered_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS kiosk_purchase_orders_order_number_idx
  ON public.kiosk_purchase_orders (order_number)
  WHERE order_number IS NOT NULL;

-- Enlace opcional al directorio (sin obligar datos previos)
ALTER TABLE public.kiosk_purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id uuid
    REFERENCES public.platform_suppliers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS kiosk_purchase_orders_supplier_id_idx
  ON public.kiosk_purchase_orders (supplier_id)
  WHERE supplier_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Documentos del pedido (metadatos; bytes en Storage bucket privado)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_purchase_order_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL
    REFERENCES public.kiosk_purchase_orders (id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  byte_size integer,
  -- Sustitución: el nuevo apunta al anterior vía replaces_document_id
  replaces_document_id uuid
    REFERENCES public.kiosk_purchase_order_documents (id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_po_doc_type_chk CHECK (
    doc_type IN ('supplier_quote', 'order_confirmation', 'invoice')
  ),
  CONSTRAINT kiosk_po_doc_path_chk CHECK (length(btrim(storage_path)) > 0),
  CONSTRAINT kiosk_po_doc_name_chk CHECK (length(btrim(file_name)) > 0)
);

COMMENT ON TABLE public.kiosk_purchase_order_documents IS
  'Metadatos de presupuesto proveedor / confirmación / factura. Acceso financiero.';

CREATE INDEX IF NOT EXISTS kiosk_po_docs_po_idx
  ON public.kiosk_purchase_order_documents (purchase_order_id, doc_type, is_current);

-- -----------------------------------------------------------------------------
-- Recepciones ligadas al pedido (auditoría de cantidades)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL
    REFERENCES public.kiosk_purchase_orders (id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  asset_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_po_receipt_qty_chk CHECK (quantity >= 1 AND quantity <= 500)
);

CREATE INDEX IF NOT EXISTS kiosk_po_receipts_po_idx
  ON public.kiosk_purchase_receipts (purchase_order_id, created_at DESC);

-- Enlace activo → pedido (nullable; activos previos sin PO siguen válidos)
ALTER TABLE public.kiosk_assets
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid
    REFERENCES public.kiosk_purchase_orders (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS kiosk_assets_purchase_order_id_idx
  ON public.kiosk_assets (purchase_order_id)
  WHERE purchase_order_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- ETA helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_po_compute_eta(
  p_ordered_at date,
  p_lead_months integer
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_ordered_at IS NULL THEN NULL
    ELSE (p_ordered_at + make_interval(months => GREATEST(0, COALESCE(p_lead_months, 2))))::date
  END;
$$;

-- -----------------------------------------------------------------------------
-- Recalcular estado operativo del pedido
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_po_refresh_status(p_po_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_po public.kiosk_purchase_orders%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_po FROM public.kiosk_purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_po.status = 'cancelado' THEN
    RETURN 'cancelado';
  END IF;
  IF v_po.received_quantity <= 0 THEN
    v_status := CASE
      WHEN v_po.ordered_at IS NOT NULL OR v_po.status = 'pedido' THEN 'pedido'
      ELSE 'preparado'
    END;
    -- Si ya estaba en pedido, conservar pedido aunque received=0
    IF v_po.status = 'pedido' THEN
      v_status := 'pedido';
    ELSIF v_po.status = 'preparado' AND v_po.ordered_at IS NULL THEN
      v_status := 'preparado';
    ELSIF v_po.ordered_at IS NOT NULL THEN
      v_status := 'pedido';
    ELSE
      v_status := 'preparado';
    END IF;
  ELSIF v_po.received_quantity >= v_po.quantity THEN
    v_status := 'recibido';
  ELSE
    v_status := 'parcialmente_recibido';
  END IF;

  UPDATE public.kiosk_purchase_orders
  SET
    status = v_status,
    updated_at = pg_catalog.now()
  WHERE id = p_po_id;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_po_refresh_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_po_refresh_status(uuid)
  TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.kiosk_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_purchase_order_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_purchase_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_purchase_receipts ENABLE ROW LEVEL SECURITY;

-- Operativo: inventario.read puede VER filas (columnas sensibles se filtran en RPC/app)
DROP POLICY IF EXISTS kiosk_po_select_inventory ON public.kiosk_purchase_orders;
CREATE POLICY kiosk_po_select_inventory ON public.kiosk_purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.kiosk_inventory.read')
    OR public.ff_has_platform_permission('platform.kiosk_purchasing.read')
  );

DROP POLICY IF EXISTS kiosk_po_write_purchasing ON public.kiosk_purchase_orders;
CREATE POLICY kiosk_po_write_purchasing ON public.kiosk_purchase_orders
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_purchasing.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_purchasing.write'));

DROP POLICY IF EXISTS kiosk_po_costs_select ON public.kiosk_purchase_order_costs;
CREATE POLICY kiosk_po_costs_select ON public.kiosk_purchase_order_costs
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_purchasing.read'));

DROP POLICY IF EXISTS kiosk_po_costs_write ON public.kiosk_purchase_order_costs;
CREATE POLICY kiosk_po_costs_write ON public.kiosk_purchase_order_costs
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_purchasing.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_purchasing.write'));

-- Documentos: SOLO purchasing (presupuestos/facturas)
DROP POLICY IF EXISTS kiosk_po_docs_select ON public.kiosk_purchase_order_documents;
CREATE POLICY kiosk_po_docs_select ON public.kiosk_purchase_order_documents
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_purchasing.read'));

DROP POLICY IF EXISTS kiosk_po_docs_write ON public.kiosk_purchase_order_documents;
CREATE POLICY kiosk_po_docs_write ON public.kiosk_purchase_order_documents
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_purchasing.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_purchasing.write'));

-- Recepciones: inventario.read puede ver; write purchasing o inventory.write vía RPC
DROP POLICY IF EXISTS kiosk_po_receipts_select ON public.kiosk_purchase_receipts;
CREATE POLICY kiosk_po_receipts_select ON public.kiosk_purchase_receipts
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.kiosk_inventory.read')
    OR public.ff_has_platform_permission('platform.kiosk_purchasing.read')
  );

DROP POLICY IF EXISTS kiosk_po_receipts_write ON public.kiosk_purchase_receipts;
CREATE POLICY kiosk_po_receipts_write ON public.kiosk_purchase_receipts
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.kiosk_purchasing.write')
    OR public.ff_has_platform_permission('platform.kiosk_inventory.write')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.kiosk_purchasing.write')
    OR public.ff_has_platform_permission('platform.kiosk_inventory.write')
  );

GRANT SELECT ON public.kiosk_purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kiosk_purchase_orders TO authenticated;
GRANT SELECT ON public.kiosk_purchase_order_costs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kiosk_purchase_order_costs TO authenticated;
GRANT SELECT ON public.kiosk_purchase_order_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kiosk_purchase_order_documents TO authenticated;
GRANT SELECT ON public.kiosk_purchase_receipts TO authenticated;
GRANT SELECT, INSERT ON public.kiosk_purchase_receipts TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage bucket privado
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kiosk-purchase-docs',
  'kiosk-purchase-docs',
  false,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Solo purchasing puede leer/escribir objetos del bucket
DROP POLICY IF EXISTS kiosk_purchase_docs_storage_select ON storage.objects;
CREATE POLICY kiosk_purchase_docs_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kiosk-purchase-docs'
    AND public.ff_has_platform_permission('platform.kiosk_purchasing.read')
  );

DROP POLICY IF EXISTS kiosk_purchase_docs_storage_insert ON storage.objects;
CREATE POLICY kiosk_purchase_docs_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kiosk-purchase-docs'
    AND public.ff_has_platform_permission('platform.kiosk_purchasing.write')
  );

DROP POLICY IF EXISTS kiosk_purchase_docs_storage_update ON storage.objects;
CREATE POLICY kiosk_purchase_docs_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kiosk-purchase-docs'
    AND public.ff_has_platform_permission('platform.kiosk_purchasing.write')
  )
  WITH CHECK (
    bucket_id = 'kiosk-purchase-docs'
    AND public.ff_has_platform_permission('platform.kiosk_purchasing.write')
  );

-- -----------------------------------------------------------------------------
-- RPC: crear / actualizar pedido (purchasing.write)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_purchase_order_upsert_v1(
  p_id uuid DEFAULT NULL,
  p_supplier_name text DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_quantity integer DEFAULT NULL,
  p_ordered_at date DEFAULT NULL,
  p_delivery_lead_months integer DEFAULT 2,
  p_unit_price_cents integer DEFAULT NULL,
  p_shipping_cents integer DEFAULT NULL,
  p_total_cents integer DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_mark_as_ordered boolean DEFAULT false,
  p_cancel boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_row public.kiosk_purchase_orders%ROWTYPE;
  v_lead int;
  v_eta date;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_purchasing.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  v_lead := COALESCE(p_delivery_lead_months, 2);
  IF v_lead < 0 OR v_lead > 24 THEN
    RETURN jsonb_build_object('status', 'invalid_lead');
  END IF;

  IF p_id IS NULL THEN
    IF NULLIF(btrim(COALESCE(p_supplier_name, '')), '') IS NULL THEN
      RETURN jsonb_build_object('status', 'supplier_required');
    END IF;
    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 5000 THEN
      RETURN jsonb_build_object('status', 'invalid_quantity');
    END IF;

    v_eta := public.ff_kiosk_po_compute_eta(p_ordered_at, v_lead);
    v_status := CASE
      WHEN p_cancel THEN 'cancelado'
      WHEN p_mark_as_ordered OR p_ordered_at IS NOT NULL THEN 'pedido'
      ELSE 'preparado'
    END;

    INSERT INTO public.kiosk_purchase_orders (
      supplier_name, order_number, model, quantity, status,
      ordered_at, delivery_lead_months, estimated_delivery_at, notes,
      created_by, updated_by
    ) VALUES (
      btrim(p_supplier_name),
      NULLIF(btrim(COALESCE(p_order_number, '')), ''),
      NULLIF(btrim(COALESCE(p_model, '')), ''),
      p_quantity,
      v_status,
      p_ordered_at,
      v_lead,
      v_eta,
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      v_uid,
      v_uid
    )
    RETURNING id INTO v_id;

    IF p_unit_price_cents IS NOT NULL
       OR p_shipping_cents IS NOT NULL
       OR p_total_cents IS NOT NULL THEN
      INSERT INTO public.kiosk_purchase_order_costs (
        purchase_order_id, unit_price_cents, shipping_cents, total_cents
      ) VALUES (
        v_id, p_unit_price_cents, p_shipping_cents, p_total_cents
      );
    END IF;
  ELSE
    SELECT * INTO v_row FROM public.kiosk_purchase_orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'not_found');
    END IF;
    IF v_row.status = 'cancelado' AND NOT p_cancel THEN
      RETURN jsonb_build_object('status', 'cancelled');
    END IF;
    IF p_quantity IS NOT NULL AND p_quantity < v_row.received_quantity THEN
      RETURN jsonb_build_object('status', 'quantity_below_received');
    END IF;

    v_lead := COALESCE(p_delivery_lead_months, v_row.delivery_lead_months);
    v_eta := public.ff_kiosk_po_compute_eta(
      COALESCE(p_ordered_at, v_row.ordered_at),
      v_lead
    );

    UPDATE public.kiosk_purchase_orders SET
      supplier_name = COALESCE(NULLIF(btrim(COALESCE(p_supplier_name, '')), ''), supplier_name),
      order_number = CASE
        WHEN p_order_number IS NULL THEN order_number
        ELSE NULLIF(btrim(p_order_number), '')
      END,
      model = CASE
        WHEN p_model IS NULL THEN model
        ELSE NULLIF(btrim(p_model), '')
      END,
      quantity = COALESCE(p_quantity, quantity),
      ordered_at = COALESCE(p_ordered_at, ordered_at),
      delivery_lead_months = v_lead,
      estimated_delivery_at = v_eta,
      notes = CASE
        WHEN p_notes IS NULL THEN notes
        ELSE NULLIF(btrim(p_notes), '')
      END,
      status = CASE
        WHEN p_cancel THEN 'cancelado'
        WHEN p_mark_as_ordered AND status IN ('preparado') THEN 'pedido'
        ELSE status
      END,
      updated_by = v_uid,
      updated_at = pg_catalog.now()
    WHERE id = p_id;

    IF p_unit_price_cents IS NOT NULL
       OR p_shipping_cents IS NOT NULL
       OR p_total_cents IS NOT NULL THEN
      INSERT INTO public.kiosk_purchase_order_costs (
        purchase_order_id, unit_price_cents, shipping_cents, total_cents
      ) VALUES (
        p_id, p_unit_price_cents, p_shipping_cents, p_total_cents
      )
      ON CONFLICT (purchase_order_id) DO UPDATE SET
        unit_price_cents = COALESCE(
          EXCLUDED.unit_price_cents,
          kiosk_purchase_order_costs.unit_price_cents
        ),
        shipping_cents = COALESCE(
          EXCLUDED.shipping_cents,
          kiosk_purchase_order_costs.shipping_cents
        ),
        total_cents = COALESCE(
          EXCLUDED.total_cents,
          kiosk_purchase_order_costs.total_cents
        ),
        updated_at = pg_catalog.now();
    END IF;

    IF NOT p_cancel THEN
      PERFORM public.ff_kiosk_po_refresh_status(p_id);
    END IF;
    v_id := p_id;
  END IF;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid, NULL, 'kiosk_purchasing.upsert_order', 'kiosk_purchase_orders', v_id::text,
    jsonb_build_object('cancel', p_cancel, 'mark_as_ordered', p_mark_as_ordered)
  );

  RETURN jsonb_build_object('status', 'ok', 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_purchase_order_upsert_v1(
  uuid, text, text, text, integer, date, integer, integer, integer, integer, text, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_purchase_order_upsert_v1(
  uuid, text, text, text, integer, date, integer, integer, integer, integer, text, boolean, boolean
) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: registrar documento (metadatos; el upload a Storage lo hace la app)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_purchase_order_add_document_v1(
  p_purchase_order_id uuid,
  p_doc_type text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text DEFAULT NULL,
  p_byte_size integer DEFAULT NULL,
  p_replace_document_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_purchasing.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_doc_type NOT IN ('supplier_quote', 'order_confirmation', 'invoice') THEN
    RETURN jsonb_build_object('status', 'invalid_doc_type');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kiosk_purchase_orders WHERE id = p_purchase_order_id
  ) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_replace_document_id IS NOT NULL THEN
    UPDATE public.kiosk_purchase_order_documents
    SET is_current = false
    WHERE id = p_replace_document_id
      AND purchase_order_id = p_purchase_order_id;
  END IF;

  INSERT INTO public.kiosk_purchase_order_documents (
    purchase_order_id, doc_type, storage_path, file_name, mime_type, byte_size,
    replaces_document_id, is_current, uploaded_by
  ) VALUES (
    p_purchase_order_id,
    p_doc_type,
    btrim(p_storage_path),
    btrim(p_file_name),
    NULLIF(btrim(COALESCE(p_mime_type, '')), ''),
    p_byte_size,
    p_replace_document_id,
    true,
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('status', 'ok', 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_purchase_order_add_document_v1(
  uuid, text, text, text, text, integer, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_purchase_order_add_document_v1(
  uuid, text, text, text, text, integer, uuid
) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: recepción parcial/completa ligada al pedido → crea activos (sin duplicar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_purchase_receive_v1(
  p_purchase_order_id uuid,
  p_count integer,
  p_received_at date DEFAULT CURRENT_DATE,
  p_serials text[] DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_po public.kiosk_purchase_orders%ROWTYPE;
  v_remaining int;
  v_i int;
  v_serial text;
  v_id uuid;
  v_code text;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_codes text[] := ARRAY[]::text[];
  v_receipt_id uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  -- Recepción operativa: inventory.write O purchasing.write
  IF NOT (
    public.ff_has_platform_permission('platform.kiosk_inventory.write')
    OR public.ff_has_platform_permission('platform.kiosk_purchasing.write')
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_po
  FROM public.kiosk_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_po.status = 'cancelado' THEN
    RETURN jsonb_build_object('status', 'cancelled');
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN
    RETURN jsonb_build_object('status', 'invalid_count');
  END IF;

  v_remaining := v_po.quantity - v_po.received_quantity;
  IF p_count > v_remaining THEN
    RETURN jsonb_build_object(
      'status', 'exceeds_remaining',
      'remaining', v_remaining
    );
  END IF;
  IF p_serials IS NOT NULL AND cardinality(p_serials) > 0
     AND cardinality(p_serials) IS DISTINCT FROM p_count THEN
    RETURN jsonb_build_object('status', 'serials_count_mismatch');
  END IF;

  FOR v_i IN 1..p_count LOOP
    v_serial := NULL;
    IF p_serials IS NOT NULL AND cardinality(p_serials) >= v_i THEN
      v_serial := NULLIF(btrim(p_serials[v_i]), '');
    END IF;

    v_code := public.ff_kiosk_asset_next_code();
    INSERT INTO public.kiosk_assets (
      asset_code, equipment_serial, model, vendor, received_at,
      purchase_order_ref, purchase_order_id, status, notes, created_by, updated_by
    ) VALUES (
      v_code,
      v_serial,
      v_po.model,
      v_po.supplier_name,
      COALESCE(p_received_at, CURRENT_DATE),
      v_po.order_number,
      v_po.id,
      CASE WHEN v_serial IS NULL THEN 'pending_identification' ELSE 'warehouse' END,
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      v_uid,
      v_uid
    )
    RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
    v_codes := array_append(v_codes, v_code);
  END LOOP;

  UPDATE public.kiosk_purchase_orders
  SET
    received_quantity = received_quantity + p_count,
    updated_by = v_uid,
    updated_at = pg_catalog.now()
  WHERE id = v_po.id;

  v_status := public.ff_kiosk_po_refresh_status(v_po.id);

  INSERT INTO public.kiosk_purchase_receipts (
    purchase_order_id, quantity, received_at, asset_ids, notes, created_by
  ) VALUES (
    v_po.id, p_count, COALESCE(p_received_at, CURRENT_DATE), v_ids,
    NULLIF(btrim(COALESCE(p_notes, '')), ''), v_uid
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid, NULL, 'kiosk_purchasing.receive', 'kiosk_purchase_orders', v_po.id::text,
    jsonb_build_object(
      'receipt_id', v_receipt_id,
      'count', p_count,
      'codes', to_jsonb(v_codes),
      'status', v_status
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'count', p_count,
    'asset_ids', to_jsonb(v_ids),
    'asset_codes', to_jsonb(v_codes),
    'receipt_id', v_receipt_id,
    'order_status', v_status
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'duplicate_serial');
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_purchase_receive_v1(
  uuid, integer, date, text[], text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_purchase_receive_v1(
  uuid, integer, date, text[], text
) TO authenticated, service_role;
