# Cierre parcial — estabilización ciclo comercial (2026-11-18)

Rama: `integration/farmafacil-release` · Servidor `:3070` · Staging.

## Causas raíz

1. **Cambiar plan con piloto abierto** llamaba a `ff_assign_commercial_plan_v1`, que cancelaba el trial `ready` y creaba suscripción `active` (incidencia Farmacia Piloto Integral).
2. **Starter visible** como nombre de plan técnico en ficha/listados.
3. **Presupuesto HTML/PDF** no usaba la plantilla corporativa aprobada (PRE-05).

## Corregido

| Bloque | Entrega |
|---|---|
| B0 | Plantillas PRE-05 ancladas + snapshot lectura Piloto Integral |
| B1–B2 | `ff_commercial_trial_set_plan_v1` (101); assign exige contrato; UI plan en prueba |
| B3 | Estados en castellano; labels comerciales; emisor en Configuración |
| B4 | Tabla `pharmacy_implantation_payments` (102) + compensación sin doble uso |
| B5 | Generador HTML corporativo PRE-05 + regresiones BHP4 |
| B6 | `platform_issuer_profile` (103); NIF/IBAN vacíos hasta verificación |
| B7 | E2E prep selector / emisor / no Starter comercial |

## Migraciones staging

- 101 trial set plan + contract guard
- 102 implantation payments
- 103 issuer profile

## Decisiones pendientes

- Condiciones devolución/cesión kioskos
- Textos jurídicos definitivos (contrato, anexos, facturas)
- Firma definitiva / emisión fiscal
- Sociedad emisora (enero)
- Reparación histórica de Piloto Integral (solo con autorización)

## Checklist manual reducida

1. Abrir un piloto Preparado → Cambiar plan en prueba → Personalizado: sin suscripción nueva.
2. Descargar presupuesto Personalizado 2027 1 kiosko: tipografía/logo vs ejemplo aprobado.
3. Configuración → Datos del emisor: campos fiscales vacíos visibles.

EMAIL-10: no reenviar; gate con transporte controlado.
