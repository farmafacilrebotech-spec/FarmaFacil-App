# Rollback 081 — estados UI inventario

Solo staging / con autorización. **No borra activos ni códigos KSK.**

```sql
BEGIN;

-- Restaurar set_status / receive a la definición previa (065 / 076) si hace falta
-- (reaplicar esos archivos CREATE OR REPLACE), o dejar funciones 081 si se
-- toleran hasta re-deploy.

DROP POLICY IF EXISTS kiosk_asset_status_events_select ON public.kiosk_asset_status_events;
DROP POLICY IF EXISTS kiosk_asset_status_events_insert ON public.kiosk_asset_status_events;
DROP TABLE IF EXISTS public.kiosk_asset_status_events;

-- Si hay filas en exhibition, pasarlas a warehouse antes de quitar el CHECK:
UPDATE public.kiosk_assets SET status = 'warehouse' WHERE status = 'exhibition';

ALTER TABLE public.kiosk_assets DROP CONSTRAINT IF EXISTS kiosk_assets_status_chk;
ALTER TABLE public.kiosk_assets
  ADD CONSTRAINT kiosk_assets_status_chk CHECK (
    status = ANY (ARRAY[
      'pending_identification',
      'warehouse',
      'assigned',
      'repair',
      'retired'
    ])
  );

COMMIT;
```
