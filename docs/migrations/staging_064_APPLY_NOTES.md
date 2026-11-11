# Staging — `customer_profile_id` mínimo (panel Clientes)

## Auditoría previa (2026-11-11)

| Objeto | Staging |
|--------|---------|
| `pharmacy_orders.customer_profile_id` | ausente |
| `profiles.account_kind` | ausente |
| `customer_addresses` / `customer_saved_pharmacies` | ausentes |
| `ff_customer_claim_order_v1` / `ff_profile_is_customer_kind` | ausentes |
| `ff_public_catalog_create_request_v1` | 7 args (pre-072) |
| `kiosk_assets` (065) | presente |
| `pharmacy_providers` (PR#21) | ausente |

## SQL mínimo aplicado

`staging_064_customer_profile_id_MINIMAL.sql` — solo columna, índice y políticas SELECT cliente.

**No** se aplican 065 (ya existe), 067, 071, 072 ni el resto de 064 (account_kind / claim / addresses): el listado tenant solo lee `pharmacy_orders` con RLS `orders.view`.

## Recovery

`staging_064_customer_profile_id_DOWN.sql`

## Fuera de alcance

- PR #21 / #22
- Producción
- Copia de datos entre entornos
