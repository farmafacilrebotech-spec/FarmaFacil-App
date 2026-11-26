# FarmaFácil Kiosk — Prueba segura de Lock Task / Device Owner

**Estado actual:** la APK incluye `KioskDeviceAdminReceiver` y `KioskLockTaskController`,
pero **no** aprovisiona Device Owner, **no** inicia Lock Task al arrancar y **no**
bloquea gestos del sistema.

## Requisitos previos (POS-1566A / Android 11)

1. Confirmar con el fabricante que el equipo admite **Device Owner**.
2. Dispositivo sin cuentas de usuario (o tras reset autorizado — solo si se aprueba).
3. Depuración USB activa y `adb devices` operativo.
4. APK firmada instalada (`solutions.farmafacil.kiosk` o `.debug` según build).

## Qué NO hacer en la primera prueba

- No factory reset sin autorización escrita.
- No `set-device-owner` en producción / flota.
- No dejar el POS sin procedimiento de recuperación documentado.
- No introducir PINs fijos en el código para salir del kiosko.

## Procedimiento de prueba controlada (futuro)

### A. Comprobar que hoy NO es Device Owner

```bash
adb shell dumpsys device_policy | grep -i "Device Owner\|Profile Owner" || true
adb shell cmd device_policy list-owners || true
```

Esperado en esta etapa: sin Device Owner de FarmaFácil.

### B. Aprovisionar Device Owner (solo laboratorio)

Tras instalar la APK (paquete exacto según build):

```bash
# Debug:
adb shell dpm set-device-owner solutions.farmafacil.kiosk.debug/solutions.farmafacil.kiosk.locktask.KioskDeviceAdminReceiver

# Release (cuando exista):
# adb shell dpm set-device-owner solutions.farmafacil.kiosk/solutions.farmafacil.kiosk.locktask.KioskDeviceAdminReceiver
```

Si falla (cuentas existentes, otro owner, etc.): **detenerse**. No forzar con reset
salvo autorización explícita.

### C. Activar Lock Task (código futuro / opt-in)

`KioskLockTaskController.tryStartLockTaskIfAuthorized(activity, explicitOptIn = true)`
solo debe llamarse desde una acción administrativa segura (aún no implementada).
`AUTO_START_ENABLED` permanece `false`.

### D. Recuperación / desinstalación segura

1. Salir de Lock Task (API admin o `adb shell am task lock stop` según versión).
2. Quitar Device Owner:

```bash
adb shell dpm remove-active-admin solutions.farmafacil.kiosk.debug/solutions.farmafacil.kiosk.locktask.KioskDeviceAdminReceiver
# o clear-device-owner si la API/tooling del dispositivo lo permite
```

3. Desinstalar:

```bash
adb uninstall solutions.farmafacil.kiosk.debug
```

4. Si se pierde el acceso admin: ADB documentado, o reset de fábrica **autorizado**
   como último recurso (procedimiento del fabricante POS-1566A).

## Autenticación administrativa (diseño futuro)

- No PIN fijo en el APK.
- No desbloqueo por `pharmacyId` / código público.
- Preferir: challenge servidor, token de campo rotativo, o secreto provisionado
  en dispositivo cifrado y rotado.

## Relación con immersive mode

`IMMERSIVE_STICKY` en `MainActivity` solo oculta barras del sistema. **No** es
bloqueo real. Los gestos (p. ej. deslizar arriba) pueden seguir abriendo la UI
del sistema hasta que exista Device Owner + Lock Task activo.
