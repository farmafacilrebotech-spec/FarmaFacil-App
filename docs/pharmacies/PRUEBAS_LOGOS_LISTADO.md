# Pruebas — Logos en listado de Farmacias (PR #23 follow-up)

**Entorno:** staging preview `http://127.0.0.1:3023` (worktree `pharmacy-clients-qr`)  
**Fecha:** 2026-11-12  
**Estado global:** `prueba_tecnica_pendiente_browser` / sin SQL prod / sin merge / sin deploy

## Incidencia

| ID | Incidencia | Estado | Resolución |
|----|------------|--------|------------|
| INC-LOGO-001 | Listado `/farmacias` mostraba solo iniciales aunque hubiera logo en ficha | **Corregida en código** | `listPharmacies` incluye `pharmacy_branding.logo_url`; `PharmacyLogo` recibe `logoUrl` |

## Casos

| ID | Caso | Esperado | Estado |
|----|------|----------|--------|
| TC-LOGO-LST-001 | Farmacia con `logo_url` en branding | Listado muestra logo (`object-contain`) | `pendiente_browser` |
| TC-LOGO-LST-002 | Farmacia sin logo | Iniciales + `logo_color` | `pendiente_browser` |
| TC-LOGO-LST-003 | URL de logo rota | Fallback a iniciales | `pendiente_browser` |
| TC-LOGO-LST-004 | SA reemplaza logo en Personalización | Listado refleja el nuevo logo tras volver a `/farmacias` | `pendiente_browser` |
| TC-LOGO-LST-005 | SA elimina logo | Listado vuelve a iniciales | `pendiente_browser` |
| TC-LOGO-LST-006 | Owner intenta cambiar logo | Denegado (UI/action) | `prueba_tecnica_ok` (smoke identidad previo) |
| TC-LOGO-DASH-001 | Dashboard «Últimas farmacias» | Mismo logo/iniciales que listado | `pendiente_browser` |

## Permisos (regresión)

- `requirePharmacyLogoManageAccess` → solo `platform.pharmacies.write`.
- Identity RLS staging: ALL PASSED (corrida previa documentada).

## Notas de implementación

- Componente reutilizado: `components/brand/pharmacy-logo.tsx`.
- Revalidación: `revalidatePath('/farmacias')` + `/dashboard` en upload/remove.
- `PharmacyLogo` reinicia estado de error al cambiar `logoUrl`.
