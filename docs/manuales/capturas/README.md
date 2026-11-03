# Capturas de pantalla — inventario (2ª revisión)

**Fecha:** 2026-11-03 · **Baseline UI documentado:** `origin/main` @ `00e8de4`

## Conclusión

No existe en el repositorio ni en worktrees una biblioteca de **capturas de UI de producción** de las pantallas `SCR-*` del panel farmacia, cliente o SuperAdmin. Por tanto, los procedimientos de piloto siguen con **Captura pendiente**, salvo recursos clasificados abajo.

| Tipo | Cantidad | ¿Incorporable a manual de piloto? |
|---|---|---|
| Captura UI producción verificada | 0 | — |
| Asset de producto (tiles kiosko) | 4 | Solo como referencia visual de iconos, **no** como captura de pantalla completa |
| Desarrollo / APK no en `origin/main` | 1 | Solo etiquetado desarrollo (manual interno / pendiente) |
| Mockup (no UI real) | 1 | **No** como captura real |
| Foto ticket / error / firma personal | encontrados fuera | **No** incorporados (sensibles, no pantalla, o no baseline) |

## Incorporado en esta carpeta

### `kiosko/referencia-assets/` (product assets, baseline)

- `kiosk-search.png`, `kiosk-ai.png`, `kiosk-qr.png`, `kiosk-cart.png`  
  Origen: `public/images/kiosk/` del mismo commit.  
  Uso: ilustración de tiles de SCR-KSK-002. **No** sustituyen una captura de `/k`.

### `kiosko/desarrollo/` (no piloto)

- `FUT-ANDROID_diagnostico-usb.jpg` — foto de pantalla **Diagnóstico USB** de la app Android kiosko (**no publicada en `origin/main`**). Etiqueta: **DESARROLLO / APK**.
- `MOCKUP_kiosko-bienvenida-tablet.png` — mockup de bienvenida tablet (Desktop, 2026-07-07). Etiqueta: **MOCKUP — no captura real**. No usar en procedimientos de producción.

## Revisado y no incorporado

| Recurso | Motivo |
|---|---|
| Previews PDF contratos (`commercial-contracts-v1/tmp/...`) | Rama no publicada; no es UI `/contratos` de producción |
| Iconos Canva / catalog-proposal | No son pantallas de la app |
| Logos `public/images/logos/` | Marca, no captura de procedimiento |
| Error Next.js en assets Cursor | Fallo puntual, no procedimiento |
| Foto ticket ICOD | Prueba hardware; mano visible; APK no en main |
| Firma personal | Datos personales |

## Cómo obtener capturas pendientes (sin escritura en producción)

1. Preferir **local o preview** con usuarios/datos de prueba.
2. Si se captura producción: solo lectura, datos anonimizados, autorización previa.
3. Nombrar `SCR-XXX-NNN_corto.png` y colocar en `farmacia/`, `cliente/`, `superadmin/` o `kiosko/`.
4. Actualizar la columna Captura de [INDICE_PANTALLAS.md](../INDICE_PANTALLAS.md).
5. No generar pedidos ni altas solo para la foto sin autorización.

Prioridad piloto: `SCR-AUTH-001`, `SCR-FAR-001/002/003`, `SCR-PUB-001/002`, `SCR-CLI-001/004/010`, `SCR-KSK-002`, `SCR-SA-002/005`.
