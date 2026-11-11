# Staging — Storage logos de farmacia (`pharmacy-logos`)

## Estado staging (`dazfdcjscnpfvhcyjddt`) — pre-apply

| Pieza | Estado |
|-------|--------|
| Columna `pharmacy_branding.logo_url` | Existe |
| Bucket `pharmacy-logos` | **Ausente** (confirmado 2026-11-11) |
| Policies Storage | **Ausentes** |

## SQL a aplicar (solo tras autorización)

Archivo: `staging_pharmacy_logos_storage_v1.sql`

### Objetos que se CREAN / MODIFICAN

| Objeto | Acción |
|--------|--------|
| `storage.buckets` fila `id=pharmacy-logos` | **INSERT** o **UPDATE** (público, 2 MB, png/jpeg/webp) |
| Policy `pharmacy_logos_public_read` | DROP IF EXISTS + **CREATE** (SELECT TO public) |
| Policy `pharmacy_logos_insert` | DROP IF EXISTS + **CREATE** (INSERT, solo `platform.pharmacies.write`) |
| Policy `pharmacy_logos_update` | DROP IF EXISTS + **CREATE** (UPDATE, solo SA write) |
| Policy `pharmacy_logos_delete` | DROP IF EXISTS + **CREATE** (DELETE, solo SA write) |

### Qué NO toca

- Tablas `pharmacies` / `pharmacy_branding` / pedidos / clientes
- Producción `gsnohwsvjxpjfcsstnfd`
- Datos existentes (no DELETE de filas de negocio)
- PR #21

### Seguridad de escritura

Solo SuperAdmin con `platform.pharmacies.write`.  
**No** Owner / Admin / Farmacéutico / STAFF vía `branding.update`.

Path: `{pharmacy_id}/logo.{png|jpg|webp}`.

## Rollback

`staging_pharmacy_logos_storage_DOWN.sql` (borra policies + bucket; no borra objetos del bucket automáticamente).

## App

- Actions: `app/(app)/farmacias/logo-actions.ts` (gate SuperAdmin).
- UI gestión: ficha SuperAdmin Personalización.
- Panel tenant: solo lectura del logo (sin subir/borrar).
