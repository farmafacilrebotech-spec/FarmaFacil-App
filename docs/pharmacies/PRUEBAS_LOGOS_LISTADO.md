# Pruebas — Logos en listado de Farmacias (follow-up independiente)

**Fecha:** 2026-11-12  
**Rama:** `fix/pr23-pharmacy-list-logos`  
**Worktree:** `.worktrees/pharmacy-clients-qr`  
**Base:** `origin/main` (`9a445dd`) · **sin migraciones SQL nuevas**  
**Estado:** `prueba_tecnica_ok` · validación visual listado **aprobada por usuaria** · **pendiente merge/deploy**  
**Alcance:** solo listado/dashboard + docs. Sin Emails ni otros módulos.

## Incidencia

| ID | Incidencia | Estado |
|----|------------|--------|
| INC-LOGO-001 | Listado `/farmacias` mostraba iniciales pese a logo en ficha | **Corregida** (código) · visual listado **aprobada** |

## Preview de aceptación

http://127.0.0.1:3050/farmacias  
(alternativa: http://127.0.0.1:3041/farmacias)

**No usar** `:3040` (Emails).

## Casos ejecutados (staging)

| ID | Caso | Resultado | Estado |
|----|------|-----------|--------|
| TC-LOGO-LST-001 | Piloto con logo en listado | Logo real visible + captura | `prueba_tecnica_ok` + **OK usuaria** |
| TC-LOGO-LST-002 | Sin logo → iniciales | Fase6 / Staging 1 = iniciales | `prueba_tecnica_ok` + **OK usuaria** |
| TC-LOGO-LST-004 | Reemplazar logo (SA) | `logo_url` nuevo en query de listado; fetch 200 PNG | `prueba_tecnica_ok` |
| TC-LOGO-LST-005 | Eliminar logo (SA) | `logo_url=null` → iniciales | `prueba_tecnica_ok` |
| TC-LOGO-LST-006 | Owner actualiza `logo_url` | DENY (`rows=0`) | `prueba_tecnica_ok` |
| TC-LOGO-LST-007 | Restaurar logo de prueba | Logo Piloto restaurado + fetch 200 | `prueba_tecnica_ok` |
| TC-LOGO-UI-001 | Sin deformar/recortar | `object-contain` en `PharmacyLogo` | `prueba_tecnica_ok` |

Smoke JSON: `tmp/logo-list-acceptance-smoke.json` (local).  
Captura: `_review_pharmacies/09-farmacias-list-logos-3050.png`.

## Compatibilidad / publicación

| Check | Resultado |
|-------|-----------|
| Diff vs `main` | Solo farmacias/logo/docs (11 archivos) |
| Migraciones | **Ninguna** |
| Emails / otros módulos | **No incluidos** |
| Prod | Aún sin el fix hasta merge+deploy de esta PR |

## Permisos

- App: `requirePharmacyLogoManageAccess` → `platform.pharmacies.write` (SA).
- Tenant: `roleCanManagePharmacyLogo` siempre `false`.
- Staging identity RLS: smoke Owner DENY confirmado en esta corrida.
