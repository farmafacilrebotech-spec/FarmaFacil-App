# Pruebas — Plazas promoción lanzamiento 2027

**Fecha:** 13/11/2026  
**Rama:** `feature/launch-seats-manage`  
**Estado:** implementación lista · smoke staging 089 **PASS** · **sin prod/merge/deploy**

## Auditoría producción (solo lectura)

| Hallazgo | Detalle |
|----------|---------|
| Contador | `launch_2027` · max 20 · used **1** |
| Reserva activa | Farmacia Pruebas Producción (`2d01fcb1-…`) · SKU `general` · promo 39 € · lista 97,50 € |
| Reservada por | Pilar Reyes (`farmafacil.rebotech@gmail.com`) · 2026-11-13 |
| Liberación backend | RPC `ff_release_launch_seat_v1` ya existía; **no había UI** |
| Procedimiento seguro (cuando autorice) | SA → ficha → Contrato → Liberar plaza + motivo · o RPC con motivo · **sin** cambiar plan |

## Casos staging (tras aplicar 089)

| ID | Caso | Estado |
|----|------|--------|
| TC-LNCH-001 | Reservar plaza | `prueba_tecnica_ok` (smoke) |
| TC-LNCH-002 | Liberar plaza + motivo | `prueba_tecnica_ok` (smoke) |
| TC-LNCH-003 | Disponibilidad +1 tras liberar | `prueba_tecnica_ok` (smoke) |
| TC-LNCH-004 | Volver a reservar | `prueba_tecnica_ok` (smoke) |
| TC-LNCH-005 | Cambiar plan con/sin promo | pendiente UI |
| TC-LNCH-006 | Suspender/cancelar no libera auto | aviso UI añadido · pendiente validación visual |
| TC-LNCH-007 | Impedir duplicado / superar 20 | duplicado idempotente OK · límite 20 (RPC) |
| TC-LNCH-008 | Bloquear liberación comprometida | `prueba_tecnica_ok` (smoke) |
| TC-LNCH-009 | Solo SuperAdmin Total | gate app · pendiente UI |
| TC-LNCH-010 | Coherencia ficha ↔ Contratos | pendiente visual |
| TC-LNCH-011 | Historial events | `prueba_tecnica_ok` (smoke) |

## Migración

`089_launch_seat_events_commitment_v1.sql` — eventos + `confirmed_at` / commitment · **no aplicada en prod**.

## Preview

http://127.0.0.1:3060 — worktree `.worktrees/launch-seats-manage` (staging).  
Ficha: `/farmacias/{id}?tab=contrato` · Global: `/contratos`.
