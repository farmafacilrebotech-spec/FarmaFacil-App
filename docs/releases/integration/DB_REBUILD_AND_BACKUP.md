# Reconstrucción DB + respaldo staging (confirmación)

## Baseline tag

`farmafacil-staging-validated-20261116` @ `8961c23`

## ¿Puede reconstruirse una base nueva con migraciones oficiales?

**Sí, con matices.**

1. En repo existen migraciones oficiales numeradas `supabase/migrations/001_…` … `099_…` (cola crítica de integración **089–099** incluida).
2. Staging actual **no** usa `supabase_migrations.schema_migrations` de aplicación como fuente de verdad; el estado real se valida por **objetos** + `_ff_staging_recovery_log`.
3. Para una **DB vacía / entorno nuevo**:
   - Aplicar la cadena oficial en orden (o restaurar un baseline histórico pre-cola y luego 089–099).
   - **098** y **099** están en repo para ese caso; en staging actual ya están **reconciliadas por contenido** → **no reaplickar a ciegas**.
4. Detalle 098/099: `MIGRATIONS_098_099_STATUS.md`. Mapa 089–099: `MIGRATIONS_MAP_20261116.md`.

## ¿Existe respaldo recuperable de staging?

**Sí.**

Ubicación AgentStores `integration-backups-20261116/staging/`:

| Archivo | Rol |
|---------|-----|
| `public_full.dump` | `pg_dump -Fc` schema `public` (custom format v1.16; `pg_restore -l` OK) |
| `schema_public_auth.sql` | Schema SQL |
| `data_critical.sql` | Datos críticos |
| `RESTORE.md` / `INVENTORY.json` | Procedimiento e inventario |

Checksums SHA-256: `docs/releases/integration/evidence-20261116/staging-dumps.sha256` y AgentStores `e2e-evidence-20261116-8961c23/checksums/`.

Restore de emergencia (solo staging, **nunca producción**):

```bash
pg_restore --no-owner --dbname="$DATABASE_URL" public_full.dump
```

También: git bundle + refs en `integration-backups-20261116/`.
