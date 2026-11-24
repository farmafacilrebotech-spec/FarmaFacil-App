# Entrega — Catálogo Fase B (continuación)

**Fecha:** 2026-11-24  
**Rama:** `feat/catalog-taxonomy-import-b`  
**PR:** https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/30

## Bloqueo BD aislada

| Recurso | Estado |
|---------|--------|
| Docker Desktop / Supabase local | **No disponible** (daemon down) |
| Proyecto Supabase desechable | **No existe** en env locales |
| Staging `dazfdcj…` | **Prohibido** para 089/090 |
| Producción | **No tocar** |

**Migraciones 089/090 NO aplicadas.** Crear un proyecto Supabase free/local o arrancar Docker antes de authorize apply. No se han creado recursos de pago.

## Numeración vs PR #28 / #29

- Tip migraciones en main: **088**
- PR #29 reserva draft **`106_visible_name_…`** → **106 no es catálogo**
- Catálogo Fase B: `supabase/proposed/089_…` + `090_…`
- Ver `docs/qa/share/MIGRATION_NUMBERING_CATALOG_VS_PR28_29.md`
- **No** migración 105

## Funcionalidades completadas en código

| Ítem | Estado |
|------|--------|
| Wizard columnas | Sí |
| Wizard equivalencias familia→26 cats | Sí (localStorage + upsert BD si 089) |
| Equivalencias por farmacia/proveedor/formato | Sí (actions + UI) |
| Taxonomía SA + subcategorías | Sí (seed + CRUD borrador sesión; persist BD tras 089) |
| Historial importaciones | Sí (UI; datos si 090) |
| Reversión segura | Sí (RPC 090 o fallback soft-deactivate sin tocar editados) |
| Progreso real por lotes | Sí (`runProductImportBatches` + barra %) |
| Pendientes de clasificación | Sí (persisten inactivos; filtro admin; no en kiosko) |
| 26 cats en SA / farmacia / form / kiosko | Sí (seed + selects + iconos) |
| Activos / archivados / pendientes | Sí (filtros admin) |
| Desactivados fuera de catálogos comerciales | Sí (`is_active=false` + filtro pending en kiosko) |

## Rendimiento sintético (CPU local, sin BD)

Ver `PERF_CATALOG_SYNTHETIC_2026-11-24.md`:

| Productos | total CPU ms | inválidas (sim) | lotes×100 |
|----------:|-------------:|----------------:|----------:|
| 100 | ~0.1 | 0 | 1 |
| 1.000 | ~0.6 | 0 | 10 |
| 2.000 | ~0.5 | 1334* | 14 |
| 5.000 | ~1.3 | 3336 | 34 |
| 10.000 | ~2.5 | 6670 | 67 |
| 20.000 | ~5.0 | 13340 | 134 |

\* En 2k se simula ratio ~667/2000 basura. Validación unitaria: **667/2000 rechazados** con criterios name=`0` + sku/ean vacíos.

Latencia red PostgREST no medida aquí (sin BD aislada). Histórico staging 1-insert/fila ≈ 4,5 min; código actual multi-insert ×100 + lotes cliente.

## Excel original / reimport / duplicados / revert

| Prueba | Resultado |
|--------|-----------|
| Reimport Excel original en BD aislada | **Pendiente** (sin BD aislada; Excel QA parcial en AgentStore) |
| Rechazo 667 inválidos | **OK en validación sintética** (667/2000) |
| Reimport sin duplicados | Lógica match EAN/CN → update/unchanged (código); **E2E BD pendiente** |
| Revert no pisa edits farmacia | RPC/fallback `updated_at ≈ created_at` (código); **E2E BD pendiente** |

## Tests ejecutados

```bash
npm run test:product-import   # 13 pass (validate + batch + equivalences)
npm run test:taxonomy         # 9 pass
npm run test:master-catalog   # 19 pass
npm run bench:catalog-import  # PERF_*.md/json
```

E2E Playwright sobre preview: ejecutar manualmente con credenciales staging (preview apunta a staging DB **sin** tablas 089/090 → historial/RPC degradado).

## Checklist manual (preview)

1. SuperAdmin → `/catalogo/taxonomia`: 26 + pending + subcategorías seed/borrador.
2. Farmacia catálogo propio → Importar: mapeo columnas → equivalencias → preview → progreso por lotes.
3. Filtros: Activos / Archivados / Pend. clasificar.
4. Categorizar masivo pendientes → quedan activos comerciales.
5. Kiosko/QR: no listan `is_active=false` ni «Pendiente de clasificar».
6. Historial → Revertir (mensaje claro si falta 090).
7. Reimport mismo archivo: updates/unchanged, sin duplicar EAN.
8. Roles sin `catalog.manage`: no escriben.

## Stock no bloqueante (criterio funcional)

- Stock opcional; 0/NULL no ocultan ni bloquean carrito/pedido.
- Copy cliente: «Disponible para solicitar.» + «Tu farmacia te confirmará cuándo puedes recogerlo.»
- Sin cantidades de stock ni «agotado» en kiosko/cliente.
- Panel farmacia: columna stock oculta por defecto (toggle «Mostrar stock»).
- Campo BD conservado (NOT NULL DEFAULT 0); 0 = no informado en FF, no agotado.
- Tests: `npm run test:stock-policy`

## Constraints respetados

- No prod · No 089/090 en staging · No 105 · No re-tocar QA data · No merge · No APK
