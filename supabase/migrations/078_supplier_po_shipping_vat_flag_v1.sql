-- =============================================================================
-- 078_supplier_po_shipping_vat_flag_v1.sql
-- Marca si el transporte del pedido general se introdujo con IVA incluido.
-- NO destructivo. Default false = compatible con pedidos ya creados en staging.
-- NO APLICAR en producción sin autorización.
-- =============================================================================

ALTER TABLE public.platform_supplier_purchase_orders
  ADD COLUMN IF NOT EXISTS shipping_includes_vat boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_supplier_purchase_orders.shipping_includes_vat IS
  'true = shipping_cents incluye IVA; false = shipping_cents es base imponible';
