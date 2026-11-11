-- STAGING recovery: deshace el fragmento mínimo customer_profile_id.
-- NO ejecuta DROP COLUMN si aún hay filas vinculadas (protege datos de lab).

BEGIN;

DROP POLICY IF EXISTS pharmacy_order_items_select_own_customer ON public.pharmacy_order_items;
DROP POLICY IF EXISTS pharmacy_orders_select_own_customer ON public.pharmacy_orders;

DO $$
DECLARE
  n bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pharmacy_orders'
      AND column_name = 'customer_profile_id'
  ) THEN
    SELECT count(*) INTO n
    FROM public.pharmacy_orders
    WHERE customer_profile_id IS NOT NULL;
    IF n > 0 THEN
      RAISE EXCEPTION
        'Abort DOWN: % pedidos tienen customer_profile_id. Anula vínculos antes o conserva la columna.',
        n;
    END IF;
    DROP INDEX IF EXISTS public.pharmacy_orders_customer_profile_id_idx;
    ALTER TABLE public.pharmacy_orders DROP COLUMN customer_profile_id;
  END IF;
END $$;

COMMIT;
