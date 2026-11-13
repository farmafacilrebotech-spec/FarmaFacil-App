# Auditoría técnica — recepción SiteGround (IMAP/SMTP)

**Estado:** solo auditoría. Sin implementación de Recibidos. Sin DNS/MX. Sin secretos en repo.  
**Fecha:** 2026-11-12 · rama `feature/emails-phase-b-send` / PR #25

## Contexto

- Cuentas `@farmafacil.solutions` ya existen en **SiteGround** (webmail).
- Envío transaccional/automático FarmaFácil usa **Resend** (flags OFF por defecto).
- Objetivo futuro: gestor corporativo con Recibidos / Enviados / Borradores / Papelera, hilos y leído/no leído.
- UI actual de Recibidos/Papelera: estado **honesto** (no conectado); no hay bandeja ficticia.

## Cuentas objetivo (gestor)

| Cuenta | Uso previsto |
|--------|----------------|
| pilar@farmafacil.solutions | Default / dirección personal |
| contacto@ | Entrada general |
| info@ | Información |
| soporte@ | Soporte |
| demo@ | Demostraciones |
| ventas@ | Ventas |
| comercial@ | Comercial |
| facturacion@ | Facturación |

## Viabilidad

| Capacidad | Viabilidad | Notas |
|-----------|------------|-------|
| IMAP sync (INBOX, Sent, Drafts, Trash) | Alta con worker | No en Vercel serverless puro |
| SMTP envío “como webmail” | Media | Duplica canal Resend; riesgo de doble envío |
| Adjuntos recibidos | Alta | Storage privado + metadatos |
| Hilos / Message-ID / In-Reply-To | Media | Parseo MIME + modelo thread |
| Leído/no leído (`\Seen`) | Alta vía IMAP FLAGS | Sync bidireccional cuidadosa |
| Sync con webmail/clientes | Alta si IMAP es fuente de verdad | Misma bandeja SiteGround |

## Parámetros técnicos típicos SiteGround (a confirmar en panel)

No se modifican DNS. Valores habituales a validar en el panel de correo:

| Protocolo | Host típico | Puerto | Seguridad |
|-----------|-------------|--------|-----------|
| IMAP | `mail.farmafacil.solutions` (o host SG del plan) | **993** | SSL/TLS |
| SMTP | mismo host | **465** (SSL) o **587** (STARTTLS) | Auth requerida |
| Webmail | panel SiteGround | — | Referencia UX |

Autenticación recomendada: **contraseña de aplicación** por buzón (no la contraseña principal del panel), rotación y mínimo privilegio.

## Limitaciones Vercel / serverless

1. **Timeouts** (10–60s): un IDLE IMAP o sync completo no encaja.
2. **Sin conexiones largas**: IMAP IDLE incompatible con funciones efímeras.
3. **Cold starts + N cuentas**: solapes y rate limits SiteGround.
4. **Credenciales**: vault (Vercel encrypted / Doppler / AWS SM); nunca en repo ni chat.
5. **IPs salientes**: SiteGround puede filtrar; worker con IP estable ayuda.

**Conclusión:** la recepción **no debe vivir en el runtime de la app Vercel**. Requiere proceso aparte.

## Arquitectura recomendada (PR independiente)

```
[App FarmaFácil / Vercel]
    │  API autenticada (platform.emails.*)
    ▼
[Postgres]  mailboxes, messages, threads, flags, adjuntos meta, audit
    ▲
[Worker Node 24/7]  ← Fly.io / Railway / Cloud Run / VPS
    │  IMAP sync (+ opcional SMTP o APPEND Sent)
    ▼
[SiteGround mail]
```

### Canales de envío (evitar duplicados)

| Tipo | Canal | Motivo |
|------|-------|--------|
| Transaccional / automático (invitaciones, presupuestos…) | **Resend** (actual) | Fiabilidad + plantillas app |
| Correo humano del gestor (fase 1) | **Resend** + From autorizado | Un solo proveedor |
| Correo humano (fase 2 opcional) | SMTP SiteGround | Solo si se unifica Enviados vía IMAP |

**Nunca** enviar el mismo mensaje por Resend y SMTP.

### Anti-duplicados en Enviados

1. Guardar `Message-ID` / `X-FF-Send-Id` en outbox FarmaFácil.
2. Sync IMAP Sent → dedupe por Message-ID.
3. Campo `origin`: `resend` | `smtp_siteground` | `imap_imported`.
4. UI Enviados unifica fuentes sin filas duplicadas.

## Seguridad y cumplimiento

- Secretos solo en vault del worker; rotación documentada.
- Sanitizar HTML recibido (`lib/email/html-sanitize.ts`); **bloquear** scripts y carga automática de imágenes remotas de tracking.
- RLS + `platform.emails.*`; auditoría de lecturas/export.
- CC/CCO con mismos límites y oposición que Para (ya en compositor).
- **No** modificar DNS/MX/SPF/DKIM en esta fase.

## Qué no hacer ahora

- Simular bandeja de Recibidos.
- Pedir o commitear contraseñas.
- Vincular/deploy del worktree a Vercel para esta revisión.
- Activar envíos reales o flags live.
- Campañas masivas.

## Dependencias para PR de recepción (siguiente)

1. Hosting del worker + secretos por buzón.
2. Migraciones: `email_mailboxes`, `email_messages`, `email_threads`, sync cursors.
3. Jobs: sync UID incremental, backfill controlado, mark-seen.
4. UI: Recibidos real, detalle, responder/reenviar, Papelera IMAP.
5. Decisión formal Resend vs SMTP para envío manual fase 2.

## Veredicto auditoría

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se puede integrar Recibidos? | **Sí**, con worker dedicado |
| ¿En esta PR / Vercel app? | **No** |
| ¿Bloquea el rediseño del compositor? | **No** — Enviados/Borradores/Plantillas siguen con Resend/outbox |
| ¿Siguiente paso tras revisión visual? | Autorizar push PR #25 (UI); recepción = PR nueva |
