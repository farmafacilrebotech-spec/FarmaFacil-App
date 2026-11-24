# Plan — Catálogos: importación + taxonomía + rendimiento

**Fecha:** 2026-11-24  
**Restricciones:** no prod · no sustituir staging · no apply migraciones · no merge · no APK · no borrar QA  
**Incidencia ligada:** `INCIDENCIA_IMPORT_CATALOGO_2000_2026-11-24.md`  
**Rendimiento:** coordinar con ENTREGA 1B (región Vercel + batch import)

---

## Fases propuestas

| Fase | Contenido | Migración | Deploy |
|------|-----------|-----------|--------|
| **A (prep código)** | Validación vacías/0, CN≠EAN, marca≠lab, contadores, confirm endurecido | No | Preview aislado Vercel |
| **B** | Taxonomía global + `pending_classification` + SA CRUD | `106` propuesta | Staging tras auth |
| **C** | Wizard mapeo columnas + equivalencias categoría por farmacia/proveedor | `106`+`107` | Staging tras auth |
| **D** | Import jobs batch + progreso + idempotencia + revert seguro | `107` | Staging tras auth |
| **E** | UI catálogo unificada (SA, farmacia, cliente, kiosko) | — | Tras B |

---

## Taxonomía actual vs propuesta

### Actual (maestro 100 — 8 categorías)

1. Bebé y maternidad  
2. Bienestar y cuidado estacional  
3. Cuidado capilar  
4. Cuidado corporal e higiene  
5. Cuidado facial  
6. Higiene bucodental  
7. Primeros auxilios y cuidado en casa  
8. Protección solar  

### Propuesta (26 + estado interno)

Ver lista del brief (Dermocosmética … Otros productos) + estado **`pending_classification`** (no comercial).

### Mapa de conservación (no duplicar referencias)

| Actual | Destino propuesto (borrador) |
|--------|------------------------------|
| Cuidado facial | Dermocosmética (+ subcats) |
| Cuidado corporal e higiene | Higiene personal / Dermocosmética |
| Higiene bucodental | Salud bucodental |
| Cuidado capilar | Cuidado capilar |
| Protección solar | Protección solar |
| Bebé y maternidad | Bebé e infantil + Embarazo y maternidad |
| Primeros auxilios y cuidado en casa | Botiquín y primeros auxilios + Equipamiento sanitario |
| Bienestar y cuidado estacional | Descanso y bienestar / Repelentes (subcats) |

IDs estables slug (`dermocosmetica`, …). Iconos: reutilizar SVG actuales donde haya 1:1; el resto placeholder corporativo hasta diseño.

---

## Migraciones propuestas (NO aplicadas)

1. `supabase/proposed/106_catalog_taxonomy_import_v1.sql`  
   - `ff_catalog_categories` / `ff_catalog_subcategories`  
   - seed 26 + pending  
   - `pharmacy_products.national_code`, `laboratory`, `category_id`, `subcategory_id`, `source_family`, `classification_status`  
   - RLS SA manage / farmacia read  

2. `supabase/proposed/107_catalog_import_jobs_v1.sql` (siguiente)  
   - `pharmacy_catalog_import_jobs` + items + equivalencias  
   - RPC batch upsert idempotente  
   - revert por `import_job_id` sin borrar edits posteriores  

---

## Preview aislado

1. Branch local con Fase A (ya preparada en working tree).  
2. Deploy **Preview** Vercel (no staging QA, no prod).  
3. Probar Excel sintético 100 / 1k con filas `0` → contadores vacías > 0.  
4. Medir before/after tiempo confirm (aún N inserts hasta Fase D).

---

## Checklist pruebas manuales (catálogo)

| # | Caso | OK |
|---|------|----|
| 1 | Excel con 50% filas vacías/`0` → vacías descartadas, creates solo válidos | ☐ |
| 2 | Precio 0 informado ≠ vacío; update no pisa con vacío | ☐ |
| 3 | CN 7 dígitos no se guarda como EAN-13 | ☐ |
| 4 | Columna Laboratorio ≠ Marca | ☐ |
| 5 | Reimport mismos CN/EAN → updates, no duplicados | ☐ |
| 6 | Sin `catalog.manage`/write: no cambia precios (rol) | ☐ |
| 7 | Medicamentos / dudosos → no publicar auto | ☐ |
| 8 | Kiosko/SA/farmacia ven misma taxonomía tras Fase B | ☐ |
| 9 | 1k / 5k sintéticos: progreso + sin timeout (Fase D) | ☐ |
| 10 | Limpieza 667 basura solo tras autorización SQL | ☐ |

---

## Before / after (medición)

| Operación | Before (staging real) | After Fase A (esperado) | After Fase D (esperado) |
|-----------|----------------------|-------------------------|-------------------------|
| Preview 2k con padding `0` | 2000 nuevos / 0 omitidas | ~1333 creates / ~667 vacías | igual + batch parse |
| Confirm 2k inserts | ~4,5 min | similar (aún 1×1) | <30–60 s batch |
| Basura name=`0` creada | 667 | 0 nuevas | 0 |

---

## Seguridad

- RLS multifarmacia intacta.  
- Import no publica `pending_classification`.  
- Precio: no ampliar permisos; integrar gate `catalog.manage` (074 integración) en preview al merge autorizado.  
- Sin datos reales de clientes en fixtures.
