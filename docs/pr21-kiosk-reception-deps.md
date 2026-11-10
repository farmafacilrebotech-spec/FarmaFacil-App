# PR #21 — Dependencias de recepción de kioskos (staging)

## Qué falta en staging

- La tabla `public.kiosk_assets` **no existe** en staging (`dazfdcjscnpfvhcyjddt`).
- La RPC `ff_kiosk_purchase_receive_v1` (076) inserta en `kiosk_assets` y usa `ff_kiosk_asset_next_code()`.
- Esas piezas pertenecen a la migración **065** (inventario físico de kioskos), no aplicada en staging.

## Qué sí funciona sin 065

- Directorio, presupuestos, pedidos de compra (`platform_supplier_purchase_orders`).
- Extensión operativa `kiosk_purchase_orders` (alta, estados `preparado`/`pedido`, documentos si el bucket existe).
- Unificación 079: enlace `general_purchase_order_id` / `source_quote_id`.

## Qué bloquea la prueba real de recepción

1. Aplicar **065** (y sus dependencias previas) en staging tras revisión explícita.
2. Verificar que 076 ya enlazó `kiosk_assets.purchase_order_id` (bloque condicional en 076).
3. Solo entonces: recepción → códigos KSK → inventario.

## Política

- **No aplicar 065 automáticamente** sin verificar dependencias y compatibilidad.
- Asignar un activo del inventario a una farmacia **no** debe crear una compra a proveedor.
