# Migración 071 — doble rol staff | customer | both

## Estado

**No aplicar** en producción ni staging sin autorización expresa.

## Dependencias

- `064_customer_accounts_v1.sql`
- `067_customer_saved_pharmacies_v1.sql`
- `024_accept_pharmacy_membership_v1.sql` (071 reemplaza el cuerpo de accept)

## Aplicación (cuando se autorice)

1. Backup lógico de `profiles` (`id`, `account_kind`) y conteos de memberships.
2. Ejecutar `supabase/migrations/071_dual_role_customer_staff_v1.sql`.
3. Verificar CHECK, `ff_customer_enable_self_v1`, `ff_accept_pharmacy_membership_v1` (customer→both), helper y RPCs 067.
4. Smoke con usuarios de laboratorio (no `pruebas@farmafacil.solutions`).

## Orden app ↔ SQL

- **Preferido:** 071 → smoke → deploy app (misma ventana).
- **Tolerante:** app primero (activación falla con `migration_missing`) → luego 071.

## Recovery

Ver `071_DOWN_recovery.sql`.

- Si hay filas `both`, el script **aborta** (no degrada en silencio).
- El modelo XOR no puede representar dual sin perder panel o cliente.
- **Recuperación hacia delante:** permanecer en 071; corregir con parches; no volver a XOR si ya hay `both`.
- Nunca borrar memberships, roles SA, direcciones, pedidos ni Mis farmacias en un DOWN.

### Degradación admin excepcional

Solo con JWT `platform.users.write` **y**  
`SELECT set_config('ff.allow_account_kind_change', 'platform_admin_v1', true);`  
antes del UPDATE. Documentar y auditar cada caso.

## Notas de seguridad

Ver `071_SECURITY_NOTES.md`.
