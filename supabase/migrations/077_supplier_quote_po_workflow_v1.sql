-- =============================================================================
-- 077_supplier_quote_po_workflow_v1.sql
-- Amplía el flujo Presupuesto → Aceptación → Pedido (076).
-- NO modifica destructivamente datos existentes.
-- NO APLICAR en producción sin autorización.
-- =============================================================================

-- Motivo de rechazo / archivo de presupuestos
ALTER TABLE public.platform_supplier_quotes
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.platform_supplier_quotes
  ADD COLUMN IF NOT EXISTS rejected_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.platform_supplier_quotes
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Estados: añade archivado (mantiene caducado por compatibilidad)
ALTER TABLE public.platform_supplier_quotes
  DROP CONSTRAINT IF EXISTS platform_supplier_quotes_status_chk;

ALTER TABLE public.platform_supplier_quotes
  ADD CONSTRAINT platform_supplier_quotes_status_chk CHECK (
    status IN (
      'recibido',
      'en_revision',
      'aprobado',
      'rechazado',
      'caducado',
      'archivado'
    )
  );

-- Idempotencia al crear pedidos (anti doble clic)
ALTER TABLE public.platform_supplier_purchase_orders
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS platform_spo_client_request_uidx
  ON public.platform_supplier_purchase_orders (client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Un presupuesto aceptado solo puede tener un pedido activo (no cancelado)
CREATE UNIQUE INDEX IF NOT EXISTS platform_spo_active_quote_uidx
  ON public.platform_supplier_purchase_orders (quote_id)
  WHERE quote_id IS NOT NULL AND status <> 'cancelado';

-- Auditoría de transiciones (presupuesto / pedido)
CREATE TABLE IF NOT EXISTS public.platform_supplier_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  supplier_id uuid
    REFERENCES public.platform_suppliers (id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT platform_supplier_status_events_entity_chk CHECK (
    entity_type IN ('quote', 'purchase_order')
  ),
  CONSTRAINT platform_supplier_status_events_to_chk CHECK (length(btrim(to_status)) > 0)
);

CREATE INDEX IF NOT EXISTS platform_supplier_status_events_entity_idx
  ON public.platform_supplier_status_events (entity_type, entity_id, created_at DESC);

ALTER TABLE public.platform_supplier_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_supplier_status_events_select
  ON public.platform_supplier_status_events;
CREATE POLICY platform_supplier_status_events_select
  ON public.platform_supplier_status_events
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.suppliers.read'));

DROP POLICY IF EXISTS platform_supplier_status_events_insert
  ON public.platform_supplier_status_events;
CREATE POLICY platform_supplier_status_events_insert
  ON public.platform_supplier_status_events
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.suppliers.write'));

GRANT SELECT, INSERT ON public.platform_supplier_status_events TO authenticated;

-- Permiso explícito de aceptación/rechazo de presupuesto (separado de compra)
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.suppliers.approve',
    'suppliers',
    'Aceptar o rechazar presupuestos de proveedor (no autoriza por sí solo la compra)'
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
  AND p.key = 'platform.suppliers.approve'
ON CONFLICT DO NOTHING;
