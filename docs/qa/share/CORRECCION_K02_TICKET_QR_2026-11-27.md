# Corrección K02 — regresión estética del ticket y ausencia de QR

**Fecha:** 2026-11-27  
**Rama:** `integration/farmafacil-staging-2026-11-24`  
**APK físico probado:** `FarmaFacil-TEST-0.2.15-staging.apk` (respaldo; **no** se recompila hasta aprobación visual)  
**Evidencia física:** tickets 0186 (diseño anterior) vs 0187 (regresión) — foto `IMG_2925…jpg`

---

## 1. Hallazgos estéticos (0186 vs 0187)

| Elemento | 0186 (aceptado estéticamente) | 0187 (rechazado) | Acción |
|----------|-------------------------------|------------------|--------|
| Márgenes | ~1,5 % del ancho | ~5 % (más aire, menos contenido) | Restaurado 0186 |
| Pedido N | Tipografía ~10 % ancho (moderada) | ~15 % (demasiado grande) | Restaurado 0186 |
| TOTAL | ~13 % ancho (protagonista) | ~9 % (más pequeño) | Restaurado 0186 |
| Farmacia | Regular ~5,5 % | Bold ~6,5 % | Restaurado 0186 |
| FARMAFÁCIL texto | Sí (duplicado bajo logo) | No | **Mantener sin texto** (K02) |
| Pago | «Pago: Sin cobrar» + 2 pies | Un solo «Pago pendiente…» | **Mantener unificado** |
| 0,00 € | Se imprimía | Pendiente de valoración | **Mantener corrección** |
| Eslogan | No | Sí | **Mantener** |
| QR | No (APK/web previos) | No | **Incorporar** (ver §2) |

Fuente del layout 0186: backup `FarmaFacil-Backups/…/KioskTicketBitmap.kt` (mismo renderer previo a la regresión tipográfica de K02).

Código: `android-kiosk/.../KioskTicketBitmap.kt` — métricas 0186 + diffs funcionales K02 únicamente.

---

## 2. Causa raíz — QR ausente (evidencias)

### Recorrido

| Paso | Estado en prueba 0187 | Evidencia |
|------|----------------------|-----------|
| Web STAGING desplegada con K02 | **No** (redeploy pendiente de usuaria) | Entrega cierre: Vercel CLI sin token; redeploy no ejecutado |
| APK 0.2.15 carga | `https://farmafacil-staging.vercel.app/k` | `BuildConfig.KIOSK_BASE_URL` staging |
| `create-order` → `accessUrl` | Vacío si el deploy no tiene emisión de token / o falla silenciosamente | `create-order.ts` hace `console.warn` y sigue OK sin QR |
| Payload bridge `qrPayload` | `ticket.accessUrl?.trim() \|\| ''` | `kiosk-cart-view.tsx` |
| APK parse `qrPayload` | Si vacío → **no dibuja QR** (correcto; no inventa URL) | `KioskTicketPayload` + `KioskTicketBitmap` |
| SDK ICOD / impresora | Capaz de imprimir QR | Ticket de prueba ICOD con «QR de prueba» OK |
| Impresora | **No es la causa** | Misma impresora imprime QR en prueba ICOD |

**Conclusión primaria:** el ticket 0187 se imprimió **sin `qrPayload`** porque la web STAGING efectivamente servida al kiosko **no entregó** `accessUrl` (código K02 de token `/o/{token}` aún no redeployado, o emisión fallida y silenciada). El APK 0.2.15 ya soporta QR; sin campo, omite el bloque.

**Conclusión secundaria (bug corregido en código, pendiente de deploy):** aunque se emita el token, `orderAccessPublicBaseUrl()` llamaba primero a `getAppBaseUrl()`, que en `NODE_ENV=production` **descarta** `*.vercel.app` y cae a `https://app.farmafacil.solutions`. Un QR staging apuntaría a producción (`/o/…` inexistente o sin el token de la BD staging) → error Safari observado en dominio `…mafacil.solutions`. Corregido: staging (`FF_APP_ENV` / host) se resuelve **antes** del canónico Auth.

No se reactiva vinculación por teléfono ni se usan `displayNumber` como credencial.

---

## 3. Previsualizaciones (aprobación previa a APK)

Escritorio:

- `/Users/pilar/Desktop/Ticket_Propuesta_Precios_Conocidos.png`
- `/Users/pilar/Desktop/Ticket_Propuesta_Pendiente_Valoracion.png`

Generadas a **576 dots** (80 mm ICOD), métricas alineadas con `KioskTicketBitmap` restaurado, logo monocromo, QR incluido, sin «FARMAFÁCIL» duplicado, pago unificado, pendiente de valoración, eslogan.

Script: `android-kiosk/scripts/export_ticket_previews.py`  
(Robolectric NATIVE dejó raster invertido en este entorno; la preview usa el mismo layout/ratios para aprobación visual. La impresión nativa seguirá el Kotlin.)

**No se ha compilado un APK nuevo.** 0.2.15 permanece como respaldo. La siguiente build (p. ej. 0.2.16) se coordinará con dictado por voz tras tu OK visual + redeploy web.

---

## 4. Cambios de código (sin prod)

- `KioskTicketBitmap.kt` — tipografía/márgenes 0186 + K02 funcionales  
- `order-access-public-url.ts` + `order-access-token.ts` — base URL staging correcta  
- `kiosk-order-ticket.tsx` — aviso si falta enlace seguro (diagnóstico en pantalla de ticket)  
- Tests Android bitmap/payload OK; test URL staging OK  

---

## 5. Acciones exactas tuyas

1. **Aprobar o rechazar** las dos PNG del Escritorio.  
2. **Redeploy** `farmafacil-staging` (dashboard Vercel o `npx vercel login` + redeploy) del commit de esta corrección, con `FF_APP_ENV=staging`.  
3. Tras OK visual + web desplegada: autorizar APK **0.2.16-staging** (ticket; dictado queda para entrega aparte si aún no está listo).  
4. Instalación USB (sin ADB); escanear QR con iPhone → debe abrir `farmafacil-staging.vercel.app/o/…`.  

K02 sigue **abierta** hasta validación física + escaneo iPhone.
