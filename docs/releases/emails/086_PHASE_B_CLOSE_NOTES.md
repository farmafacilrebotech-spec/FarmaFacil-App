# Emails Fase B — cierre funcional (086)

## Migraciones
| # | Contenido | Staging | Producción |
|---|-----------|---------|------------|
| 075 | drafts/outbox/permisos | OK | OK |
| 085 | purpose/suppression/RPCs/attachments meta | OK | **NO** (sin autorización) |
| 086 | draft attachments, from_key, provider_status, Storage policies, Excel MIME, claim/finalize ampliados | aplicar | **NO** |

## Funcionalidad
- Adjuntos: upload multiarchivo, magic bytes, PDF/Word/Excel/PNG/JPG, Storage privado, persistencia en borrador, `source_kind` para docs generados FF.
- Remitentes: catálogo cerrado (8 direcciones `@farmafacil.solutions`); default `pilar`; sin From arbitrario.
- Historial: pendiente / enviado a Resend / entregado (solo webhook) / error / rebotado / bloqueado.
- Compliance: plantilla comercial fuerza gates aunque se marque operativa.

## Flags (sin cambiar en prod sin autorización)
| Variable | Efecto |
|----------|--------|
| `FF_CORPORATE_EMAIL_SEND_ENABLED` | Activa camino de envío |
| `FF_CORPORATE_EMAIL_DRY_RUN` | Default dry-run; `0` = live Resend |
| `FF_CORPORATE_EMAIL_ALLOWED_FROM_KEYS` | Allowlist opcional de claves |
| `FF_CORPORATE_EMAIL_VERIFIED_DOMAIN` | Override dominio autorizado |
| `RESEND_API_KEY` / `EMAIL_FROM` | Proveedor |

## Prueba real controlada (PENDIENTE autorización)
1. Confirmar dominio Resend verificado + SPF/DKIM.
2. Staging: flag send ON + dry-run OFF solo en entorno de prueba.
3. De: `pilar@farmafacil.solutions` → otra dirección corporativa propia.
4. Adjunto: PDF de prueba pequeño.
5. Verificar historial = «Enviado a Resend» (no «Entregado»).
6. **No ejecutar sin autorización explícita.**

## No hacer
- SQL 085/086 en producción
- Merge/deploy
- Activar live send en producción
- Módulo Asistente
