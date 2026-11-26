# Entrega QA kiosko / material publicitario — K02–K07

**Fecha:** 2026-11-26  
**Rama:** `fix/qa-kiosk-acceptance-k02-k07`  
**Staging URL:** https://farmafacil-staging.vercel.app  
**Supabase staging:** `dazfdcjscnpfvhcyjddt` · migración **105** aplicada  
**APK:** código Android actualizado a `0.2.14-staging` · **APK binario pendiente de compilar** (sin JDK en el agente)

---

## 1. Incidencias corregidas

| Id | Estado | Resumen |
|----|--------|---------|
| **K02** | Código listo · requiere APK nueva + deploy web | Ticket térmico: logo sin texto FARMAFÁCIL, nº grande, valoración pendiente, un solo mensaje de pago, QR centrado + CTA + eslogan. QR = `/o/{token}` opaco (E2 mínimo). |
| **K03** | Listo en web | `0`/`null` → «Consultar precio» / «Pendiente de valoración»; carrito y ticket no presentan total definitivo si hay pendientes; pedidos kiosko admiten total 0. |
| **K04** | Parcial | Textos por defecto + «Acércate al mostrador». **Bloqueo:** `OPENAI_API_KEY` no está en entorno staging (local ni, presumiblemente, Vercel). |
| **K05** | Listo en web · APK para banner nativo | Colores corporativos, marcas basura ocultas, asistente más grande, banner web oculto si UA `FarmaFacilKiosk`. |
| **K06** | Parcial | Clip circular logo FF, preview pestaña nueva, A5, marca PRUEBA-STAGING. **Bloqueo:** faltan originales aprobados exactos → `BLOQUEO_K06_ORIGINALES_CARTELES_2026-11-26.md`. |
| **K07** | Listo | En staging: sección QR pruebas vs QR oficial producción; descargas staging con nombre `…-staging-…`. No se alteran `public_id` ni QR de producción. |

---

## 2. Archivos principales modificados

### Web (worktree)
- Ticket / pedido: `components/kiosk/kiosk-order-ticket.tsx`, `kiosk-cart-view.tsx`, `lib/orders/create-order.ts`, `order-access-token.ts`, `app/o/[token]/page.tsx`, `middleware.ts`
- Precios: `lib/catalog/price-display.ts`, `lib/kiosk/catalog-display.ts`, panel catálogo farmacia
- Asistente / UI kiosko: `kiosk-assistant-view.tsx`, `settings*.ts`, pantallas kiosko, `staging-banner.tsx`
- QR / carteles: `qr-tab.tsx`, `print-entrypoint-url.ts`, `qr-download.ts`, posters helpers
- SQL: `supabase/migrations/105_kiosk_order_access_token_v1.sql` (**aplicada en staging**)

### Android (`android-kiosk/`, árbol principal, aún untracked en git remoto)
- `KioskTicketBitmap.kt`, `KioskTicketQr.kt` (ZXing), `KioskTicketPayload.kt`, `IcodPrintableWidth.kt`, `MainActivity.kt` (UA), `build.gradle.kts` (0.2.14 + zxing), tests

---

## 3. Pruebas ejecutadas

| Suite | Resultado |
|-------|-----------|
| `lib/catalog/price-display.test.ts` | OK |
| `npm run test:kiosk-catalog-display` | OK |
| `npm run test:pharmacy-qr` (48) | OK |
| `lib/orders/cart-validation.test.ts` | OK |
| `npx tsc --noEmit` | OK |
| Unit tests Android | No ejecutados (sin JDK) |
| E2E Playwright | No ejecutados en esta entrega |
| Prueba física ticket/QR en K2101 | Pendiente usuaria con APK 0.2.14 |

---

## 4. Dependencias / bloqueos

1. **APK TEST 0.2.14-staging:** compilar en máquina con JDK 17 y entregar por USB (sin ADB). Conservar APK producción y su vinculación.
2. **OPENAI en Vercel staging:** sin clave el asistente seguirá respondiendo «aún no está configurado». No activar consumo de pago sin autorización; usar farmacia QA Fase7 con límite controlado.
3. **K06 originales:** adjuntar PDF/PNG aprobados antes de igualar pixel-perfect los carteles.
4. **Claim E2 completo** (login cliente + vincular pedido): solo consulta de estado `/o/{token}` en esta entrega; claim atómico queda pendiente en plan maestro (camino E2 → E1).
5. **P0 claim por teléfono:** sigue deshabilitado; no reactivado.
6. **Catálogo maestro enriquecimiento:** fuera de alcance (línea paralela).
7. **Medicamentos en canales públicos:** sigue bloqueante pre-lanzamiento (registrado).

---

## 5. Checklist aceptación manual (reducido)

### Kiosko físico (APK TEST nueva)
- [ ] Un solo banner STAGING
- [ ] Catálogo: precio 0 → «Consultar precio»; se puede añadir
- [ ] Carrito: «Pendiente de valoración» + subtotal valorado si aplica
- [ ] Pedido + ticket ICOD: logo sin texto FARMAFÁCIL, nº grande, un mensaje de pago, QR grande, «Consulta el estado…», eslogan
- [ ] Escanear QR → staging `/o/…` con estado del pedido (no teléfono, no nº predecible solo)
- [ ] Asistente: nombre/bienvenida correctos; si no hay OpenAI → mensaje claro; consult off → «Acércate al mostrador»

### Panel STAGING
- [ ] QR: sección pruebas STAGING vs oficial producción
- [ ] Carteles: preview en pestaña nueva; descarga con nombre descriptivo; marca PRUEBA-STAGING en materiales de prueba
- [ ] Catálogo farmacia: PVP 0 no muestra 0,00 € como precio real

---

## 6. ¿Hace falta nueva APK TEST?

**Sí.** Cambios de ticket (QR dibujado, layout) y User-Agent viven en nativo.  
Instalación por pendrive USB, flavor `staging`, sin tocar la app de producción ni re-emparejar kioskos productivos.

---

## 7. Notas de despliegue

- Migración **105** ya aplicada en BD staging.
- Tras merge/deploy de la rama a `farmafacil-staging`, validar `/o/{token}` y creación de pedido con `accessUrl`.
- No modificar producción ni emparejamientos existentes.
