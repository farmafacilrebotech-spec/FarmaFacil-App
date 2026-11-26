# FarmaFácil Kiosk — Android

Proyecto Android **independiente** (Kotlin/Gradle) que envuelve el kiosko web en un WebView, imprime tickets por USB (ICOD) y ofrece diagnóstico USB de solo lectura en debug.

**No forma parte del build de Next.js.** Vive en `android-kiosk/` y no modifica Vercel, Supabase ni el frontend web.

## Alcance actual (0.2.6)

| Incluido | Limitación importante |
| --- | --- |
| WebView → `https://app.farmafacil.solutions/k` | Requiere build/deploy web con el hook del botón Imprimir |
| Bridge `window.FarmaFacilKiosk.printTicket` + botón web en APK | Sin prueba física en POS el flujo pedido→papel no se da por cerrado |
| Impresión raster ES + QR + corte (VID `0x0483` / PID `0x7540`) | Errores de impresión no alteran el pedido |
| Prueba de tamaño de ticket **solo debug** (bitmap a ancho imprimible + tipografía grande) | Release: sin gesto de diagnóstico ni pantalla de prueba |
| Cookies + DOM storage, pantalla completa, offline | Lock Task / Device Owner no auto-activos |

Contrato del puente: `app/src/main/java/solutions/farmafacil/kiosk/bridge/PrintBridgeContract.kt`

## Requisitos en el Mac de desarrollo

1. **JDK 17** (Temurin u OpenJDK 17).
2. **Android SDK** (API 30+ / compileSdk 34).
3. `local.properties` con `sdk.dir=...`.

## Variantes (product flavors)

| Flavor | applicationId | URL |
|--------|---------------|-----|
| `production` | `solutions.farmafacil.kiosk` | `https://app.farmafacil.solutions/k` |
| `staging` | `solutions.farmafacil.kiosk.staging` | `https://farmafacil-staging.vercel.app/k` |

Documentación APK TEST: [`docs/STAGING_APK_TEST.md`](docs/STAGING_APK_TEST.md)

## Compilar APK

```bash
cd android-kiosk
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
chmod +x gradlew

# Producción (debug)
./gradlew :app:assembleProductionDebug

# Staging / FarmaFácil TEST (coexiste con prod)
./gradlew :app:assembleStagingDebug
```

APKs:

```text
android-kiosk/app/build/outputs/apk/production/debug/app-production-debug.apk
android-kiosk/app/build/outputs/apk/staging/debug/app-staging-debug.apk
```

`applicationId` production debug: `solutions.farmafacil.kiosk.debug`  
`applicationId` staging debug: `solutions.farmafacil.kiosk.staging.debug`

## Instalar en el POS (método habitual: pendrive USB)

Los kioskos físicos se actualizan **por pendrive**, no por ADB:

1. Copiar el APK al pendrive.
2. En el kiosko: explorador de archivos → abrir el `.apk` → Instalar.
3. Staging TEST (`app-staging-debug.apk`) coexiste con producción (otro `applicationId`).

Detalle: [`docs/STAGING_APK_TEST.md`](docs/STAGING_APK_TEST.md)

Laboratorio (opcional, no habitual):

```bash
adb install -r app/build/outputs/apk/staging/debug/app-staging-debug.apk
```

1. Abre **FarmaFácil TEST** → debe cargar staging `/k` con banner naranja.
2. Vincula un dispositivo **nuevo** en staging (no tocar prod).
3. **Rendimiento:** 5 toques → Rendimiento y exportación → Exportar archivo (pendrive).
4. **Impresión:** 5 toques → Diagnóstico USB → permiso USB → Prueba impresión ICOD.

## Bridge web ↔ nativo

- `FarmaFacilKiosk.getBridgeInfo()`
- `FarmaFacilKiosk.printTicket(jsonString)` — usado por `components/kiosk/kiosk-cart-view.tsx` en la APK
- Navegador sin bridge: `window.print()`

Payload = `KioskTicketData` (orden de líneas = pedido; total sin recalcular).

## Aislamiento respecto a Next.js

- Gradle solo dentro de `android-kiosk/`.
- Sin scripts npm que invoquen Gradle.
- Sin `UsbNativeAPI` / `libusb1.0` / root: solo `USBAPI` + `libimage_icod`.
