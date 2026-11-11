# Staging — ocultar `customer_profile_id` a STAFF (PostgREST)

## Hallazgo

Con `orders.view`, STAFF puede `SELECT` todas las columnas de `pharmacy_orders`, incluido `customer_profile_id`, y enumerar UUIDs de clientes vinculados.

**Legítimo para pedidos:** `customer_name`, `customer_phone`, `customer_note` (contacto del pedido).

**No necesario para STAFF:** `customer_profile_id` (vínculo a cuenta global / directorio).

**No accesible:** fichas `profiles` de clientes (RLS `ff_can_view_profile`), tablas `customer_addresses` / `customer_saved_pharmacies` (ausentes en staging), pedidos de otras farmacias.

## Corrección (staging)

1. `staging_staff_hide_customer_profile_id_v1.sql` — RPCs + helper de rol.
2. `staging_staff_hide_customer_profile_id_v1b.sql` — `REVOKE SELECT` de tabla + `GRANT SELECT` por columnas **sin** `customer_profile_id` (un `REVOKE` solo de columna no basta si existe grant de tabla).
3. App Clientes consume las RPC (fallback a SELECT directo si faltan).

Pedidos de STAFF no seleccionan `customer_profile_id` → no se rompen.
