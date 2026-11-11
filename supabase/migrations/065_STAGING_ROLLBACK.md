# Rollback staging de 065 (inventario físico)

**Solo staging.** No ejecutar si ya hay activos KSK de prueba que se quieran conservar
sin borrado autorizado.

```sql
BEGIN;

DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_set_insurance_v1(uuid, text, text, date, date, text);
DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_set_serials_v1(uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_set_status_v1(uuid, text, text);
DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_unassign_v1(uuid, text, text);
DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_assign_v1(uuid, uuid, uuid, text, date, date);
DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_receive_batch_v1(integer, text, text, date, text, text[], text);
DROP FUNCTION IF EXISTS public.ff_kiosk_asset_next_code();

ALTER TABLE public.pharmacy_devices DROP COLUMN IF EXISTS kiosk_asset_id;

DROP TABLE IF EXISTS public.kiosk_asset_insurance_coverages;
DROP TABLE IF EXISTS public.kiosk_asset_assignments;
-- purchase_order_id vive en kiosk_assets; al dropear la tabla desaparece
DROP TABLE IF EXISTS public.kiosk_assets;
DROP SEQUENCE IF EXISTS public.kiosk_asset_code_seq;

-- Permisos (opcional; no rompe 076):
-- DELETE FROM platform_role_permissions WHERE platform_permission_id IN
--   (SELECT id FROM platform_permissions WHERE key LIKE 'platform.kiosk_inventory.%');
-- DELETE FROM platform_permissions WHERE key LIKE 'platform.kiosk_inventory.%';

COMMIT;
```

Nota: la RPC `ff_kiosk_purchase_receive_v1` de 076 permanecerá, pero fallará sin
`kiosk_assets` / `ff_kiosk_asset_next_code`.
