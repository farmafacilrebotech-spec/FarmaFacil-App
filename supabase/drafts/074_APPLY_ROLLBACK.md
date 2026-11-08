# 074 — Aplicación y recuperación (permisos catálogo)

**No aplicar sin autorización explícita.**

## Dependencias
- `011_rls_helpers.sql` (`ff_has_pharmacy_permission`)
- `028` policies operables (estado actual en prod hasta aplicar 074)
- Roles seed: `PHARMACY_OWNER`, `PHARMACY_ADMIN`, `PHARMACIST`, `STAFF`

## Orden seguro
1. Backup / snapshot de políticas `pharmacy_products_*` y tablas `permissions` / `role_permissions`.
2. Aplicar `supabase/migrations/074_catalog_role_permissions_v1.sql` en staging.
3. Validar estática: `node supabase/drafts/074_static_validate.mjs`.
4. Probar matriz con 4 usuarios (OWNER/ADMIN/PHARMACIST/STAFF) + intento STAFF vía cliente Supabase.
5. Publicar app PR #15 **solo después** de 074 (sin 074, `catalog.*` no existe → escrituras tenant fallan).
6. Repetir en producción con la misma secuencia.

## Recuperación (DOWN)
Ver comentarios al final de `074_catalog_role_permissions_v1.sql`:
- DROP trigger/función `ff_pharmacy_products_enforce_catalog_write_`
- Restaurar policies insert/update de `028` (member activo + operable)
- Opcional: DELETE `role_permissions` / `permissions` de keys `catalog.*`

## Riesgo si se invierte el orden
Merge de app #15 **sin** 074 → `requirePharmacyCatalogAccess(..., manage|stock|view)` niega a todos los tenant → catálogo de farmacia inutilizable.
