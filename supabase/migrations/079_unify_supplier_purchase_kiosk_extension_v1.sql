-- =============================================================================
-- 079_unify_supplier_purchase_kiosk_extension_v1.sql
-- Unifica compras internas: el pedido económico (platform_supplier_purchase_orders)
-- es la fuente de verdad; kiosk_purchase_orders es extensión operativa 1:1.
-- NO destructivo. NO APLICAR en producción sin autorización.
-- =============================================================================

-- Enlace 1:1 al pedido general (compra económica)
ALTER TABLE public.kiosk_purchase_orders
  ADD COLUMN IF NOT EXISTS general_purchase_order_id uuid
    REFERENCES public.platform_supplier_purchase_orders (id) ON DELETE SET NULL;

-- Trazabilidad opcional al presupuesto origen (no sustituye quote_id del general)
ALTER TABLE public.kiosk_purchase_orders
  ADD COLUMN IF NOT EXISTS source_quote_id uuid
    REFERENCES public.platform_supplier_quotes (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kiosk_purchase_orders.general_purchase_order_id IS
  'Pedido económico (platform_supplier_purchase_orders) del que esta fila es extensión operativa 1:1. Los importes canónicos viven en el pedido general.';

COMMENT ON COLUMN public.kiosk_purchase_orders.source_quote_id IS
  'Presupuesto de proveedor origen (trazabilidad). No autoriza por sí solo la compra.';

-- Un pedido general activo solo puede tener una extensión kiosk no cancelada
CREATE UNIQUE INDEX IF NOT EXISTS kiosk_po_active_general_uidx
  ON public.kiosk_purchase_orders (general_purchase_order_id)
  WHERE general_purchase_order_id IS NOT NULL AND status <> 'cancelado';

-- Un presupuesto solo puede tener una extensión kiosk activa (anti doble clic legacy)
CREATE UNIQUE INDEX IF NOT EXISTS kiosk_po_active_quote_uidx
  ON public.kiosk_purchase_orders (source_quote_id)
  WHERE source_quote_id IS NOT NULL AND status <> 'cancelado';

CREATE INDEX IF NOT EXISTS kiosk_po_general_idx
  ON public.kiosk_purchase_orders (general_purchase_order_id)
  WHERE general_purchase_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kiosk_po_source_quote_idx
  ON public.kiosk_purchase_orders (source_quote_id)
  WHERE source_quote_id IS NOT NULL;
