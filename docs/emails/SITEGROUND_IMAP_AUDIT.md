# Auditoría técnica — recepción SiteGround (IMAP/SMTP)

**Estado:** solo auditoría. Sin implementación de Recibidos. Sin DNS/MX. Sin secretos en repo.

## Contexto

- Cuentas `@farmafacil.solutions` ya existen en **SiteGround** (webmail).
- Envío transaccional/automático FarmaFácil usa **Resend** (flags OFF por defecto).
- Objetivo futuro: gestor corporativo con Recibidos / Enviados / Borradores / Papelera, hilos y leído/no leído.

## Viabilidad

| Capacidad | Viabilidad | Notas |
|-----------|------------|-------|
| IMAP sync (INBOX, Sent, Drafts, Trash) | Alta con worker | No en Vercel serverless puro |
| SMTP envío “como webmail” | Media | Duplica canal Resend; riesgo de doble envío |
| Adjuntos recibidos | Alta | Guardar en Storage privado + metadatos |
| Hilos / Message-ID / In-Reply-To | Media | Requiere parseo MIME y modelo de thread |
| Leído/no leído (\\Seen) | Alta vía IMAP FLAGS | Sync bidireccional cuidadosa |
| Sync con webmail/clientes | Alta si IMAP es fuente de verdad | No inventar bandeja local aislada |

## Limitaciones Vercel / serverless

1. **Timeouts** (típicamente 10–60s): un IDLE IMAP o sync completo de buzón no encaja.
2. **Sin conexiones largas**: IMAP IDLE / keep-alive no es compatible con funciones efímeras.
3. **Cold starts + N cuentas**: riesgo de solapes y rate limits SiteGround.
4. **Credenciales**: no pueden vivir en el repo ni en chat; vault (Vercel encrypted env / Doppler / AWS SM) + rotación.
5. **IPs salientes**: SiteGround puede limitar por IP; workers con IP estable ayudan.

## Arquitectura recomendada (PR independiente)

```
[App FarmaFácil / Vercel]
    │  API autenticada (platform.emails.*)
    ▼
[Postgres]  mensajes, carpetas, flags, adjuntos meta, audit
    ▲
[Worker Node 24/7]  ← Fly.io / Railway / Cloud Run / VPS
    │  IMAP (lectura/sync) + opcional SMTP
    ▼
[SiteGround mail]
```

- **Fuente de verdad recepción:** IMAP SiteGround.
- **Envíos transaccionales:** siguen en **Resend** (invitaciones, presupuestos, etc.).
- **Envíos manuales del gestor:** decidir un solo canal:
  - **Opción A (recomendada fase 1):** Resend con From autorizado + BCC a la propia cuenta Sent vía IMAP APPEND, o
  - **Opción B:** SMTP SiteGround para “correo humano” y Resend solo automático.
- Evitar **doble envío**: nunca Resend + SMTP del mismo mensaje.

### Anti-duplicados Enviados

1. Guardar `Message-ID` propio en outbox FarmaFácil.
2. Al sync IMAP Sent, dedupe por `Message-ID` / `X-FF-Send-Id`.
3. Marcar origen: `resend` | `smtp_siteground` | `imap_imported`.
4. UI Enviados unifica ambas fuentes sin duplicar filas.

## Seguridad

- App passwords / cuentas de aplicación SiteGround; mínimo privilegio por buzón.
- Cifrado en reposo de secretos; acceso solo al worker.
- Sanitizar HTML recibido (ya preparado en `lib/email/html-sanitize.ts`); **no** cargar imágenes remotas de tracking por defecto.
- RLS + `platform.emails.*`; auditoría de lecturas/export.
- No modificar DNS/MX en esta fase.

## Qué no hacer ahora

- Simular bandeja de Recibidos.
- Pedir o commitear contraseñas.
- Cambiar MX/SPF/DKIM sin plan DNS aparte.
- Mezclar campañas masivas.

## Dependencias para PR de recepción

1. Worker hospedado + secretos.
2. Migraciones: `email_mailboxes`, `email_messages`, `email_threads`, sync cursors.
3. Jobs: sync incremental UID, backfill controlado.
4. UI: Recibidos real + detalle + responder/reenviar.
5. Decisión Resend vs SMTP para envío manual.

## Conclusión

**Recepción viable**, pero **no en el runtime Vercel actual**. Mantener PR #25 centrada en compositor/plantillas/envío controlado; abrir **PR aparte** para IMAP worker cuando se autorice infraestructura.
