# Staging — aplicar 065 (inventario físico) tras 076–080

## Contexto

En staging (`dazfdcjscnpfvhcyjddt`) ya existen **076–080** (proveedores / pedidos /
extensión kiosk / numeración), pero **faltaba 065** (`kiosk_assets`,
`ff_kiosk_asset_next_code`). La RPC `ff_kiosk_purchase_receive_v1` (076) depende
de esos objetos.

En producción (`gsnohwsvjxpjfcsstnfd`) ocurre lo inverso: **065 sí**, **076–080 no**.

## Orden seguro en staging

1. Backup lógico de metadatos (conteos / objetos) — no destructivo.
2. Aplicar `065_kiosk_physical_inventory_v1.sql` (idempotente: `IF NOT EXISTS`).
3. Ejecutar el enlace diferido de 076 (porque 065 no estaba al aplicar 076):

```sql
ALTER TABLE public.kiosk_assets
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid
    REFERENCES public.kiosk_purchase_orders (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS kiosk_assets_purchase_order_id_idx
  ON public.kiosk_assets (purchase_order_id)
  WHERE purchase_order_id IS NOT NULL;
```

4. Probar recepción solo con datos DEMO.

## Rollback staging 065 (solo si no hay activos reales que conservar)

Ver `065_STAGING_ROLLBACK.md`. No ejecutar en producción.
