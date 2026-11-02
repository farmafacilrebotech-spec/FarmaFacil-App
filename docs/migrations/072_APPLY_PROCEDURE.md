# Migración 072 — pedidos QR vinculados a cliente autenticado (opt-in)

## Estado

**No aplicar** en producción ni staging sin autorización.

## Dependencias

- `057_public_catalog_requests_v1.sql`
- `064_customer_accounts_v1.sql` (`customer_profile_id`)
- `071_dual_role_customer_staff_v1.sql` (`ff_profile_is_customer_kind`)

## Contrato RPC

Firma: añade `p_link_to_customer boolean DEFAULT false` (8.º arg).

- `false` / omitido → **nunca** vincula (pedido invitado), aunque haya sesión Auth.
- `true` → vincula `customer_profile_id = auth.uid()` **solo** si `account_kind` es `customer|both`.
- **No** existe parámetro de `customer_profile_id` del cliente.
- Sustituye la firma 057 de 7 args (`DROP` + `CREATE`).

## Aplicación (cuando se autorice)

1. Confirmar 071 (`ff_profile_is_customer_kind` existe).
2. Guardar backup: `SELECT pg_get_functiondef('public.ff_public_catalog_create_request_v1(text,jsonb,text,text,text,boolean,text)'::regprocedure);`
3. En una transacción:

```sql
BEGIN;
\i supabase/migrations/072_customer_linked_qr_orders_v1.sql
-- Verificar: firma 8 args; def incluye p_link_to_customer y linked_to_customer
COMMIT;
```

4. Smoke laboratorio (sin pedidos reales de clientes):
   - Sin sesión → sin `customer_profile_id`.
   - Customer/both + `p_link_to_customer=true` → `customer_profile_id = auth.uid()`.
   - Customer/both + `false` → sin vínculo.

## Orden app ↔ SQL

- **Preferido:** aplicar **072 primero** (default sin vínculo) → deploy app (UI de elección + flag).
- App antes de 072: el RPC con `p_link_to_customer` puede fallar (arg desconocido) → no desplegar app sola.
- 072 sin app nueva: callers 7-arg siguen creando invitados (default false).

## Recovery

Ver `072_DOWN_recovery.sql`.
