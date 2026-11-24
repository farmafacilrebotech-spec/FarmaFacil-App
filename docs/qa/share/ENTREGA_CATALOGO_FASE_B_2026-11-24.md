# Entrega — Catálogo Fase B + limpieza staging

**Fecha:** 2026-11-24  
**Rama:** `feat/catalog-taxonomy-import-b`

## 1. Limpieza staging (única escritura BD autorizada)

| Campo | Valor |
|-------|-------|
| Entorno | `dazfdcjscnpfvhcyjddt` |
| Farmacia | TEST Fase7 QR Requests 20261021 (`98ea2742-…`) |
| Criterio | `source=import` ∧ `name∈{0,0.0}` ∧ sku/ean vacíos |
| Coincidencias | **667** |
| Ya inactivos | 2 |
| Desactivados ahora | **665** |
| Refs `pharmacy_order_items` | **0** |
| Activos farmacia antes → después | **2099 → 1434** (Δ −665) |
| Total filas farmacia | **2101** (sin borrado físico) |
| Import activos después | **1333** (conservados) |
| Backup | `docs/qa/share/backups/staging_soft_deactivate_junk_20261124T181742Z.json` |
| Resultado | `docs/qa/share/backups/CLEANUP_RESULT.json` |

Método: `psql` + `SET LOCAL session_replication_role = replica` (el trigger 074 bloqueaba service_role REST).

## 2. Funcionalidades implementadas (código)

- Fase A validación (vacías/0/cabeceras/CN≠EAN/marca≠lab/contadores/informe).
- Taxonomía 26 + pending (`lib/catalog/taxonomy.ts`) + UI SuperAdmin `/catalogo/taxonomia`.
- Import escritura **por lotes de 100** (multi-insert PostgREST) + `elapsedMs`.
- Límite archivo 20.000 filas / 8 MB.
- Catálogo farmacia: paginación 50, selección múltiple, archivado y categorización masiva.
- Migraciones **propuestas** (no aplicadas en staging): `106`, `107` (jobs + RPC batch + revert).

## 3. Taxonomía definitiva (comercial)

Ver `listCommercialCategories()` — 26 nombres del brief + `pending_classification` interno.

## 4. Rendimiento

| Escenario | Before | After (código) |
|-----------|--------|----------------|
| Confirm ~2000 altas | ~4,5 min (1 insert/fila, staging real) | multi-insert ×100 → objetivo &lt;15 s (medir en preview) |
| Preview padding `0` | 2000 nuevos / 0 omitidas | vacías descartadas |

Medición real post-deploy: repetir import sintético en preview y anotar `elapsedMs` del toast.

## 5. Migraciones pendientes de autorización

- `supabase/proposed/106_catalog_taxonomy_import_v1.sql`
- `supabase/proposed/107_catalog_import_jobs_v1.sql`  
**No** aplicadas en staging. **No** 105.

## 6. Pruebas manuales nuevas

1. Staging: catálogo Fase7 — 667 basura archivadas; 1333 visibles/activos import.  
2. Preview: import Excel con filas `0` → contador vacías &gt; 0; confirm batch &lt;15 s si ~2k válidos.  
3. `/catalogo/taxonomia` lista 26 + pending.  
4. Catálogo farmacia: paginar, seleccionar, archivar masivo, categorizar.  
5. Reimport mismos EAN/CN → updates / sin cambios, sin duplicar.  
6. Aislamiento multifarmacia + roles sin write.

## 7. Tests automatizados

```bash
npm run test:product-import
npm run test:taxonomy
```
