# EMAIL-01 — Diagnóstico imágenes rotas en plantillas

**Fecha:** 13/11/2026  
**Preview:** `:3065` · worktree `emails-postprod`  
**IMAP:** fuera de alcance

## Causa exacta

Las plantillas (Lanzadera, demo, piloto, imprentas) se cargan en el compositor con `imageMode: 'preview'`, que genera:

- `src="/images/kiosk/..."` (relativo), o
- `src="http://127.0.0.1:3065/images/..."` (preview local)

Ese HTML se enviaba a Resend **sin reescribir** las URLs. Gmail no puede cargar localhost ni rutas relativas → iconos y foto de firma rotos.

Las firmas **sin plantilla** ya usaban HTTPS `www.farmafacil.solutions` vía `buildProviderEmailHtml` + `signature.ts` → por eso funcionaban.

## URLs públicas verificadas (HTTP 200, image/png)

| Recurso | URL estable |
|---------|-------------|
| Foto Pilar | `https://www.farmafacil.solutions/images/email/firma-pilar.png` |
| Logo | `https://www.farmafacil.solutions/images/logo/farmafacil-logo.png` |
| Iconos módulo | `https://app.farmafacil.solutions/images/kiosk/kiosk-{qr,cart,search,ai}.png` |

`www.../images/kiosk/*` → **404** (no usar).  
SVG no se usan en firmas/plantillas de envío (solo PNG).

## Corrección

1. `lib/email/provider-assets.ts` — reescribe todos los `<img src>` a HTTPS públicos al construir el payload Resend.  
2. `buildProviderEmailHtml` — aplica reescritura siempre.  
3. EMAIL-05 — al enviar con «Incluir firma», se elimina la firma legacy embebida y se aplica la dinámica (una sola).  
4. Semillas del compositor (`compose-catalog`) — strip de firma embebida + `preferDynamicSignature`.

## No tocado

- Snapshots históricos en `email_sends`.  
- Bloqueo comercial.  
- Contratos `:3060` / producción.
