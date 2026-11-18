# PRE-05C — Envío real pendiente de autorización

## Destinatario autorizado de prueba

`pruebas@farmafacil.solutions`

## Protecciones activas (staging :3070)

| Control | Estado |
|---|---|
| `FF_CORPORATE_EMAIL_TEST_RECIPIENTS` | Incluye `pruebas@farmafacil.solutions` (+ allowlist previa) |
| `assertCorporateEmailRecipientsAllowed` | Bloquea cualquier To fuera de la lista |
| `FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN` | En el daemon de prueba suele ir a `1` (simulación). Para envío real hay que arrancar con `0` **solo** tras autorización |
| EMAIL-10 | Sin cambios; no se toca el compositor corporativo |
| Producción | Sin deploy |

## Motor PDF

Descarga UI y adjunto de email usan el mismo `buildCommercialQuotePdf` → plantilla HTML corporativa → Chromium.

## No ejecutar todavía

El envío real a Resend **no se ha lanzado**. Requiere autorización expresa de la usuaria en este hilo tras validar dry-run + estados + logo + periodicidad.
