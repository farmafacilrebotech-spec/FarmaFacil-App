-- STAGING recovery: restaura SELECT de tabla y elimina RPCs.

BEGIN;

DROP FUNCTION IF EXISTS public.ff_get_pharmacy_linked_client_v1(uuid, uuid);
DROP FUNCTION IF EXISTS public.ff_list_pharmacy_linked_clients_v1(uuid, integer);
DROP FUNCTION IF EXISTS public.ff_pharmacy_can_view_linked_clients(uuid);

-- Volver al modelo previo: SELECT de tabla completa (incluye customer_profile_id)
GRANT SELECT ON public.pharmacy_orders TO authenticated, anon;

INSERT INTO public._ff_staging_recovery_log (label, detail)
VALUES ('staff_hide_customer_profile_id_DOWN', '{}'::jsonb);

COMMIT;
