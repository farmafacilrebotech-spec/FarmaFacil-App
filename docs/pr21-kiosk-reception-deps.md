# PR #21 — Dependencias de recepción de kioskos

## Staging (`dazfdcjscnpfvhcyjddt`) — actualizado 2026-11-11

- **065 aplicada**: existen `kiosk_assets`, `ff_kiosk_asset_next_code`, permisos inventario.
- Enlace `kiosk_assets.purchase_order_id` → `kiosk_purchase_orders` añadido post-065.
- Recepción DEMO validada: pedido `2026/00000003` → 10 activos `KSK-0001`…`KSK-0010`, reintento sin duplicar.
- **081 aplicada** (exhibition + `kiosk_asset_status_events` + RPC receive/set_status/assign/unassign).
- Smoke INV081: pedido `DEMO-INV081-74766869` → 10 pendientes → recv 6/4 → 10 KSK (`KSK-0023`…) → reintento OK → estados/auditoría OK. Ver `pr21-kiosk-inventory-statuses.md`.

## Producción (`gsnohwsvjxpjfcsstnfd`)

- **065 presente** (inventario físico).
- **076–080 ausentes** (no hay compras/proveedores/numeración). Publicar PR #21 requiere esas migraciones (ver `pr21-go-nogo-publication.md`).

## Circuito

1. Pedido económico en `platform_supplier_purchase_orders` (número al confirmar, 080).
2. Extensión 1:1 `kiosk_purchase_orders` (079) con el mismo `order_number`.
3. `ff_kiosk_purchase_receive_v1` crea activos KSK ligados al pedido kiosk (sin asignar farmacia).

## Política

- No aplicar migraciones en producción sin autorización.
- Asignar un activo a farmacia **no** crea compra a proveedor.
- Datos DEMO no van a producción.
