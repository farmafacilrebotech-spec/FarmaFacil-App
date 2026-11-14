# Pruebas funcionales Emails — preview :3065 (staging)

**Rama:** `fix/emails-postprod-signatures-sent`  
**Worktree:** `.worktrees/emails-postprod`  
**Supabase:** staging · **No** producción · **No** tocar Contratos :3060

## Qué bloqueaba Enviar

`FF_CORPORATE_EMAIL_SEND_ENABLED` no estaba definido → `getCorporateEmailSendMode()` devolvía `enabled: false` → botón `disabled`.

## Configuración local del preview (solo este worktree)

Archivo `.env.development.local` (no prod):

- `FF_CORPORATE_EMAIL_SEND_ENABLED=1`
- `FF_CORPORATE_EMAIL_DRY_RUN=0` (envío real a Resend al confirmar)
- `FF_CORPORATE_EMAIL_TEST_RECIPIENTS=pilar.reyesbononat@gmail.com`

Backend: To / CC / CCO fuera de la allowlist → bloqueados. Sin allowlist en live → bloqueado.  
**Ningún envío automático;** solo tras Confirmar en la UI.

## Checklist manual

| # | Caso | OK |
|---|------|----|
| 1 | Redactar email (asunto + cuerpo) | ☐ |
| 2 | Seleccionar cuenta remitente → firma se actualiza | ☐ |
| 3 | Incluir firma (checkbox) y verla en editor | ☐ |
| 4 | Adjuntar PDF | ☐ |
| 5 | Guardar borrador | ☐ |
| 6 | Recuperar y editar borrador | ☐ |
| 7 | Guardar como plantilla | ☐ |
| 8 | Recuperar plantilla | ☐ |
| 9 | Enviar solo a destinatario allowlist | ☐ |
| 10 | Destinatario no allowlist → bloqueado | ☐ |
| 11 | Consultar email enviado (HTML + firma) | ☐ |
| 12 | Descargar adjuntos | ☐ |
| 13 | Mover a papelera y restaurar | ☐ |
| 14 | Filtrar por cuenta y estado | ☐ |
| 15 | Estado «Aceptado por el proveedor» ≠ Entregado | ☐ |
| 16 | Sin envío duplicado (doble clic) | ☐ |

## Estados

| Etiqueta | Significado |
|----------|-------------|
| Pendiente | Aún no aceptado por Resend |
| Aceptado por el proveedor | Resend aceptó (`accepted`). **No** es entregado |
| Entregado | Solo con webhook/`delivered_at` (hoy **no** hay webhooks Resend en la app) |
| Error de envío / Rebotado / Bloqueado | Fallo o rechazo |

## Firmas

- Checkbox «Incluir firma» + cambio de remitente aplica firma de esa cuenta (HTTPS públicas).
- Plantilla con firma embebida: no duplica.
- Snapshot en `email_sends.html_body` + `signature_included` / `signature_label`.
