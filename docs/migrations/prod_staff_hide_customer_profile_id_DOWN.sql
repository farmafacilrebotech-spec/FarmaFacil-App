-- =============================================================================
-- PRODUCCIÓN — rollback staff_hide customer_profile_id
-- Proyecto: gsnohwsvjxpjfcsstnfd
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.ff_list_my_customer_orders_v1(integer);
DROP FUNCTION IF EXISTS public.ff_get_pharmacy_linked_client_v1(uuid, uuid);
DROP FUNCTION IF EXISTS public.ff_list_pharmacy_linked_clients_v1(uuid, integer);
DROP FUNCTION IF EXISTS public.ff_pharmacy_can_view_linked_clients(uuid);

GRANT SELECT ON public.pharmacy_orders TO authenticated, anon;

COMMIT;
