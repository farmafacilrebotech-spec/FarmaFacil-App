# FarmaFácil — Kernel Supabase (fase 1, revisión arquitectónica)

Propuesta SQL del **kernel multi-tenant** según ADR-001 + revisión de suscripciones, branding, entrypoints, soft-delete y permisos.

> **Estado:** revisable, **no aplicada**.  
> No ejecutar contra staging/producción hasta aprobación expresa.

## Árbol de archivos

```text
supabase/
  README.md
  seed.sql
  migrations/
    001_extensions_and_utilities.sql
    002_platform_rbac.sql
    003_profiles.sql
    004_pharmacy_rbac.sql
    005_plans_modules.sql
    006_pharmacies.sql
    007_memberships_entitlements.sql
    008_subscriptions.sql          ← nuevo
    009_pharmacy_configuration.sql
    010_audit_activity.sql
    011_rls_helpers.sql
    012_rls_policies.sql
```

## Orden de ejecución

| # | Archivo | Finalidad |
|---|---------|-----------|
| 1 | `001_extensions_and_utilities.sql` | `pgcrypto`, `ff_set_updated_at`, `ff_is_safe_internal_route` |
| 2 | `002_platform_rbac.sql` | Roles/permisos de plataforma |
| 3 | `003_profiles.sql` | Profiles + `platform_user_roles` + triggers Auth |
| 4 | `004_pharmacy_rbac.sql` | Roles/permisos de farmacia |
| 5 | `005_plans_modules.sql` | Plans, modules, plan_modules |
| 6 | `006_pharmacies.sql` | Pharmacies + soft-archive + FK `last_pharmacy_id` |
| 7 | `007_memberships_entitlements.sql` | Memberships + entitlements |
| 8 | `008_subscriptions.sql` | Suscripciones provider-agnostic |
| 9 | `009_pharmacy_configuration.sql` | Branding, settings, public_entrypoints |
| 10 | `010_audit_activity.sql` | audit_logs + activity_events |
| 11 | `011_rls_helpers.sql` | Helpers DEFINER + contadores entrypoint |
| 12 | `012_rls_policies.sql` | ENABLE RLS + policies |
| 13 | `seed.sql` | Catálogos idempotentes (sin usuarios/farmacias) |

---

## Tablas finales (20) y finalidad

| Tabla | Finalidad |
|-------|-----------|
| `profiles` | Perfil de app 1:1 con `auth.users` |
| `platform_roles` | Roles globales |
| `platform_permissions` | Permisos globales |
| `platform_role_permissions` | N:M plataforma |
| `platform_user_roles` | Asignación SuperAdmin/Support (única vía) |
| `roles` | Roles de farmacia |
| `permissions` | Permisos de farmacia |
| `role_permissions` | N:M farmacia |
| `plans` | Planes comerciales |
| `modules` | Catálogo de módulos |
| `plan_modules` | Composición plan→módulos + límites |
| `pharmacies` | Tenants |
| `pharmacy_memberships` | Acceso usuario↔farmacia |
| `pharmacy_entitlements` | Módulos activos por farmacia |
| `subscriptions` | Ciclo de vida comercial / PSP |
| `pharmacy_branding` | Identidad visual por tenant |
| `pharmacy_settings` | Ajustes operativos |
| `public_entrypoints` | Destinos públicos (QR) internos |
| `audit_logs` | Auditoría inmutable |
| `activity_events` | Timeline de producto |

---

## Suscripciones (estrategia)

- Tabla `subscriptions` **desacoplada del PSP**: `provider` (`manual`, `stripe`, …) + IDs externos opcionales.
- Estados: `trialing | active | past_due | paused | cancelled | expired`.
- Sin hard delete: cancelar/expirar.
- Como máximo **una** suscripción “corriente” por farmacia (índice único parcial).
- Unique parcial `(provider, provider_subscription_id)` cuando el ID externo existe.
- Lectura: plataforma (`subscriptions.read|manage`) o miembro active con `pharmacy.view`.
- Escritura: solo `platform.subscriptions.manage` (webhooks/admin en servidor con service_role también).
- Relación con `pharmacy_entitlements`: la suscripción representa el **contrato comercial**; los entitlements representan **capacidades activas**. El alta de farmacia (futuro Server Action) puede crear ambos; no se fusionan en una sola tabla.

---

## Soft delete / ciclo de vida

| Entidad | Mecanismo | ¿archived_at/by? | Motivo |
|---------|-----------|------------------|--------|
| `pharmacies` | `status` (+ `suspended_at`) + **`archived` / `archived_at` / `archived_by`** | Sí | Tenant de negocio; archivado formal |
| `pharmacy_memberships` | `invited\|active\|suspended\|revoked` | No | Status basta; no es borrado de dominio |
| `pharmacy_entitlements` | `active\|trial\|suspended\|cancelled` | No | Desactivar módulo sin borrar datos futuros |
| `subscriptions` | estados + `cancelled_at` | No | Ciclo PSP; no hard delete |
| `public_entrypoints` | `is_active` + `expires_at` | No | Desactivar/expirar QR |
| `profiles` | `is_active` | No | Baja operativa de cuenta app |
| `audit_logs` | inmutable | No | Nunca borrar |
| Catálogos / puentes | N/A | No | No tiene sentido archivar seeds |

**Prohibido hard delete normal:** pharmacies, pharmacy_memberships, pharmacy_entitlements, subscriptions, audit_logs.

---

## Branding

`pharmacy_branding` soporta: `logo_url`, `primary_color`, `secondary_color`, `accent_color`, `font_family`, `border_radius` (0–64 px), `kiosk_wallpaper_url`, `welcome_message`.

Validaciones SQL: hex `#RRGGBB`, rechazo de esquemas `javascript:`/`data:`/`vbscript:` en URLs.

---

## public_entrypoints

Campos añadidos: `expires_at`, `is_active`, `access_count`, `last_access_at`.

Restricciones mantenidas:
- `public_id` URL-safe estable
- `purpose` restringido
- `internal_route` solo path interno (`ff_is_safe_internal_route`)
- sin policy `anon`
- resolución pública futura: **Route Handler + `service_role`**

Contadores:
- Trigger `ff_protect_entrypoint_access_fields` impide que `authenticated` altere `access_count` / `last_access_at`.
- Función `ff_record_entrypoint_access(public_id)` (**solo `service_role`**) incrementa contadores tras validar activo/no expirado/ruta interna.

---

## Catálogo de permisos (23)

### Plataforma (12)

| Key | Notas |
|-----|-------|
| `platform.pharmacies.read` | Mantenido |
| `platform.pharmacies.write` | Mantenido |
| `platform.users.read` | Mantenido |
| `platform.users.write` | Mantenido |
| `platform.plans.read` | Mantenido (Support) |
| `platform.plans.write` | Mantenido |
| `platform.subscriptions.read` | **Añadido** |
| `platform.subscriptions.manage` | **Añadido** |
| `platform.entitlements.manage` | Mantenido |
| `platform.audit.read` | Mantenido |
| `platform.support.enter_pharmacy_context` | Mantenido |
| `platform.admins.manage` | Mantenido |

### Farmacia (11)

| Key | Notas |
|-----|-------|
| `pharmacy.view` | Mantenido |
| `memberships.view` / `memberships.manage` | Mantenido (par view/manage) |
| `branding.view` / `branding.update` | Mantenido |
| `settings.view` / `settings.update` | Mantenido |
| `entrypoints.view` / `entrypoints.manage` | Mantenido |
| `activity.view` | Mantenido |
| `audit.view` | Mantenido |

**Cambios de catálogo:**
- **Añadidos:** `platform.subscriptions.read`, `platform.subscriptions.manage`.
- **Eliminados:** ninguno (el catálogo previo ya era funcional y no hipergranular).
- **Agrupados / renombrados:** ninguno en esta revisión.
- **Total:** 12 plataforma + 11 farmacia = **23** permisos.

Roles:
- Plataforma: `PLATFORM_SUPERADMIN`, `PLATFORM_SUPPORT`
- Farmacia: `PHARMACY_OWNER`, `PHARMACY_ADMIN`, `PHARMACIST`, `STAFF`

---

## Campos de trazabilidad operativa

| Tabla | Campos | Motivo |
|-------|--------|--------|
| `pharmacies` | `created_by`, `updated_by`, `archived_by` | Alta/edición/archivo tenant |
| `pharmacy_memberships` | `invited_by`, `updated_by` | Invitación y cambios de estado/rol |
| `pharmacy_entitlements` | `created_by`, `updated_by` | Cambios comerciales |
| `subscriptions` | `created_by`, `updated_by` | Gestión de suscripción |
| `public_entrypoints` | `created_by`, `updated_by` | Alta/edición de QR |
| `pharmacy_branding` | `updated_by` | Quién cambió la identidad visual |
| `pharmacy_settings` | `updated_by` | Quién cambió ajustes |

**No añadidos** a catálogos, puentes (`*_role_permissions`, `plan_modules`) ni `audit_logs` / `activity_events` (estos últimos ya son trazabilidad).

FK → `profiles` con `ON DELETE SET NULL` para no destruir histórico.

---

## Estrategia RLS

- RLS ON en las **20** tablas.
- Sin `USING (true)` / `WITH CHECK (true)` para `authenticated`.
- Acceso tenant solo con membresía **`active`**.
- SuperAdmin solo vía `platform_user_roles` → permisos (nunca email / booleano).
- `last_pharmacy_id` = preferencia UI; trigger valida coherencia; **nunca** autoriza.
- `audit_logs`: sin INSERT/UPDATE/DELETE policies; escritura vía `ff_write_audit_log` o service_role.
- Entrypoints públicos: sin anon; contadores solo service_role.
- Entitlements/límites comerciales: helpers + enforcement en Server Actions futuras.

---

## Funciones SECURITY DEFINER y EXECUTE

| Función | Quién ejecuta |
|---------|----------------|
| `ff_handle_new_user` / `ff_sync_profile_email` | `supabase_auth_admin`, `service_role` |
| `ff_is_platform_user`, `ff_has_platform_permission`, `ff_is_active_member`, `ff_has_any_active_membership`, `ff_has_pharmacy_permission`, `ff_pharmacy_has_module`, `ff_can_read_pharmacy` | `authenticated`, `service_role` |
| `ff_write_audit_log`, `ff_record_activity_event` | `authenticated`, `service_role` (con authz interna) |
| `ff_is_service_role` | `service_role` |
| `ff_validate_last_pharmacy_preference` | trigger (`postgres`/`service_role`) |
| `ff_protect_entrypoint_access_fields` | trigger |
| `ff_record_entrypoint_access` | **solo `service_role`** |

Todas DEFINER: `SET search_path = pg_catalog, public` + `REVOKE … FROM PUBLIC`.

INVOKER: `ff_set_updated_at`, `ff_is_safe_internal_route`.

---

## Seeds

Solo catálogos (roles, permisos, matrices, módulos core, planes, plan_modules).  
**Sin** usuarios, farmacias, suscripciones ni datos demo.

---

## Crear primer SuperAdmin (manual, tras aplicar)

1. Crear usuario en Auth (Dashboard / Admin API con service role).
2. El trigger crea `profiles` **sin roles**.
3. Asignar rol:

```sql
INSERT INTO public.platform_user_roles (profile_id, platform_role_id)
SELECT '<PROFILE_UUID>'::uuid, r.id
FROM public.platform_roles r
WHERE r.key = 'PLATFORM_SUPERADMIN'
ON CONFLICT DO NOTHING;
```

---

## Qué no ejecutar desde el navegador

- `service_role`
- Admin Auth
- Asignación `platform_user_roles`
- `ff_record_entrypoint_access`
- INSERT directo en `audit_logs`
- Bypass de límites comerciales

## Qué requiere service_role

- Alta Auth administrativa
- Bootstrap SuperAdmin (SQL privilegiado)
- Route Handler de QR (`ff_record_entrypoint_access` + lectura entrypoint)
- Webhooks de pago que actualicen `subscriptions`
- Orquestación transaccional de alta de farmacia (futuro)

---

## Diferencias vs versión anterior del SQL

1. Nueva migración `008_subscriptions.sql` (renumeración 008→012).
2. `pharmacies`: `archived` + `archived_at`/`archived_by` + `updated_by`.
3. Memberships/entitlements: `updated_by` / `created_by` selectivos.
4. Branding ampliado (colores, tipografía, kiosk, validaciones).
5. Entrypoints: `expires_at`, contadores protegidos, función service-only.
6. Permisos: +`platform.subscriptions.read|manage`.
7. RLS policies para `subscriptions`.
8. README actualizado con decisiones de ciclo de vida y trazabilidad.

---

## Preparado para módulos futuros (sin implementarlos)

El kernel no bloquea: clientes, catálogo, pedidos, promociones, kiosco, pagos, importaciones, IA, tickets.  
Se añadirán tablas tenant con `pharmacy_id` + RLS por membresía active + entitlements de módulo cuando corresponda.

---

## Checklist de seguridad post-aplicación (cuando se apruebe)

1. RLS true en las 20 tablas.
2. Usuario sin vínculo → 0 farmacias.
3. Membresía suspended/invited/revoked → sin acceso tenant.
4. INSERT directo `audit_logs` como authenticated → fail.
5. UPDATE `public_entrypoints.access_count` como authenticated → valor restaurado por trigger.
6. `ff_record_entrypoint_access` como authenticated → fail.
7. `internal_route = 'https://evil'` → CHECK fail.
8. No existe `profiles.is_superadmin`.
9. Profile nuevo ∉ `platform_user_roles`.

---

## Reversión en desarrollo

Cada migración incluye comentarios `-- DOWN`. Orden inverso: 012 → 001. Preferible reset de DB local; **nunca** reset en producción.
