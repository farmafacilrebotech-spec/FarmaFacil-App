# Runbook de publicación — doble rol (071 + app)

**No ejecutar hasta autorización expresa.**  
Proyecto prod: `gsnohwsvjxpjfcsstnfd`.  
PR / rama: `feature/dual-role-customer-staff`.

## Orden recomendado

1. Respaldo + preflight (lectura).
2. **Merge PR + deploy Vercel de la app** (gates dual-role vivos; RPC 071 aún ausente → activación muestra `migration_missing`).
3. Aplicar **071 en una sola transacción**.
4. Verificaciones SQL + smoke UI.
5. Monitorizar `account_kind = 'both'`.

Alternativa (SQL primero): solo si el deploy de app sigue **en minutos**. En ese caso, tras COMMIT de 071 y **antes** del deploy:

```sql
REVOKE EXECUTE ON FUNCTION public.ff_customer_enable_self_v1(boolean, boolean, text, text, text)
  FROM authenticated;
```

Tras deploy Ready:

```sql
GRANT EXECUTE ON FUNCTION public.ff_customer_enable_self_v1(boolean, boolean, text, text, text)
  TO authenticated, service_role;
```

(`ff_accept_pharmacy_membership_v1` puede crear `both` al aceptar invite; el intervalo debe ser mínimo.)

## 1) Respaldo y preflight (solo lectura)

```sql
-- Confirmar proyecto / no staging
SELECT current_database(), current_user;

SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'profiles_account_kind_chk';
-- Esperado XOR: staff|customer

SELECT account_kind, count(*) FROM public.profiles GROUP BY 1 ORDER BY 1;
-- both = 0

SELECT to_regclass('public.customer_addresses') IS NOT NULL AS addresses,
       to_regclass('public.customer_saved_pharmacies') IS NOT NULL AS saved,
       to_regprocedure('public.ff_customer_enable_self_v1(boolean,boolean,text,text,text)') IS NOT NULL AS has_071;
-- addresses/saved true; has_071 false

SELECT count(*) AS active_memberships FROM public.pharmacy_memberships WHERE status = 'active';
SELECT count(*) AS platform_roles FROM public.platform_user_roles;
```

Exportar snapshot lógico opcional: `profiles (id, email, account_kind)`, conteos memberships.

## 2) Aplicación transaccional de 071

Desde el worktree (session pooler / direct, no transaction mode 6543 si falla DDL):

```bash
psql "$DATABASE_URL_PROD" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

\i supabase/migrations/071_dual_role_customer_staff_v1.sql

-- Verificaciones intra-transacción
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='public.profiles'::regclass AND conname='profiles_account_kind_chk';
-- debe incluir both

SELECT to_regprocedure('public.ff_customer_enable_self_v1(boolean,boolean,text,text,text)') IS NOT NULL;
SELECT to_regprocedure('public.ff_profile_is_customer_kind(text)') IS NOT NULL;

-- Si algo falla: ROLLBACK; (no COMMIT)
COMMIT;
SQL
```

Todo el DDL de 071 es transaccional (sin `CONCURRENTLY` / `VACUUM`).  
**Obligatorio** `BEGIN`…`COMMIT` (o `ROLLBACK` si falla).

## 3) Verificaciones SQL post-COMMIT

```sql
SELECT account_kind, count(*) FROM public.profiles GROUP BY 1;
SELECT proname FROM pg_proc p
 JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND proname LIKE 'ff_customer%'
 ORDER BY 1;

SELECT polname FROM pg_policy
 WHERE polrelid = 'public.customer_addresses'::regclass;

-- Conteos de negocio sin cambio inesperado
SELECT count(*) FROM public.pharmacy_memberships WHERE status='active';
SELECT count(*) FROM public.platform_user_roles;
```

## 4) Merge + deploy

1. Merge del PR a `main` (autorizado aparte).
2. Esperar Vercel **Ready** en producción.
3. Si se usó REVOKE de enable_self, re-GRANT (arriba).

## 5) Pruebas de acceso (laboratorio; no `pruebas@…` salvo acuerdo)

| Caso | Esperado |
|------|----------|
| Staff → `/cuenta` → activar Cliente | `both`; panel intacto |
| Customer puro | Área cliente; sin panel |
| Customer + accept invite | `both`; panel solo con rol de la membership |
| Invite pending | Sin panel operativo |
| SA / farmacia existentes | Sin regresión |
| Registro metadata `both` | No crea `both` |

Detección gap / abuso:

```sql
SELECT id, email, account_kind, updated_at
FROM public.profiles
WHERE account_kind = 'both'
ORDER BY updated_at DESC;
```

## 6) Recuperación

### Fallo a mitad de 071 (aún en transacción)

`ROLLBACK;` — estado previo intacto.

### Fallo tras COMMIT de 071, deploy app fallido

- App antigua + SQL nuevo: RPC `enable_self` usable; UI antigua no guía bien a `both`.
- Mitigar: `REVOKE EXECUTE … enable_self … FROM authenticated` hasta app Ready.
- **No** ejecutar DOWN si ya hay filas `both` (script aborta). Recuperación hacia delante: arreglar deploy.

### Fallo de migrate con objetos parciales (sin transacción — evitar este modo)

Restaurar desde backup; o completar/reparar hacia delante.  
`071_DOWN_recovery.sql` solo si `both = 0` y se reaplican cuerpos 064/067.

### Rollback de app sin quitar 071

Compatible: app dual-role entiende `staff|customer|both`; SQL 071 puede quedarse.

---

Ver también: `071_APPLY_PROCEDURE.md`, `071_DOWN_recovery.sql`, `071_SECURITY_NOTES.md`.
