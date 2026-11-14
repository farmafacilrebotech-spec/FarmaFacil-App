# Pruebas Emails — PR #25 + correcciones post-producción

**Fecha aceptación manual producción:** 13/11/2026  
**Rama fix:** `fix/emails-postprod-signatures-sent` (desde `origin/main` @ `53e0512`)  
**Migración adicional:** `090_email_sends_mailbox_purposes_v1.sql` (staging; **no** prod sin autorización)

## A. Resultados de aceptación manual (producción, 13/11/2026)

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 1 | Email sin plantilla, con firma | ERROR | Gmail recibe cuerpo, no firma |
| 2 | Email sin plantilla, sin firma | OK | |
| 3 | Plantilla Lanzadera | BLOQUEADO | Clasificada como comercial |
| 4 | Email desde Soporte | ERROR | Remitente OK, sin firma |
| 5 | Email con adjuntos | PARCIAL | Llegan adjuntos, no firma |
| 6 | Borradores y papelera | OK | Edición y eliminación |
| 7 | Historial de enviados | PARCIAL | Registra envíos; no abre completo ni elimina |

## B. Causa raíz — firmas (P0)

**Causa real:** el compositor aplicaba la firma en cliente y enviaba `includeSignature: false`. El servidor ejecutaba `applySignaturePolicy` con `includeSignature !== false` → `false`, hacía `stripManagedSignature` y **no** reaplicaba. El HTML entregado a Resend quedaba sin firma. La vista previa (cliente) sí mostraba firma → falsa sensación de OK.

**Corrección:**

1. Cliente envía cuerpo **sin** firma gestionada + `includeSignature` = checkbox real.
2. Servidor construye el HTML final con `buildProviderEmailHtml` (`previewOrigin: null` → URLs HTTPS públicas).
3. Confirmación de envío muestra Firma Sí/No + nombre.
4. Snapshot en `email_sends.html_body` + `signature_included` / `signature_label` (mig. 090).

## C. Clasificación de comunicaciones

| Plantilla | Antes | Ahora |
|-----------|-------|-------|
| Lanzadera | commercial (bloqueada) | **institutional** |
| Presupuesto imprentas | commercial | **procurement** |
| Demo / Piloto | commercial | commercial (gates intactos) |

Se mantienen: bloqueo comercial no autorizado, allowlist, no masivos, no automáticos.

## D–E. Enviados + papelera

- Eye → detalle completo (snapshot HTML, firma, adjuntos descargables).
- Trash2 → Papelera de enviados; restaurar; ocultar de vista (auditoría intacta).
- Legacy sin HTML: mensaje explícito, sin reconstrucción.

## F. Otros

| Tema | Acción |
|------|--------|
| Borrador residual tras envío | `consumed_at` / `consumed_by_send_id`; no listar |
| Nombres adjuntos ES | `sanitizeAttachmentFileName` conserva tildes (+ ü) |
| Estados proveedor | «Aceptado por Resend» ≠ Entregado |
| Anti doble-clic | Guard `sending` + idempotency estable `draft+hash` |

## Controles de seguridad (sin cambio de política)

| Control | Comportamiento |
|---------|----------------|
| Allowlist destinatarios | Activa |
| Comercial no autorizado | Bloqueado |
| Masivo / auto-envío | No |
| Agente | No envía por iniciativa propia |
| Producción | **No** modificada en este fix |

## Pruebas automatizadas (HTML al proveedor)

```bash
node --experimental-strip-types --test \
  lib/email/provider-html.test.ts \
  lib/email/signature.test.ts \
  lib/email/corporate-send-policy.test.ts \
  lib/email/delivery-status.test.ts
```

Cubren: firma Pilar/Soporte con HTTPS, sin firma, no duplicar embebida, Lanzadera institucional, imprentas aprovisionamiento, label «Aceptado por Resend».

## Pruebas manuales pendientes (staging, sin prod)

- [ ] Pilar con firma → Gmail muestra firma
- [ ] Pilar sin firma
- [ ] Soporte con firma
- [ ] Contacto con firma + adjuntos (nombres con tildes)
- [ ] Lanzadera sin duplicar firma / no bloqueo comercial
- [ ] Abrir email enviado completo
- [ ] Descargar adjuntos desde Enviados
- [ ] Mover enviado a Papelera y restaurar
- [ ] Ausencia de borradores residuales
- [ ] Demo/piloto siguen bloqueados como comercial
- [ ] Confirmación muestra Firma Sí/No + nombre

## Entorno local staging (preview)

Ver informe de entrega de la sesión (puerto, rama, commit). Sin envíos reales automáticos.
