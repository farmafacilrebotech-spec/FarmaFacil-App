# Pruebas — Logos en listado de Farmacias (follow-up independiente)

**Fecha:** 12/11/2026  
**Versión publicada:** `5d61f8b` (Merge PR #26 → `main`)  
**Deploy producción:** Vercel Production Ready · `https://app.farmafacil.solutions`  
**Rollback:** `9a445dd` (Merge PR #24) · deploy previo `farmafacil-jizcfchp7-…`  
**Rama origen:** `fix/pr23-pharmacy-list-logos`  
**Estado:** **publicado en producción** · smoke post-deploy OK (solo lectura)  
**Alcance:** solo listado/dashboard + docs. Sin Emails ni otros módulos. Sin migraciones SQL.

## Incidencia

| ID | Incidencia | Estado |
|----|------------|--------|
| INC-LOGO-001 | Listado `/farmacias` mostraba iniciales pese a logo en ficha | **Corregida y publicada** |

## Casos ejecutados (staging pre-merge)

| ID | Caso | Resultado | Estado |
|----|------|-----------|--------|
| TC-LOGO-LST-001 | Piloto con logo en listado | Logo real visible + captura | `prueba_tecnica_ok` + **OK usuaria** |
| TC-LOGO-LST-002 | Sin logo → iniciales | Fase6 / Staging 1 = iniciales | `prueba_tecnica_ok` + **OK usuaria** |
| TC-LOGO-LST-004 | Reemplazar logo (SA) | `logo_url` nuevo en query de listado; fetch 200 PNG | `prueba_tecnica_ok` |
| TC-LOGO-LST-005 | Eliminar logo (SA) | `logo_url=null` → iniciales | `prueba_tecnica_ok` |
| TC-LOGO-LST-006 | Owner actualiza `logo_url` | DENY (`rows=0`) | `prueba_tecnica_ok` |
| TC-LOGO-LST-007 | Restaurar logo de prueba | Logo Piloto restaurado + fetch 200 | `prueba_tecnica_ok` |
| TC-LOGO-UI-001 | Sin deformar/recortar | `object-contain` en `PharmacyLogo` | `prueba_tecnica_ok` |

Captura pre-merge: `_review_pharmacies/09-farmacias-list-logos-3050.png`.

## Smoke producción (12/11/2026) — sin mutar datos

| Check | Resultado |
|-------|-----------|
| Commit en Production | `5d61f8b` |
| Vercel Production | Ready · alias `app.farmafacil.solutions` |
| Dashboard · últimas farmacias | Logos reales + iniciales FP |
| Listado `/farmacias` | Logos reales cuando existen; sin logo → iniciales |
| Ficha farmacia | Logo correcto |
| Personalización (SA) | Controles Reemplazar / Eliminar visibles |
| Owner | Sin controles de gestión de logo en ficha |
| Migraciones / Emails / PR #25 | No incluidos |

## Permisos

- App: `requirePharmacyLogoManageAccess` → `platform.pharmacies.write` (SA).
- Tenant: `roleCanManagePharmacyLogo` siempre `false`.
