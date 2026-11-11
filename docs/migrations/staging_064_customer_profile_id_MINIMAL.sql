-- =============================================================================
-- STAGING ONLY — fragmento mínimo de 064 para panel Clientes de farmacia
-- =============================================================================
-- Objetivo: pharmacy_orders.customer_profile_id + índice + políticas SELECT
--           del cliente autenticado (OR con pharmacy_orders_select existente).
--
-- NO incluye: account_kind, customer_addresses, ff_handle_new_user,
--             ff_customer_claim_order_v1, 065/067/071/072, proveedores PR#21.
-- Idempotente. No tocar producción con este script sin autorización aparte.
-- =============================================================================

BEGIN;

ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS customer_profile_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pharmacy_orders.customer_profile_id IS
  'Cliente FarmaFácil autenticado que originó el pedido (nullable para invitados QR).';

CREATE INDEX IF NOT EXISTS pharmacy_orders_customer_profile_id_idx
  ON public.pharmacy_orders (customer_profile_id, created_at DESC)
  WHERE customer_profile_id IS NOT NULL;

DROP POLICY IF EXISTS pharmacy_orders_select_own_customer ON public.pharmacy_orders;
CREATE POLICY pharmacy_orders_select_own_customer ON public.pharmacy_orders
  FOR SELECT TO authenticated
  USING (customer_profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS pharmacy_order_items_select_own_customer ON public.pharmacy_order_items;
CREATE POLICY pharmacy_order_items_select_own_customer ON public.pharmacy_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pharmacy_orders o
      WHERE o.id = pharmacy_order_items.order_id
        AND o.customer_profile_id = (SELECT auth.uid())
    )
  );

COMMIT;
