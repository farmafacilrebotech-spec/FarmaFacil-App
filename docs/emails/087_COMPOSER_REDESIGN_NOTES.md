# Emails — rediseño compositor y plantillas (087)

## UI
- Shell: Recibidos · Enviados · Borradores · Plantillas · Papelera · Nuevo email
- Compositor compacto (una caja, estilo Gmail): De / Para / CC / CCO / Asunto + WYSIWYG
- Sin editor HTML ni texto plano en UI habitual
- Recibidos/Papelera: estado honesto (sin bandeja ficticia) hasta IMAP

## Migración 087 (solo staging)
- `email_templates` CRUD
- `cc_emails` / `bcc_emails` en drafts/sends
- Cuentas: demo, comercial, facturacion (+ legado)
- Claim RPC con CC/CCO y tope 5 destinatarios

## Cumplimiento
- Para=1 · CC≤2 · CCO≤2 · total≤5
- Misma lista de oposición / comercial en todos los destinatarios
- HTML sanitizado al guardar/enviar

## Recepción
Ver `SITEGROUND_IMAP_AUDIT.md` → PR independiente (worker).
