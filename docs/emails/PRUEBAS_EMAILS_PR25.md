# Pruebas Emails — PR #25 (documento vivo)

**Entorno:** staging preview `http://127.0.0.1:3040`  
**Fecha:** 2026-11-12  
**Rama:** `feature/emails-phase-b-send`  
**Estado global:** UI aprobada · **primera prueba real preparada (sin auto-envío)** · sin push/merge/deploy

## Incidencias y resolución

| ID | Incidencia | Estado | Resolución |
|----|------------|--------|------------|
| INC-EML-001 | `/emails/drafts` rompía con templateTitle función | **Resuelta** | Mapa serializable en servidor |
| INC-EML-002 | Botones Plantillas cortaban nombres | **Resuelta** | Iconos + tooltips |
| INC-EML-003 | Renombrar ≠ edición WYSIWYG | **Resuelta** | Modo editTemplate |
| INC-EML-004 | Migas duplicadas | **Resuelta** | Solo cabecera |
| INC-EML-005 | Botones grandes Abrir/Eliminar | **Resuelta** | Iconos; trash → Papelera |

## Controles de seguridad para envío real (staging)

| Control | Valor / comportamiento |
|---------|------------------------|
| Supabase | Staging `dazfdcjscnpfvhcyjddt` (`.env.local` local del worktree emails; **no** prod) |
| `FF_CORPORATE_EMAIL_SEND_ENABLED` | `1` (solo preview :3040) |
| `FF_CORPORATE_EMAIL_DRY_RUN` | `0` (live Resend) |
| `FF_CORPORATE_EMAIL_TEST_RECIPIENTS` | `pilar.reyesbononat@gmail.com` (To/CC/CCO) |
| `FF_CORPORATE_EMAIL_ALLOWED_FROM_KEYS` | `pilar` (primera prueba) |
| Comercial | Sigue bloqueado sin Cartera / ack |
| Masivo / campañas | No existen en este módulo |
| Producción Vercel / `.env` prod | **No modificado** |
| Auto-envío | **No** — solo botón Enviar de la usuaria |

Allowlist backend: `lib/email/send-recipient-allowlist.ts` (usado en `sendCorporateEmailAction`).

## Credenciales / dominio

| Comprobación | Resultado |
|--------------|-----------|
| `RESEND_API_KEY` presente | Sí (clave restringida a **solo envío**; `/domains` API → 401 restricted_api_key, esperado) |
| `EMAIL_FROM` | `FarmaFácil <contacto@farmafacil.solutions>` (fallback; el From del mensaje usa `pilar@` del catálogo) |
| Remitente prueba | `pilar@farmafacil.solutions` (catálogo cerrado) |
| Firma Pilar (local preview) | `/images/email/firma-pilar.png` en app |
| Firma Pilar (URL pública web) | Verificar en bandeja tras envío (foto puede resolverse vía origin del preview o URL pública) |

## Borrador preparado — primera prueba

| Campo | Valor |
|-------|-------|
| Draft ID | `07284d59-8a49-477f-8b21-f4f94e21ef92` |
| URL | `http://127.0.0.1:3040/emails/compose?draft=07284d59-8a49-477f-8b21-f4f94e21ef92` |
| De | `pilar@farmafacil.solutions` |
| Para | `pilar.reyesbononat@gmail.com` |
| Asunto | `FarmaFácil \| Primera prueba de envío` |
| Tipo | `operational` |
| Adjunto | `primera-prueba-envio.pdf` |
| Firma | Activar **Incluir firma** en compositor antes de Enviar |

**Acción pendiente de la usuaria:** abrir la URL y pulsar **Enviar**.

## Checklist post-envío (cuando pulses Enviar)

| # | Comprobación | Estado |
|---|--------------|--------|
| 1 | Aparece en `/emails/sends` | pendiente |
| 2 | Historial = «Enviado a Resend» (aceptación) | pendiente |
| 3 | `provider_message_id` (id Resend) visible en detalle | pendiente |
| 4 | Distinguir aceptación vs entrega vs error | pendiente |
| 5 | Adjunto PDF llega al buzón | pendiente |
| 6 | Firma Pilar visible en el correo | pendiente |
| 7 | Sin duplicados (reintento idempotente / no doble click) | pendiente |
| 8 | Comercial sigue bloqueado | N/A (esta prueba es operativa) |

## Próximas oleadas (después de esta)

1. Otros remitentes corporativos (ampliar `ALLOWED_FROM_KEYS`).  
2. CC / CCO (ampliar allowlist si hace falta).  
3. Plantillas operativas (no comerciales).

## Casos de navegación (previos)

| ID | Estado |
|----|--------|
| TC-EML-NAV-001…006 | `prueba_tecnica_ok` |
| TC-EML-DRF-020 / TRH-010 | `prueba_tecnica_ok` |
| TC-EML-SEND-001 primera real | `preparado_pendiente_click_usuario` |

## Evidencias

`_review_emails/` + PDF `primera-prueba-envio.pdf`.

## Validación

Sin push / merge / deploy hasta tu OK tras la prueba real.
