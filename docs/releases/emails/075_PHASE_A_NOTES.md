# Emails Fase A + migración 075

**No aplicar 075 sin autorización.** No envía correos.

## Qué incluye la PR
- Composer `/emails/compose` (blanco o plantilla editable)
- Borradores `/emails/drafts` (listar / editar / eliminar)
- Hub `/emails` ampliado (plantillas intactas + accesos composer)
- Gate SuperAdmin en rutas `/emails/*`
- `sendCorporateEmailAction` siempre bloqueado
- Migración `075_corporate_email_drafts_outbox_v1.sql` (drafts + outbox + permisos)

## Dependencias
- Migración 075 para persistir borradores (`email_drafts`)
- Sin 075: UI de redacción/preview funciona; guardar muestra error `migration_pending`
- Resend (`lib/email/send.ts`) no se llama desde el hub en Fase A

## Orden futuro (no ahora)
1. Autorizar apply 075 en staging → smoke borradores
2. Autorizar apply 075 en prod
3. Merge/deploy PR composer
4. Más adelante: Fase B send 1:1 con `platform.emails.send` + idempotency en `email_sends`
