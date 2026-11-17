# Cierre EMAIL-10 — 2026-11-17

## Estado

**Cerrado en `integration/farmafacil-release`.** Validación real confirmada por la propietaria en Gmail.

No desplegado a producción. Sin merge a `main`.

## Qué quedó validado

Envío normal («Enviar», sin `[PRUEBA]`) desde el compositor real de FarmaFácil, con plantillas corporativas intactas, imágenes, firmas y remitentes autorizados.

| Plantilla | Remitente | Asunto UI-FINAL | Resend | HTML |
|---|---|---|---|---|
| Material corporativo | pilar@ | `…pilar@ 2026-11-17T22-17-48-295Z` | `01a1eb96-821c-7867-a8b8-77db296bc627` | 59 087 B · 2 imgs |
| Material corporativo | info@ | `…info@ 2026-11-17T22-30-00-000Z` | `01a1eb98-85b7-77ce-837f-6c4dcc5c6075` | 59 087 B · 2 imgs |
| Piloto (+ nota) | pilar@ | `…Piloto pilar@ 2026-11-17T22-30-00-000Z` | `01a1eb98-a1ab-76a9-90e0-6df220060df5` | 16 041 B · 2 imgs · nota |
| Demostración | demo@ | `…Demostración demo@ 2026-11-17T22-30-00-000Z` | `01a1eb98-ba91-7e2f-b757-7a3e61bc3fdf` | 15 935 B · 6 imgs |
| Lanzadera | pilar@ | `…Lanzadera pilar@ 2026-11-17T22-30-00-000Z` | `01a1eb9a-1a0c-7b35-939e-ad6da4e783b6` | 24 848 B · 6 imgs |

Evidencias UI: `tmp/email10-ui-final/*-{composer,confirm,enviados,detalle}.png` y `tmp/email10-ui-final/results-final.json`.

## Reglas funcionales consolidadas

- Destinatario manual: cualquier email válido; sin exigir Cartera ni consentimiento comercial registrado para habilitar el envío 1:1.
- Aviso comercial: informativo, no bloqueante.
- Plantilla ↔ remitente: sugerencia, no bloqueo (salvo autorización del usuario / proveedor).
- «Enviar» y «Enviar prueba» comparten composición y transporte; la diferencia es destinatario de prueba, prefijo `[PRUEBA]` y marcado de registro.
- Toasts de éxito solo con identificador real de Resend (salvo dry-run explícito → «Envío simulado»).

## Incidencia residual (corregida en el cierre)

En Piloto con nota personalizada, el HTML enviado incluía el hint del editor («Escribe aquí un mensaje adicional…»).  
**Corrección:** `stripComposerUiHints` en `lib/email/composer-template-lock.ts` + test permanente. No se reenvió correo real para esta microcorrección.

## Migraciones Emails (staging)

| Nº | Descripción |
|---|---|
| …089 | Histórico Emails |
| 100 | `ff_corporate_email_claim_send_v1` — envío manual comercial sin exigir `legal_basis` |

Aplicada en proyecto staging `dazfdcjscnpfvhcyjddt`. Versionada en el repo.

## Automatización / gate

- Matriz plantilla × remitente: `npm run test:email-delivery`
- Circuito compositor (transporte controlado): `e2e/p1/emails-composer-circuit.spec.ts`
- Envíos reales opt-in: `EMAIL10_UI_FINAL=1 npm run staging:email10-ui-final` (no en gate ordinario)
- Gate E2E full sobre `:3070` con transporte controlado (sin nuevos envíos reales)

## Commits de consolidación (rama integración)

Ver `git log` en `integration/farmafacil-release` (EMAIL-09, EMAIL-10 claim/manual, UI-FINAL tests, strip hints).

## Fuera de alcance de este cierre

- Producción / merge a `main`
- Cartera de farmacias (filtro de habilitadas) — pendiente de modelo
- Nuevas plantillas o rediseños

## Continuidad

Las pruebas funcionales del resto de FarmaFácil continúan sobre esta misma versión integrada y el servidor `:3070`.
