# FASE QA-CLIENTE-MOBILE — Guía de pruebas iPhone (staging :3070)

**Rama:** `integration/farmafacil-release`  
**Origen LAN:** `http://192.168.1.16:3070`  
**Bind:** `0.0.0.0:3070` (Mac + iPhone misma Wi‑Fi; no expuesto a Internet)  
**Dry-run:** `commercial_dry=1` · `corporate_dry=1` (sin envíos reales)

> Usa **siempre** `http://192.168.1.16:3070` en Mac e iPhone durante esta sesión (cookies host-only). Evita mezclar con `127.0.0.1` en la misma prueba de sesión.

## 1. Acceso desde el iPhone

1. iPhone y Mac en la misma Wi‑Fi.
2. Safari → abrir la URL LAN de abajo (o escanear el QR en `docs/qa-mobile/qr/`).
3. Si no carga: en el Mac, Preferencias → Cortafuegos → permitir Node / o desactivar temporalmente solo para la red local.

### URLs base

| Uso | URL |
|---|---|
| App (LAN) | http://192.168.1.16:3070 |
| Login panel farmacia | http://192.168.1.16:3070/login |
| Cuenta cliente (PWA) | http://192.168.1.16:3070/cuenta |
| Mac local (también activo) | http://127.0.0.1:3070 |

## 2. Escenarios de farmacia

| Escenario | Farmacia | public_id | Catálogo | Módulos destacados | URL pública | QR |
|---|---|---|---|---|---|---|
| **A** Catálogo general | Farmacia Staging 1 | `91dntkqzz29hscvt` | `generic` | kernel, orders, QR… (sin assistant) | http://192.168.1.16:3070/e/91dntkqzz29hscvt | `qr/qr-A-staging1-generic.png` |
| **B** Catálogo personalizado | Farmacia Piloto Integral | `8132f4yiijl5igfr` | `own` (100 productos, precios) | kernel, orders, QR… (sin assistant) | http://192.168.1.16:3070/e/8132f4yiijl5igfr | `qr/qr-B-piloto-integral-own.png` |
| **C** Asistente IA | TEST Fase7 QR Requests 20261021 | `2mo6cq0yjss6ratr` | `generic` + 1 disponible / resto confirmación | **assistant_ai (trial)** + orders + QR | http://192.168.1.16:3070/e/2mo6cq0yjss6ratr | `qr/qr-C-fase7-assistant.png` |

Notas de datos:

- **Staging 1** está en `pending_setup` en BD: útil para catálogo general, pero algunas pantallas de panel pueden limitar operaciones.
- **Piloto Integral / Prueba Piloto:** productos mayoritariamente `confirm_with_pharmacy` (stock 0). No se pudo forzar stock vía SQL (trigger de catálogo). Hay precios en catálogo propio.
- **Fase7:** 1 producto `available` (stock 12) + resto confirmación; pedidos en `request_pending` / `preparing` / `ready`.
- **Promociones:** no hay tablas de promociones en este staging → no hay promos activas/caducadas que preparar.
- **Imágenes de producto:** el esquema `pharmacy_products` no guarda imagen propia (posible ilustración vía master/UI).

## 3. Clientes de prueba

Contraseña: la misma `E2E_PASSWORD` de `.env.e2e.local` (no se publica aquí).

| Perfil | Email | Pedidos | Farmacias guardadas | Uso |
|---|---|---|---|---|
| Con pedidos | `cliente.test3070@farmafacil.test` | Sí (Fase7, varios `request_pending`) | Fase7 + Piloto Integral + Prueba Piloto + Staging 1 | Cliente multi‑farmacia + historial |
| Sin pedidos | `cliente.sinpedidos.qa@farmafacil.test` | 0 | Fase7 | Registro/login limpio, Mis farmacias |
| Lab B (staff, no cliente puro) | `lab.cliente.b.clientsqr@farmafacil.test` | — | — | No usar como cliente PWA |

## 4. Pedidos y presupuestos

| Qué | Dónde | Estado |
|---|---|---|
| Pedidos varios estados | Fase7 + Prueba Piloto | `request_pending`, `preparing`, `ready`, `delivered`, `cancelled` |
| Presupuestos / quote | Algunos pedidos con `quote_expires_at`; tokens hasheados | **No** hay URL `/q/...` recuperable sin reemitir desde panel farmacia |

## 5. PWA y autenticación

| Tema | Estado en esta red |
|---|---|
| Abrir `/cuenta` en Safari | Sí (HTTP LAN) |
| Instalar PWA (Añadir a pantalla de inicio) | **Limitado en HTTP.** Safari suele exigir HTTPS + service worker seguro para instalación completa. |
| Alternativa HTTPS local | `mkcert` no está instalado. Requiere autorización expresa para instalar CA local / TLS en LAN (sin Internet, sin producción). |
| Login / registro / logout | Probar en URLs `/e/{id}/cuenta/entrar` y `/cuenta` |
| Recuperación de contraseña | Depende de que Supabase Auth tenga allowlist del redirect `http://192.168.1.16:3070/**`. Si el correo redirige a localhost, hay que añadir el origen LAN en el panel Supabase (staging). |
| Persistencia de sesión | Cookies host-only: permanecer en el mismo host (`192.168.1.16`) |

Assets PWA presentes: `public/manifest.webmanifest`, `public/sw-customer.js`.

## 6. Seguridad (esta sesión)

- Sin envíos reales / cobros / producción / `main`.
- Dry-run comercial y corporativo activos.
- Servidor solo en red local (`0.0.0.0:3070`), no tunnel público.
- Middleware conserva `Host` (sin reescribir a localhost).
- Next 13.5: no existe `allowedDevOrigins` (feature posterior); Server Actions validan Origin≈Host — usar el origen LAN de forma consistente.

## 7. Qué no se puede probar todavía

| Funcionalidad | Motivo |
|---|---|
| Promociones activas/caducadas | No existen tablas/modelo de promos en staging |
| Stock forzado disponible/agotado masivo | Trigger `catalog_permission` bloquea UPDATE directo |
| Imágenes de producto propias | Sin columna de imagen en `pharmacy_products` |
| Presupuesto público pendiente con enlace fresco | Token solo en hash; hace falta reemitir desde panel |
| PWA instalable “como producción” | Safari + HTTP sin certificado local |
| Recuperación email si falta allowlist Supabase | Redirect Auth debe incluir origen LAN |
| Cobros / envíos email reales | Dry-run y política QA |

## 8. Arranque / humo

```bash
# En el worktree integration-farmafacil-release
bash tmp/start-3070-mobile-qa.sh
# Regenerar QR si cambia la IP:
node scripts/qa-mobile-generate-qr.mjs http://192.168.1.16:3070
```

Smoke esperado: `login` 200 en `127.0.0.1` y `192.168.1.16`; entrypoints `/e/...` 200; dry-run=1.
