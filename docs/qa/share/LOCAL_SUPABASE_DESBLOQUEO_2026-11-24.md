# Desbloqueo BD local — 2026-11-24

## Estado comprobado

| Componente | Estado |
|------------|--------|
| Docker Desktop.app | **Instalado** (`/Applications/Docker.app`) |
| Daemon Docker | **UP** (Desktop 4.81.0 · Engine 29.6.1) |
| Supabase CLI | **Disponible** (`/opt/homebrew/bin/supabase` **v2.121.0**; hay v3.4.0) |
| `supabase start` full en catalog-fase-b | **Falla** por deuda de migraciones (079 staging one-shot, colisión version `083`, draft 056 ausente) |
| Smoke 089/090 | **OK parcial** en Postgres desechable `ff-catalog-mig-smoke` puerto **54532** |

## Pasos personales en el Mac (si el daemon vuelve a caer)

1. Abrir **Docker Desktop** y esperar a que diga *Running*.
2. (Opcional) `brew upgrade supabase` → v3.x.
3. No hace falta contratar nada en la nube.

## Smoke ya levantado (esta sesión)

```bash
# Contenedor local gratuito
docker ps --filter name=ff-catalog-mig-smoke
# URL
postgresql://postgres:postgres@127.0.0.1:54532/postgres
```

Resultado apply proposed:

- `ff_catalog_categories`: **26** comerciales + **1** internal  
- aliases legacy: **8**  
- `pharmacy_catalog_import_jobs` + items: creados  
- RPC `ff_pharmacy_products_import_batch_v1` / `…_revert_v1`: **creados**  
- RLS write 089: fallo menor por stub `ff_has_platform_permission` (firma); no bloquea DDL principal  

**Integrales PR #30 (2026-11-24):** seed sintético + suite import/idempotencia/duplicados/equivalencias/revert/RLS/stock/perf — **OK**. Ver `SMOKE_CATALOG_INTEGRAL_54532_2026-11-24.md`.

## No hecho

- No apply 089/090 en staging/prod  
- No merges  
- No rama avisos  
- `supabase start` full sigue bloqueado por deuda 079/083/056 (plan en `MIGRATION_DEBT_079_083_056_089_090_2026-11-24.md`)  
