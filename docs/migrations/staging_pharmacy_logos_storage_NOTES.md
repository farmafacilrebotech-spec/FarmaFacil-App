# Staging — Storage logos de farmacia (`pharmacy-logos`)

## Hallazgo (auditoría PR #23)

| Pieza | Estado |
|-------|--------|
| Columna `pharmacy_branding.logo_url` | **Existe** (009) + CHECK anti `javascript:`/`data:` |
| RLS `branding.update` | **Existe** (Owner/Admin vía permisos; SuperAdmin `platform.pharmacies.write`) |
| Acción update branding | **Existe** pero **no** escribe `logo_url` |
| UI Personalización → Logo | **Stub** (iniciales + botón sin acción) |
| Bucket Storage + policies | **No existe** en migraciones del repo |
| Upload en app | **No existe** |

## Cambio propuesto (staging first)

Draft SQL: `staging_pharmacy_logos_storage_v1.sql`

- Bucket público `pharmacy-logos` (lectura para cartel PDF / UI).
- Path obligatorio: `{pharmacy_id}/logo.{png|jpg|webp}`.
- Policies: SELECT público del bucket; INSERT/UPDATE/DELETE solo SuperAdmin write **o** `branding.update` sobre el `pharmacy_id` del primer segmento del path.
- Límite 2 MB; MIME `image/png`, `image/jpeg`, `image/webp`.
- **Sin SVG** (no hay sanitizador seguro en app).

## Compatibilidad producción

- **No aplicar en producción** desde este PR.
- No rompe schema de `pharmacy_branding` (solo Storage).
- App: si el bucket no existe, las actions de logo fallan con mensaje claro; colores/settings siguen OK.
- Tras validar en staging: promover el SQL a migración numerada del kernel y aplicar en prod con runbook propio.

## App (este PR)

- Reutiliza `logo_url` + RLS existentes.
- Actions: subir / reemplazar / eliminar.
- Cartel QR ya consume `pharmacy_branding.logo_url` (sin FarmaFácil de fallback).
