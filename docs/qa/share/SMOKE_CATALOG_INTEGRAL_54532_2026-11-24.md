# Smoke integral catálogo — `ff-catalog-mig-smoke:54532`

**Fecha:** 2026-11-24  
**Script:** `docs/qa/share/scripts/smoke_catalog_integral_54532.sql`  
**Log:** `docs/qa/share/SMOKE_CATALOG_INTEGRAL_54532_2026-11-24.log`  
**Datos:** 100% sintéticos (UUIDs `aaaa…` / `bbbb…`). Sin PII de prod.

## Resultados

| Prueba | Resultado |
|--------|-----------|
| T1 Import create | **OK** — created=4 skipped=1 · classified=3 pending=1 |
| T2 Idempotencia (mismo job) | **OK** — replayed=2 · products_a=4 (sin duplicar) |
| T3 Duplicados EAN → update | **OK** — update=1 · name/price actualizados · stock **99** preservado (`stock_provided=false`) |
| T4 Equivalencias | **OK** — «Higiene oral»→`salud_bucodental`; familia desconocida→`pending_classification` |
| T5 Historial + revert | **OK** — `partially_reverted` · reverted=3 · kept_active_modified=1 (Champú editado) |
| T6 RLS multifarmacia | **OK** — visible_as_a=4 · b_leak=0 · cross-pharmacy import **denied** |
| T7 Stock no bloqueante | **OK** — reimport sin `stock_provided` deja stock=50; alta sin stock→0 |
| T8 Perf escritura real 500 filas | **OK** — **57 ms** · created=500 · errors=0 |

## Notas

- Helpers de smoke (`auth.uid` vía GUC, permisos por farmacia) solo en esta BD desechable.
- Política RLS tenant en `pharmacy_products` añadida para el test; no es migración de producto.
- 089/090 **no** aplicados en staging/prod.
