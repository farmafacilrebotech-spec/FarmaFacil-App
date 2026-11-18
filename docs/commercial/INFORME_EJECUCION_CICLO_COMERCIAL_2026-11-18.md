# Informe de ejecución — ciclo comercial + PRE-05B

Rama: `integration/farmafacil-release` · Servidor `http://127.0.0.1:3070` · Staging `dazfdcjscnpfvhcyjddt` · Sin despliegue a producción.

## PRE-05B (residual PDF)

| Ítem | Estado | Evidencia |
|---|---|---|
| Generador HTML→PDF reutilizable | Hecho | `lib/pdf/html-to-pdf.ts` (`puppeteer-core` + Chrome local / `@sparticuz/chromium` en Vercel) |
| Descarga PDF usa plantilla corporativa | Hecho | `lib/commercial/quote-pdf.ts` → `buildQuoteDocumentHtml` → `renderHtmlToPdf` |
| Adjunto email usa la misma plantilla | Hecho | `sendCommercialQuoteEmailAction` llama a `buildCommercialQuotePdf` (mismo path) |
| next.config external packages | Hecho | `puppeteer-core`, `@sparticuz/chromium` |
| Tests | OK | `npm run test:pre05b-pdf` (2/2) · smoke `tmp/pre05b-smoke-presupuesto.pdf` (~691 KB, `%PDF-`, logo data-URI) |

Ya no se usa el diseño jsPDF para presupuestos comerciales. jsPDF permanece solo en carteles/welcome pack.

## PRE-05C (bloqueante UI descarga/envío)

**Causa raíz:** el adapter de middleware de Next 13.5 reescribía `Location: http://127.0.0.1:3070/login…` → `http://localhost:3070/login…`. Las cookies de sesión son host-only; las Server Actions desde `127.0.0.1` seguían el redirect cross-host y fallaban con `Failed to fetch` / CORS.

**Corrección:** `skipMiddlewareUrlNormalize: true` en `next.config.js` + Location construida desde el header `Host` (`middlewareRedirect`). Origen de arranque `:3070` alineado a `http://127.0.0.1:3070`. Envío de prueba con `FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN=1` (PDF sí, Resend no).

| Prueba | Resultado |
|---|---|
| E2E `commercial-quote-pdf.spec.ts` (middleware + descarga UI + envío dry-run) | 3/3 pass |
| E2E `commercial.spec.ts` | 10/10 pass |
| Location `/tarifas` sin sesión | `/login?next=%2Ftarifas` (sin `localhost`) |

## Piloto / planes / contratación

| Ítem | Estado | Notas |
|---|---|---|
| Plan en prueba vs contrato | Hecho | `ff_commercial_trial_set_plan_v1` (101) + UI «Cambiar plan en prueba» |
| Assign exige confirmación de contrato | Hecho | Checkbox «Confirmo la contratación» + `confirmContract: true` en diálogo sin piloto |
| Labels sin Starter comercial | Hecho | E2E «no listan Starter» OK |
| Preparar piloto: selector plan | Hecho | E2E selector General/Personalizado/IA OK |
| Estados piloto en castellano | Hecho | Ficha farmacia |

## Implantaciones / compensaciones

| Ítem | Estado | Notas |
|---|---|---|
| Tabla staging | Presente | `pharmacy_implantation_payments` |
| Motor compensación | Hecho | `lib/commercial/implantation-payments.ts` + tests |
| UI registro | Hecho | Panel en ficha → pestaña Contrato |
| Actions | Hecho | `app/(app)/farmacias/implantation-actions.ts` |
| Aplicación al presupuesto | Hecho | Al guardar con `pharmacyId`: reduce one-time, línea `one_time_discount`, marca pagos, refleja en HTML/PDF |

## Emisor / configuración corporativa

| Ítem | Estado | Notas |
|---|---|---|
| `platform_issuer_profile` | Presente en staging | Migr. 103/104 |
| UI SuperAdmin | Hecho | `/configuracion/emisor` · E2E OK · NIF/IBAN vacíos hasta verificación |

## Verificación ejecutada (esta sesión)

```
npm run test:pre05b-pdf          → 2/2 pass
npm run test:commercial-ui       → 33/33 pass
npm run test:commercial-quotes   → 13/13 pass
playwright e2e/p1/commercial.spec.ts --workers=1 → 10/10 pass (:3070)
```

EMAIL-10: no reenviado. Gate e2e comercial sin UI-FINAL de emails.

## Fuera de alcance / pendiente explícito

- Condiciones jurídicas definitivas (contrato, anexos, facturas)
- Firma definitiva / emisión fiscal
- Sociedad emisora (enero)
- Reparación histórica Piloto Integral (solo con autorización)
- Despliegue producción (no solicitado)
