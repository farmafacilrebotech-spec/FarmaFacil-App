# FarmaFácil TEST — APK staging (coexistencia con producción)

Los kioskos físicos FarmaFácil se actualizan **por pendrive USB** (explorador de archivos de Android).  
**No** hace falta Mac, cable de datos ni ADB para instalar o recoger métricas.

## APK generada (copiar al pendrive)

```text
/Users/pilar/Desktop/Proyectos/FarmaFacil-App/android-kiosk/app/build/outputs/apk/staging/debug/app-staging-debug.apk
```

- `applicationId`: `solutions.farmafacil.kiosk.staging.debug` (**distinto** de producción)
- Nombre visible: **FarmaFácil TEST**
- Firmada debug (instalable desde el explorador de archivos)
- Rebuild (solo en el Mac de desarrollo):

```bash
cd android-kiosk
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
./gradlew :app:assembleStagingDebug
```

---

## Resumen técnico

| | Producción | Staging (TEST) |
|--|------------|----------------|
| `applicationId` | `solutions.farmafacil.kiosk` | `solutions.farmafacil.kiosk.staging` (+ `.debug` si debug) |
| Nombre visible | FarmaFácil Kiosk | **FarmaFácil TEST** |
| URL | `https://app.farmafacil.solutions/k` | `https://farmafacil-staging.vercel.app/k` |
| Cookies / storage | Aislados por paquete | Aislados por paquete |
| Impresión ICOD 3.1.8 | Sí | Sí |
| Banner STAGING | No | Sí (naranja permanente) |
| Anti-producción | N/A | Bloquea hosts `app.farmafacil.solutions` |
| Panel rendimiento + export archivo | No | Sí (menú 5 toques) |

**Lock Task / Device Owner:** esta APK **no** auto-activa Lock Task (`AUTO_START_ENABLED=false`).  
**No** se modifican Device Owner ni políticas Lock Task en este procedimiento.

### ¿Pueden coexistir? (instalación por explorador)

**Sí.** Android trata `solutions.farmafacil.kiosk` y `solutions.farmafacil.kiosk.staging.debug` como aplicaciones **distintas**:

- Instalar FarmaFácil TEST **no sustituye** ni actualiza la APK de producción.
- Tras instalar TEST deben existir **dos iconos** en el launcher.
- Desinstalar TEST deja producción intacta.

Único bloqueo posible: políticas Device Owner que prohíban instalar APKs desconocidas o limiten paquetes. Si al abrir el APK desde el pendrive el sistema rechaza la instalación, **parar** y revisar políticas; no forzar ni cambiar Device Owner / Lock Task sin autorización.

---

## Instalación habitual (pendrive USB)

Método estándar FarmaFácil (igual que actualizaciones de campo):

1. En el Mac de desarrollo, copiar `app-staging-debug.apk` a la raíz (o carpeta `FarmaFacil`) del **pendrive USB**.
2. En el kiosko K2101, insertar el pendrive.
3. Abrir el **explorador de archivos** de Android → ubicaciones → USB / pendrive.
4. Pulsar `app-staging-debug.apk` → **Instalar**.
5. Si Android pide «orígenes desconocidos» / instalar apps de esta fuente → permitir **solo** para el explorador de archivos (no desactivar seguridad global si no es necesario).
6. Confirmar el diálogo de instalación de **FarmaFácil TEST**.
7. Comprobar que el icono de **FarmaFácil Kiosk** (producción) **sigue** en el launcher.
8. Retirar el pendrive cuando termine.

**No** desinstalar la APK de producción.  
**No** abrir la APK de producción desde el mismo pendrive si el objetivo es solo instalar TEST.

### Tras instalar

En el launcher deben aparecer:

- FarmaFácil Kiosk → producción (sin tocar)
- **FarmaFácil TEST** → staging (banner naranja)

---

## Vinculación a staging (sin tocar producción)

1. Abrir **solo** FarmaFácil TEST (banner naranja STAGING).
2. Debe cargar `https://farmafacil-staging.vercel.app/k`.
3. En SuperAdmin staging, usar una **farmacia de prueba** con:
   - Catálogo publicado
   - Entitlement `assistant_ai` vigente (p. ej. Fase7 / Piloto)
   - Kiosko / dispositivo **nuevo** creado en staging (no reutilizar código de prod)
4. Completar el flujo web de vinculación del kiosko en staging.
5. Verificar pedidos/impresión solo con datos ficticios.

**Prohibido:** códigos QR / pairing / cookies de producción; desvincular el kiosko prod; usar datos reales de clientes.

---

## Salir del modo pruebas

En FarmaFácil TEST: **5 toques** esquina superior derecha → menú:

- Recargar kiosko staging  
- **Salir a la pantalla de inicio**  
- **Rendimiento y exportación** (panel de métricas)  
- Diagnóstico USB / impresión (ICOD)

Atrás en la raíz del WebView también lleva al launcher (solo staging).

---

## Rendimiento sin ADB (panel in-app)

Las pruebas de campo **no dependen de logcat ni del Mac**.

1. Usar el kiosko TEST (arranque, catálogo, búsqueda, carrito, pedido ficticio, impresión, asistente).
2. 5 toques → **Rendimiento y exportación**.
3. Revisar resumen (arranque, first contentful, errores de red, memoria, impresión) y eventos.
4. Pulsar **Exportar archivo**:
   - Guarda un `.txt` en `Documents` de la app y, si el sistema lo permite, en **Descargas/FarmaFacilTEST/**.
   - Ofrece compartir / guardar (p. ej. copiar al **pendrive USB** desde el selector de Android).
5. Abrir el archivo en un ordenador para análisis. El export **no** incluye datos personales, credenciales ni tokens (URL solo host+path; textos saneados).

Eventos típicos: `app_create`, `webview_ready`, `page_start`, `first_contentful`, `page_finish`, `tap`, `network_error`, `memory`, `print_*`, `js_*`.

---

## Checklist físico K2101

| # | Prueba | OK |
|---|--------|----|
| 1 | APK prod sigue instalada y abre producción | ☐ |
| 2 | TEST instalada **desde pendrive** (explorador); icono con banda naranja | ☐ |
| 3 | Dos iconos distintos; prod no sustituida | ☐ |
| 4 | Banner STAGING visible | ☐ |
| 5 | Carga `/k` en farmafacil-staging.vercel.app | ☐ |
| 6 | Intentar URL prod desde TEST → bloqueado | ☐ |
| 7 | Vincular dispositivo staging (código nuevo) | ☐ |
| 8 | Catálogo + búsqueda + carrito + pedido ficticio | ☐ |
| 9 | Impresión ICOD (raster, QR, corte) ticket de prueba | ☐ |
| 10 | Asistente IA (si entitlement staging) | ☐ |
| 11 | Panel **Rendimiento y exportación** → export `.txt` → copiar a pendrive | ☐ |
| 12 | Salir a launcher (menú 5 toques) | ☐ |
| 13 | Desinstalar solo TEST; prod intacta | ☐ |

---

## Desinstalar solo la APK TEST

En el kiosko (sin ADB):

1. Ajustes → Aplicaciones → **FarmaFácil TEST** → Desinstalar.  
   o mantener pulsado el icono TEST → Desinstalar.

**No** desinstalar «FarmaFácil Kiosk» (producción, `solutions.farmafacil.kiosk`).

---

## Compilar en Mac (solo desarrollo)

No es el procedimiento de campo. Solo para generar el APK que luego se copia al pendrive.

```bash
cd android-kiosk
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
./gradlew :app:assembleStagingDebug
```

Salida:

```text
android-kiosk/app/build/outputs/apk/staging/debug/app-staging-debug.apk
```

ADB queda reservado a depuración excepcional en laboratorio; **no** es el método habitual de FarmaFácil.
