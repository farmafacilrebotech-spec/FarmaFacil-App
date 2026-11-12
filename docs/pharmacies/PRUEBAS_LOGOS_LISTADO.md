# Pruebas — Logos en listado de Farmacias (PR #23 follow-up)

**Fecha:** 2026-11-12  
**Incidencia:** INC-LOGO-001 — **NO validada por usuaria** (sigue abierta hasta OK visual).  
**Commit del fix:** `7c84e56` (+ `f2a8685` docs)  
**Rama:** `fix/pr23-pharmacy-list-logos`  
**Worktree:** `.worktrees/pharmacy-clients-qr`  
**Estado publicación:** sin push · sin merge · sin deploy · **no está en `main` ni en PR #23**

## Diagnóstico (por qué veías iniciales en :3040 y prod)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Dónde está `7c84e56`? | Solo en rama local `fix/pr23-pharmacy-list-logos` (worktree `pharmacy-clients-qr`) |
| ¿Incorporado a PR #23? | **No.** PR #23 ya estaba mergeada en `main` (`da03582`) **antes** de este follow-up |
| ¿Qué hay en producción? | `app.farmafacil.solutions` ← deploy prod ~12h (`main` @ `9a445dd` / PR #24). **Sin** el fix de listado |
| ¿Qué sirve `:3040`? | Worktree **`emails-phase-b`** (`feature/emails-phase-b-send`) — **no** contiene el fix de logos |
| ¿Consulta listado OK? | Sí: `listPharmacies` + join `pharmacy_branding(logo_url)`; SA lee `logo_url` de Piloto; Storage público 200 |
| ¿Permisos/Storage/URL? | Staging OK. Fallo de validación = **puerto/rama incorrectos**, no Storage |

## Preview de aceptación (rama con el fix)

**URL exacta (autenticada, staging):**  
http://127.0.0.1:3050/farmacias

Alternativa dedicada (mismo código/rama/staging):  
http://127.0.0.1:3041/farmacias

**No usar** `http://127.0.0.1:3040/farmacias` para esta incidencia (Emails).

## Evidencia técnica browser (2026-11-12)

Captura: `_review_pharmacies/09-farmacias-list-logos-3050.png`

| Farmacia | Listado |
|----------|---------|
| Farmacia Prueba Piloto | **Logo real** (img Storage `…/af477147-…/logo.jpg`) |
| TEST Fase7 QR Requests… | **Logo real** |
| TEST Fase6 / Piloto Comercial / Staging 1 | **Iniciales** (sin `logo_url`) |

## Casos de aceptación (pendiente tu OK)

| ID | Caso | Estado |
|----|------|--------|
| TC-LOGO-LST-001 | Piloto muestra logo real en listado | `prueba_tecnica_ok` · **pendiente_validacion_usuario** |
| TC-LOGO-LST-002 | Sin logo → iniciales | `prueba_tecnica_ok` · **pendiente_validacion_usuario** |
| TC-LOGO-LST-004 | Reemplazar logo → listado + ficha | `pendiente_validacion_usuario` |
| TC-LOGO-LST-005 | Eliminar logo → iniciales | `pendiente_validacion_usuario` |
| TC-LOGO-LST-006 | Owner no puede cambiar logo | `prueba_tecnica_ok` (smoke previo) |

## Notas de implementación

- `PharmacyLogo` + `logoUrl` desde `pharmacy_branding.logo_url` (misma fuente que la ficha).
- `revalidatePath('/farmacias')` + `/dashboard` en upload/remove.
- Sin duplicar componentes: reutiliza identidad visual existente.
