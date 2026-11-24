# INCIDENCIA QA — Importación Excel catálogo (2.000 filas)

**ID:** QA-CAT-IMPORT-2000  
**Fecha:** 2026-11-24  
**Entorno:** staging Supabase `dazfdcjscnpfvhcyjddt` (solo lectura en este informe)  
**Severidad:** Alta (datos basura + clasificación incorrecta + rendimiento)  
**Estado:** Registrada · limpieza **no aplicada** (pendiente autorización)  
**Coordinación:** ENTREGA 1B rendimiento + ampliación taxonomía catálogos

---

## Síntoma reportado

Previsualización: **2.000 filas · 2.000 productos nuevos · 0 omitidos**, pese a filas vacías / placeholders en el Excel.

## Hallazgos (staging, lectura)

| Métrica | Valor |
|---------|-------|
| Farmacia | `TEST Fase7 QR Requests 20261021` (`98ea2742-5b57-4271-8448-b132cae70598`) |
| Productos `source=import` | **2.000** (importación **finalizada**) |
| Ventana `created_at` | 2026-11-24 17:38:42 → 17:43:16 UTC (~**4,5 min**, 1 insert/fila) |
| Basura `name/brand = "0"` sin EAN/SKU | **667** |
| Con identificador (CN/EAN en campo) | **1333** |
| Categoría FarmaFácil | vacía en el 100 % de la muestra |
| Marca `"0"` | 1456 filas |
| Duplicados EAN en import | 0 (pero varios nombres repetidos ×2) |

Snapshot: `docs/qa/share/_catalog_import_qa_snapshot.json`

### Causa raíz (código)

1. Fila «vacía» solo si faltan name+sku+ean → **`"0"` cuenta como nombre**.
2. Contadores UI = `creates` tras ese filtro → 2000/2000/0.
3. Confirm **confía** en `action` del cliente; no reaplica reglas.
4. Marca ↔ laboratorio mezclados en aliases; familia de proveedor = texto libre en `category`.
5. CN (6–7 dígitos) aterriza en columna `ean`.
6. Sin batching → ~4–5 min / 2k filas.

---

## Propuesta de limpieza selectiva (NO ejecutar sin autorización)

Objetivo: desactivar basura sin borrar QA ni tocar productos con nombre real.

```sql
-- BORRADOR — NO APLICAR sin autorización explícita
-- Farmacia TEST Fase7 QR Requests 20261021
begin;

update pharmacy_products
set is_active = false,
    updated_at = now()
where pharmacy_id = '98ea2742-5b57-4271-8448-b132cae70598'
  and source = 'import'
  and name in ('0', '0.0')
  and coalesce(nullif(trim(sku), ''), '') = ''
  and coalesce(nullif(trim(ean), ''), '') = '';

-- Verificar conteo esperado ≈ 667
-- select count(*) from pharmacy_products where ... (misma predicado);

-- commit;  -- solo tras OK manual
rollback;   -- por defecto en ensayos
```

**No** DELETE. **No** tocar los ~1333 con identificador hasta revisión de mapeo CN/EAN y taxonomía.

---

## Corrección preparada en código (sin deploy staging/prod)

- Validación compartida preview/confirm (`product-import-validate.ts`).
- Descarte de placeholders `0` / filas vacías / cabeceras / subtotales.
- CN ≠ EAN ≠ código interno; marca ≠ laboratorio.
- Contadores: leídas / vacías / inválidas / duplicados / nuevos / actualizar / sin cambios / pend. clasificar.
- Filtro de previsualización + descarga de informe `.txt`.
- Confirm no escribe placeholders, sin cambios ni pendientes de clasificación.
- Tests: `npm run test:product-import`.

## Pendiente (requiere autorización + migraciones)

Ver `PLAN_CATALOGOS_TAXONOMIA_IMPORT_2026-11-24.md` y  
`supabase/proposed/089_catalog_taxonomy_import_v1.sql` (no aplicada).
