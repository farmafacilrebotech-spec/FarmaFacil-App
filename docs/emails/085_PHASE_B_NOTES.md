# Emails Fase B — envío 1:1

## Migraciones
- **075** drafts/outbox/permisos — ya aplicada en staging y producción (RO 2026-11-12).
- **085** purpose/consent/suppression/attachments meta + RPCs claim/finalize — **solo staging** hasta autorización prod.

## Flags servidor
| Variable | Default | Efecto |
|----------|---------|--------|
| `FF_CORPORATE_EMAIL_SEND_ENABLED` | unset/off | Bloquea send en app |
| `FF_CORPORATE_EMAIL_DRY_RUN` | dry-run ON si send ON | No llama Resend; cierra outbox como sent dry-run |
| `RESEND_API_KEY` | — | Requerido para live |
| `EMAIL_FROM` | — | Remitente; UI también usa `FF_EMAIL_FROM` |

Live real: `FF_CORPORATE_EMAIL_SEND_ENABLED=1` **y** `FF_CORPORATE_EMAIL_DRY_RUN=0`.

## Compatibilidad
- Invitaciones / presupuestos siguen usando `sendTransactionalEmail` sin cambios de contrato (solo adjuntos opcionales añadidos).
- Sin envíos masivos.

## No hacer sin autorización
- SQL 085 en producción
- `DRY_RUN=0` en producción
- Merge/deploy
