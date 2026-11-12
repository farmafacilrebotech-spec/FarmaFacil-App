# Pruebas Emails — PR #25 (documento vivo)

**Entorno:** staging preview `http://127.0.0.1:3040`  
**Fecha:** 2026-11-12  
**Commit rama:** `d526d2c` (+ evidencias iconos pendientes de commit)  
**Estado global:** `prueba_tecnica_ok` / `pendiente_validacion_usuario` (sin publicación)

Destinado a consolidar en el plan maestro / Centro de ayuda (SA Total).

## Incidencias y resolución

| ID | Incidencia | Estado | Resolución |
|----|------------|--------|------------|
| INC-EML-001 | `/emails/drafts` rompía con «Functions cannot be passed… templateTitle={function}» | **Resuelta** | Títulos resueltos en servidor (`buildDraftTemplateTitleMap`); cliente recibe `Record<string,string>` |
| INC-EML-002 | Botones de Plantillas cortaban nombres | **Resuelta** | Acciones por iconos Lucide + tooltips; nombre/asunto `line-clamp-2` |
| INC-EML-003 | «Renombrar» no era edición real WYSIWYG | **Resuelta** | Modo `editTemplate` con Guardar cambios (mismo ID) |
| INC-EML-004 | Migas duplicadas (shell + cabecera) | **Resuelta** | Eliminadas migas del `EmailsShell`; cabecera general única |
| INC-EML-005 | Borradores/Enviados/Papelera con botones grandes Abrir/Eliminar | **Resuelta** | Iconos compactos (`MailboxIconAction`); Borradores Eliminar → `trashEmailDraftAction` (Papelera) |

## Casos de navegación autenticada (staging)

| ID | Ruta | Resultado esperado | Resultado obtenido | Estado |
|----|------|--------------------|--------------------|--------|
| TC-EML-NAV-001 | `/emails/inbox` | 200, título Recibidos | 200 OK; placeholder IMAP | `prueba_tecnica_ok` |
| TC-EML-NAV-002 | `/emails/sends` | 200, Enviados; icono Ver detalle si hay filas | 200 OK; sin envíos (sin filas → sin icono) | `prueba_tecnica_ok` |
| TC-EML-NAV-003 | `/emails/drafts` | 200; iconos Pencil/Trash2; títulos completos | aria `Abrir borrador` / `Enviar a la papelera`; 2 filas | `prueba_tecnica_ok` |
| TC-EML-NAV-004 | `/emails/templates` | Iconos Usar/Editar/Duplicar/Archivar/Eliminar | OK (corrida previa) | `prueba_tecnica_ok` |
| TC-EML-NAV-005 | `/emails/trash` | Iconos Restaurar + Eliminar definitivo | aria `Restaurar borrador` / `Eliminar definitivamente` | `prueba_tecnica_ok` |
| TC-EML-NAV-006 | `/emails/compose` | Compositor limpio | 200 OK (corrida previa) | `prueba_tecnica_ok` |
| TC-EML-TPL-010 | Editar Lanzadera | Nombre + asunto + WYSIWYG + Guardar cambios | UI OK; guardado ejecutado | `prueba_tecnica_ok` |
| TC-EML-DRF-010 | Conservar borradores existentes | No perder filas al corregir drafts | 2 borradores listados | `prueba_tecnica_ok` |
| TC-EML-DRF-020 | Eliminar en Borradores | Confirmación → aparece en Papelera; no hard-delete | Borrador «Sin asunto» movido a Papelera | `prueba_tecnica_ok` |
| TC-EML-TRH-010 | Restaurar desde Papelera | Vuelve a Borradores | Restaurado; Papelera vacía; 2 borradores de nuevo | `prueba_tecnica_ok` |

## Regresión unitaria

- `lib/email/draft-template-titles.test.ts` — mapa serializable JSON-safe (pass).
- `lib/email/send-config.test.ts` — send OFF por defecto; dry-run seguro (pass).

## Evidencias

`_review_emails/` — compositor, plantillas, edición, drafts/trash iconos (`07`/`08`).

## Preparación primer envío real (NO ejecutado)

Checklist controlado (staging). **No enviar** hasta autorización explícita.

| # | Condición | Estado actual |
|---|-----------|---------------|
| 1 | Dominio Resend verificado + SPF/DKIM | Pendiente confirmación owner |
| 2 | `RESEND_API_KEY` + `EMAIL_FROM` en preview | **Presentes** en `.env.staging.local` |
| 3 | `FF_CORPORATE_EMAIL_SEND_ENABLED=1` | **Ausente** → send OFF (seguro) |
| 4 | `FF_CORPORATE_EMAIL_DRY_RUN=0` solo con autorización | **Ausente** (no live) |
| 5 | Remitente `pilar@` → destinatario corporativo propio | Listo para indicar |
| 6 | Plantilla operativa / sin plantilla; PDF opcional | Listo en UI |
| 7 | Tras envío: Enviados = «Enviado a Resend» | N/A hasta autorización |

**Prohibido aún:** SQL prod, merge, deploy, live en producción, envío masivo, envío real.

## Validación de usuario

Pendiente de OK visual de iconos en Borradores/Enviados/Papelera en :3040. Sin push.
