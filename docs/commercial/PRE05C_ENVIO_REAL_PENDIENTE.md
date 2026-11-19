# PRE-05C — Envío real autorizado (ejecutado)

## Destinatario

`pruebas@farmafacil.solutions` (único destinatario de la prueba)

## Resultado (2026-11-18)

| Campo | Valor |
|---|---|
| Presupuesto | `FF-PRE-20261118-F0TQ` (Farmacia Nupre) |
| Entorno | staging `127.0.0.1:3070` · `integration/farmafacil-release` |
| Proveedor | Resend |
| Provider message id | `01a1ee59-ce8c-7d05-8a86-570d83a372cf` |
| Estado comercial tras aceptación Resend | **Enviado** (`sent`) |
| Adjunto | PDF corporativo vía `buildCommercialQuotePdf` (mismo motor que descarga) |
| Dry-run tras la prueba | **Restaurado** (`FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN=1`, `FF_CORPORATE_EMAIL_DRY_RUN=1`) |

## Protecciones

- Allowlist `FF_CORPORATE_EMAIL_TEST_RECIPIENTS` con `pruebas@farmafacil.solutions`
- `assertCorporateEmailRecipientsAllowed` activo
- EMAIL-10 sin cambios de compositor
- Sin deploy a producción ni cambios en `main`

## Pendiente de validación humana

Confirmar recepción en el buzón `pruebas@farmafacil.solutions` (asunto, PDF corporativo, importes). PRE-05 no se cierra hasta esa confirmación.
