# Prueba segura de importación de catálogo personalizado

**No ejecutar importación ni cambiar modalidad sin autorización.**  
**No modificar plan/tarifa de Farmacia Total PRO en este documento de preparación.**

## Estado producción (lectura 2026-11-08)

| Componente | Estado |
|------------|--------|
| `pharmacy_products` (020) | Presente |
| `pharmacy_settings.catalog_mode` (054) | Presente |
| `ff_set_pharmacy_catalog_mode_v1` | Presente |
| `ff_public_catalog_list_v1` (055) | Presente |
| Permisos `catalog.*` (074) | Presente |
| `ff_assign_commercial_plan_v1` (056) | **No** (draft) |
| Columna imagen producto | **No** |

Farmacias:
- Farmacia Pruebas → `own` (candidata a prueba sin tocar Total PRO)
- Farmacia Pruebas Producción → `own`
- Farmacia Total PRO → `generic` (**no cambiar** en esta fase)

## 1. Modalidad `own` sin alterar suscripción/tarifa

`ff_set_pharmacy_catalog_mode_v1` / `setPharmacyCatalogModeAction` **solo** escribe `pharmacy_settings.catalog_mode`.  
No asigna plan comercial (056 no existe). No toca subscriptions/tarifas.

Para Total PRO: **no llamar** al cambio de modo hasta autorización explícita.  
Para una prueba: usar **Farmacia Pruebas** o **Pruebas Producción**, ya en `own`.

## 2. Procedimiento Excel sin sobrescribir datos

1. Entrar como miembro con permiso de catálogo (tras 074: preferible OWNER/ADMIN) en `/f/{pharmacyId}/catalogo` de una farmacia **ya `own`**.
2. Descargar **Plantilla** CSV o preparar `.xlsx`/`.csv` (≤2 MB, ≤2000 filas).
3. **Columna obligatoria:** Producto/nombre. Opcionales: EAN, SKU, PVP, Stock, Stock mínimo, Categoría, Marca, Descripción.
4. Para no actualizar existentes: usar **EAN y/o SKU nuevos** que no existan en esa farmacia (match = EAN luego SKU).
5. Pulsar **Importar Excel/CSV** → mapear columnas → **Vista previa**.
6. Verificar resumen:
   - **Nuevos** = altas
   - **Actualizar** = coincidencia EAN/SKU (evitar en la prueba)
   - **Omitidos** = filas inválidas
7. Si hay “Actualizar” inesperados → **cancelar** (no confirmar).
8. Solo si el resumen es 100 % Nuevos (o Aceptable conscientemente) → **Confirmar**.
9. Verificar:
   - Panel `/f/.../catalogo` (source `import`)
   - Kiosko: PVP/stock visibles en productos `manual`/`import`
   - QR `/e/{publicId}/catalogo`: listado sin PVP/stock en browse (esperado)

## 3. Riesgos / bloqueos

| Riesgo | Mitigación |
|--------|------------|
| Confirmar con EAN existentes | Solo preview; cancelar si hay Actualizar |
| Cambiar Total PRO a own | No hacerlo hasta autorización; usar farmacia ya `own` |
| PHARMACIST/STAFF post-074 | Import exige `catalog.manage` (OWNER/ADMIN) |
| Sin imágenes en import | Ilustraciones de categoría; ver propuesta abajo |
| 056 ausente | Modalidad se cambia a mano; plan comercial no se sincroniza solo |

## 4. Propuesta técnica: fotografías reales de producto

**Objetivo:** URL o subida, con validación y storage seguro. No implementar ahora.

### Opción recomendada (faseada)
1. **Columna** `pharmacy_products.image_url text null` (+ opcional `image_path` storage).
2. **Validación:** solo `https://` en hosts allowlist o bucket propio; max size; content-type `image/jpeg|png|webp`.
3. **Storage:** bucket privado `pharmacy-product-images` (Supabase Storage), path `{pharmacy_id}/{product_id}/{uuid}.webp`; RLS: miembro con `catalog.manage` / platform write.
4. **Import:** columna opcional `ImagenURL` → validar y guardar; no descargar blobs en el import (solo URL allowlisted) en v1.
5. **UI:** campo URL + upload en formulario producto; QR/kiosko `resolveProductIllustration` → preferir `image_url` si existe, si no ilustración de categoría.
6. **Migración futura** (p.ej. 076): columna + bucket policies; **no** mezclar con emails 075 ni con Total PRO mode flip.

### Alternativa más simple (MVP)
Solo `image_url` HTTPS pública (CDN farmacia) sin upload; denylist localhost; timeout HEAD opcional en server action.
