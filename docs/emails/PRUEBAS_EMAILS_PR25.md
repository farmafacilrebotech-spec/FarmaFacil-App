# Pruebas Emails — PR #25 (documento vivo)

**Entorno:** staging preview `http://127.0.0.1:3040`  
**Fecha:** 2026-11-12  
**Commit rama:** pendiente de commit local de coherencia de iconos  
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
| TC-EML-NAV-001 | `/emails/inbox` | 200, título Recibidos | 200 OK | `prueba_tecnica_ok` |
| TC-EML-NAV-002 | `/emails/sends` | 200, Enviados; icono Ver detalle | 200 OK; Eye | `prueba_tecnica_ok` |
| TC-EML-NAV-003 | `/emails/drafts` | 200, sin error RSC; iconos Pencil/Trash2 | 200; títulos completos; iconos | `pendiente_revalidacion` |
| TC-EML-NAV-004 | `/emails/templates` | Iconos Usar/Editar/Duplicar/Archivar/Eliminar; Nueva plantilla | OK | `prueba_tecnica_ok` |
| TC-EML-NAV-005 | `/emails/trash` | Iconos Restaurar + Eliminar definitivo | 200; ArchiveRestore/Trash2 | `pendiente_revalidacion` |
| TC-EML-NAV-006 | `/emails/compose` | Compositor limpio | 200 OK | `prueba_tecnica_ok` |
| TC-EML-TPL-010 | Editar Lanzadera | Nombre + asunto + WYSIWYG + Guardar cambios | UI OK; guardado ejecutado | `prueba_tecnica_ok` |
| TC-EML-DRF-010 | Conservar borradores existentes | No perder filas al corregir drafts | 2 borradores siguen listados | `prueba_tecnica_ok` |
| TC-EML-DRF-020 | Eliminar en Borradores | Confirmación → aparece en Papelera; no hard-delete | Pendiente browser | `pendiente_revalidacion` |
| TC-EML-TRH-010 | Restaurar desde Papelera | Vuelve a Borradores | Pendiente browser | `pendiente_revalidacion` |

## Regresión unitaria

- `lib/email/draft-template-titles.test.ts` — mapa serializable JSON-safe.
- Suite firmas / send-config previa: sin cambio de política.

## Evidencias

`_review_emails/` (capturas compositor / plantillas / edición / iconos).

## Preparación primer envío real (NO ejecutado)

Checklist controlado (staging). **No enviar** hasta autorización explícita.

1. Dominio Resend verificado + SPF/DKIM OK.
2. `RESEND_API_KEY` y `EMAIL_FROM` presentes en preview (staging).
3. Flags: `FF_CORPORATE_EMAIL_SEND_ENABLED=1` y `FF_CORPORATE_EMAIL_DRY_RUN=0` **solo** en el entorno de prueba autorizado. En `.env.staging.local` actual hay `RESEND_API_KEY` + `EMAIL_FROM`, pero **no** hay flags FF_CORPORATE → modo send OFF por defecto (seguro; no live).
4. Remitente: `pilar@farmafacil.solutions` → destinatario corporativo propio.
5. Plantilla operativa (no comercial) o sin plantilla; adjunto PDF pequeño opcional.
6. Tras envío autorizado: historial Enviados = «Enviado a Resend» (no exigir «Entregado» sin webhook).
7. Prohibido: SQL prod, merge, deploy, live en producción, envío masivo.

## Validación de usuario

Pendiente de OK visual de iconos en Borradores/Enviados/Papelera en :3040. Sin push.
