# PR #21 — Inventario kioskos: estados, pendientes y pegatina

## Alcance

- Estados UI: Pedido / Recibido / Asignado / Exposición / Reparación / Retirado.
- Unidades previstas (blancas) = `quantity - received_quantity` de `kiosk_purchase_orders` (sin fila en `kiosk_assets`, sin KSK).
- Activos físicos solo al recibir (`ff_kiosk_purchase_receive_v1`).
- Migración incremental **081** (exhibition + `kiosk_asset_status_events` + RPC).
- Pegatina: logo circular oficial, KSK, QR, serie (o «Serie pendiente»); sin color de estado.

## Staging

- Proyecto: `dazfdcjscnpfvhcyjddt`
- Aplicar: `node scripts/staging-kiosk-inventory-status-smoke.mjs --apply-081`
- Smoke DEMO: mismo script sin flag (si 081 ya aplicada) o con `--apply-081`.
- **No** aplicar en producción. **No** merge/deploy desde este documento.

## Rollback

Ver `supabase/migrations/081_ROLLBACK.md`.

## UI local

Worktree `sa-proveedores` → `http://127.0.0.1:3021/inventario-kioskos` (si el preview está activo).
