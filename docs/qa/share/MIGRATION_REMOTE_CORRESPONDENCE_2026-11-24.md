# Correspondencia migraciones locales ↔ remotas

**Fecha:** 2026-11-24  
**Regla:** no alterar `schema_migrations` remoto ni resets.

| Local (cadena limpia) | Staging (posible registro) | Prod | Notas |
|-----------------------|----------------------------|------|-------|
| `079_unify_…` | `079` / unify | verificar | Schema |
| *(one_shot)* `one_shots/staging/079_STAGING_REMEDIATE_…` | pudo registrarse como `079_STAGING_…` o apply manual | **Nunca** | Fuera del runner |
| `082_kiosk_status_notes_…` | `082` | verificar | |
| `083_commercial_…` **(incluye ex-083_00 / draft 056)** | `083` y/o `083_00` y/o draft 056 | verificar | Sección A idempotente |
| `084`…`088` | según applied | verificar | |
| `089` taxonomy | **aplicar** tras auth Bloque 4 | no | |
| `090` import jobs | **aplicar** tras auth Bloque 4 | no | |
| `091` P0 claim fail-closed | proposed apply 2026-11-24; registrar si procede | **applied** via proposed 2026-11-24 | Idempotente |

## Fresh local

Orden: `… → 079_unify → … → 082 → 083(A+C) → 084…088 → 089 → 090 → 091`.

Sin ficheros `*_STAGING_*` en `migrations/`.
