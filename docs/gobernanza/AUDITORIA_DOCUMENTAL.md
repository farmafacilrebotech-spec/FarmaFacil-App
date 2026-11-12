# Auditoría documental FarmaFácil

**Fecha:** 2026-11-12  
**Rama de trabajo:** `feature/help-center-living-docs`  
**Baseline producto:** `origin/main` @ `9a445dd` (PR #24 publicada)  
**Alcance:** inventario sin duplicar ni perder; no marca como superada ninguna prueba sin evidencia.

## 1. Resumen ejecutivo

| Categoría | Estado |
|-----------|--------|
| Manuales de usuario | **Parcial** — existe base en `docs/manuales/` (rama histórica `docs/manuales-y-pruebas`); desactualizada respecto a `main` post PR #21–#24 |
| Plan maestro de pruebas | **Parcial** — `docs/pruebas/PLAN_MAESTRO_PRUEBAS.md` + matriz 77 casos; 5 Correctas (E2E-F QR); 72 No ejecutadas |
| Informes GO/NO-GO | **Dispersos** en worktrees/PRs; consolidados bajo `docs/releases/` en esta rama |
| Centro de ayuda in-app | **Vacío** — `app/(app)/ayuda/page.tsx` es placeholder |
| Roadmap | **Actualizado** en worktree Emails (`docs/releases/project-roadmap-fase1.md`); ítem #7 = Centro de ayuda |
| Regla permanente Cursor / PR checklist | **Ausente** hasta esta rama |
| Manuales por perfil SA Comercial / Soporte / Kiosko / Empleados | **Falta** (solo un MANUAL_SUPERADMIN combinado) |

## 2. Inventario localizado

### 2.1 Rama histórica `docs/manuales-y-pruebas` (worktree `FarmaFacil-App-docs-manuales`)

| Ruta | Contenido | Actualización |
|------|-----------|---------------|
| `docs/pruebas/PLAN_MAESTRO_PRUEBAS.md` | Plan maestro + estados | 2026-11-05 (E2E-F) |
| `docs/pruebas/MATRIZ_PRUEBAS.csv` / `.xlsx` | 77 casos | 2026-11-05 |
| `docs/pruebas/RECORRIDOS_E2E.md` | Recorridos A–F | Parcial |
| `docs/pruebas/INCIDENCIAS.md` | INC-QR-001/002 resueltas en prod | 2026-11-05 |
| `docs/pruebas/evidencias/` | SQL anonimizado + interno (gitignore) | Parcial |
| `docs/manuales/MANUAL_SUPERADMIN.md` | SA + Soporte combinados | Baseline pre-PR21 |
| `docs/manuales/MANUAL_FARMACIA.md` | Titular/admin (+ notas empleados) | Parcial |
| `docs/manuales/MANUAL_CLIENTE.md` | Área cliente / QR | Parcial E2E-F |
| `docs/manuales/INDICE_PANTALLAS.md` | SCR-* | Parcial |
| `docs/manuales/capturas/{cliente,farmacia,historico,kiosko}/` | Evidencias PNG/PDF | QR + mockups kiosko |

**Nota:** esa rama está **muy detrás** de `main` (base ~PR #11). No usarla como tip de producto; sí como fuente a consolidar.

### 2.2 `origin/main` (publicado)

| Ruta | Contenido |
|------|-----------|
| `docs/contratos/fuentes/*.docx` | Plantillas contractuales (no manual de producto) |
| `docs/references/catalogo-canva/` | Iconografía catálogo |
| `README.md` | Vacío casi |
| `app/(app)/ayuda/page.tsx` | Placeholder «Próximamente» |
| `supabase/README.md` | Ops / primer SA |
| `android-kiosk/README.md` + `android-kiosk/docs/LOCK_TASK_SAFE_TEST.md` | Kiosko Android |
| `supabase/diagnostics/**` | Informes publish/backup (ops, no usuario) |

### 2.3 Worktrees con documentación de PR / release

| Origen | Rutas relevantes | PR / tema |
|--------|------------------|-----------|
| `.worktrees/emails-phase-b` | `docs/emails/*`, `docs/pr21-*`, `docs/pr22-*`, `docs/pr23-*`, `docs/commercial-plans-activation-go-nogo.md`, `docs/project-roadmap-fase1.md`, `_review_emails/*` | #21–#25 + roadmap |
| `.worktrees/commercial-plans-activation` | GO/NO-GO planes | #24 |
| `.worktrees/pharmacy-clients-qr` | `public/_review_clients_qr/*` | #23 carteles/QR |
| `.worktrees/sa-proveedores` | (código + smokes; pocos md de usuario) | #21 |
| Varios `supabase/diagnostics/*` | PUBLISH_RESULT, INFORME_FINAL | Histórico ops |

### 2.4 Evidencias de capturas / review (no son manuales)

| Ruta | Uso |
|------|-----|
| `_review_emails/` (Emails) | Capturas compositor PR #25 staging |
| `public/_review_clients_qr/` | Carteles QR / logos |
| `docs/manuales/capturas/**` | Evidencias de prueba usuario |

## 3. Recuperación PR #21–#25 (estado documental)

| PR | Tema | Informe GO/NO-GO | En matriz maestro | Manual usuario | Estado prueba documentable |
|----|------|------------------|-------------------|----------------|----------------------------|
| **#21** | Proveedores + inventario kiosko | `docs/releases/pr21-go-nogo-*.md` | **No** (casos SA proveedores no en CSV) | No | **Prueba técnica staging documentada** en GO; **no** «Validado por usuario» ni «Publicado» en matriz hasta cerrar evidencia formal + entrada en plan |
| **#22** | UI tarifas / planes | `docs/releases/pr22-go-nogo.md` | No | No | GO condicional UI; SQL no requerido |
| **#23** | Clientes QR / carteles | `docs/releases/pr23-go-nogo.md` + capturas QR | Parcial (E2E-F sí) | Parcial MANUAL_CLIENTE/FARMACIA | E2E-F **Validado en producción** (5 TC); resto ciclo pedido pendiente |
| **#24** | Activación planes comerciales | `docs/releases/commercial-plans-activation-go-nogo.md` | No | No | GO condicional; tip en `main` |
| **#25** | Emails Fase B | `docs/releases/emails/*` + `evidencias/emails-pr25/` | No | No | **En desarrollo / staging**; captura técnica; **pendiente validación de usuario**; sin push autorizado |

**Regla aplicada:** ningún caso nuevo se marca Correcta / Validado / Publicado sin evidencia enlazada.

## 4. Documentación que falta

### Manuales
- Manual SuperAdmin Total (separado)
- Manual SuperAdmin Comercial
- Manual SuperAdmin Soporte (separado del Total)
- Manual farmacéutico y empleados (separado del titular)
- Manual instalación y uso del Kiosko (solo README Android + mockups)
- Actualización de todos los manuales a funcionalidades **realmente en `main`** (proveedores, inventario, planes, emails pendiente)

### Pruebas
- Ampliación de estados al modelo vivo (ver `ESTRUCTURA_DEFINITIVA.md`)
- Casos para Proveedores, Inventario, Tarifas/planes, Emails
- Registro sistemático PR/commit/entorno por caso
- Historial de versiones de producto enlazado a releases

### Centro de ayuda
- Catálogo documental con permisos backend
- Buscador, índice, PDF, ayuda contextual
- Exclusión de documento de pruebas para farmacias/clientes

### Gobernanza
- Regla Cursor permanente
- Checklist PR obligatorio
- Historial de versiones vivo

## 5. Riesgos de duplicación

| Riesgo | Mitigación |
|--------|------------|
| Dos ramas docs (`docs/manuales-y-pruebas` vs esta) | Esta rama es la canónica a partir de `main`; la antigua = archivo fuente |
| GO/NO-GO copiados vs enlazados | Copias bajo `docs/releases/` con nota de origen; no editar como verdad de producto sin sync |
| Capturas PII | `evidencias/interno/` permanece gitignore; no publicar en Centro de ayuda |

## 6. Próximo paso inmediato

1. Adoptar `ESTRUCTURA_DEFINITIVA.md`.
2. Ampliar plan/matriz con estados vivos + índice PR #21–#25.
3. Scaffold Centro de ayuda con gate de audiencia.
4. Actualizar manuales de lo **publicado en `main`** (prioridad: farmacia, cliente, SA ops).
5. En PR #25: añadir casos Emails como *En desarrollo / Prueba técnica* con evidencias `_review_emails`.
