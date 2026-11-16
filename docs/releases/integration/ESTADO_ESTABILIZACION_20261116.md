# Estado estabilización — 2026-11-16 06:25 UTC

## 1. Servidor 3070

| Campo | Valor |
|-------|--------|
| Worktree | `.worktrees/integration-farmafacil-release` |
| Rama | `integration/farmafacil-release` |
| Commit en meta/runtime | ver `tmp/next-3070.meta` (debe coincidir con tip tras restart) |
| Tip git | `ced2bdb` |
| Mac | http://127.0.0.1:3070 |
| LAN | http://192.168.1.16:3070 |
| Watchdog | `scripts/integration-3070-daemon.py` (double-fork; PID en `tmp/keepalive-daemon.pid`) |

### Causa de las caídas

El `next dev` se arrancaba como hijo de shells del agente Cursor. Al cerrarse la sesión del tool (`nohup`/`&` insuficiente en este entorno), el proceso recibía SIGHUP/reap y el puerto quedaba libre. **No** era un crash de Next por error de compilación (los logs mostraban reinicios limpios “Ready”).

### Mitigación

Daemon Python con `os.setsid` + double-fork + `start_new_session` + healthcheck cada 20s y rearranque automático. LaunchAgent macOS intentado (`com.farmafacil.integration3070`) pero `launchctl bootstrap` falló con I/O error en este entorno; el daemon local es el mecanismo activo.

## 2. Estado por módulo

| Módulo | Estado integración | Notas |
|--------|-------------------|-------|
| Cliente / QR / Mis farmacias / pedidos / carrito | **INTEGRADO** | `f76b234` + SQL 098 |
| Emails postprod | **INTEGRADO** | `3baec33` |
| Launch seats + C10–C18 | **INTEGRADO** | `2c8f37c` `3b76786` |
| Permisos catálogo (deltas históricos) | **YA EN MAIN** | No reintegrar |
| SuperAdmin / datos personales | **YA EN MAIN** + 099 identidad | Triggers SA-only en staging |
| Contratos comerciales | **INTEGRADO (borrador)** | Firma bloqueada; 097 aplicada staging |
| Carteles A3/A5 + bienvenida | **INTEGRADO** | `d0eed86` |
| Centro de ayuda | **INTEGRADO** | `a5769c4` |
| E2E Playwright P0/P1 | **NO IMPLEMENTADO** | Sin config en repo |

## 3. Respaldos y migraciones

| Ítem | Estado |
|------|--------|
| Backups dirties/worktrees | **OK** — AgentStores `integration-backups-20261116/` |
| Backup staging schema/datos | **OK** — mismo árbol `/staging` |
| Pedidos 0029/0033/0034/0035 | **PRESERVADOS** |
| Mapa migraciones | `docs/releases/integration/MIGRATIONS_MAP_20261116.md` |
| 097 contracts en staging | **APLICADA** |
| 098 CLI / 099 identidad | **Presentes en DB**; oficializadas en repo |
| Prod | **INTACTA** |

## 4. Pruebas automatizadas globales

| Prueba | Resultado |
|--------|-----------|
| typecheck | **PASS** |
| lint (`root: true`) | **PASS** (2 warnings hooks kiosko preexistentes) |
| build | **PASS** |
| test:customer-account | **PASS** |
| test:public-catalog-request | **PASS** |
| test:commercial-ui | **PASS** (tras fix test preparación) |
| test:commercial-quotes | **PASS** |
| test:auth-login-recovery | **PASS** |
| test:invite-auth | **PASS** |
| test:pharmacy-access / shell-pharmacies | **PASS** |
| contracts + posters unit | **PASS** |
| Smoke HTTP `/login` `/e/…` | **PASS** (200) |
| Smoke HTTP `/farmacias` `/tarifas` `/contratos` `/ayuda` sin sesión | **PASS** (307 redirect auth — esperado) |
| E2E Playwright roles/flujos | **NOT IMPLEMENTED** |
| Safari iPhone / PWA / QR impreso / kiosko físico / email real / PDF visual | **MANUAL PENDING** |

## 5. Regresiones críticas corregidas en esta pasada

1. Test comercial esperaba `/readiness/` tras copy ES “preparación” → test alineado.
2. Lint fallaba por conflicto de plugin ESLint worktree vs repo raíz → `"root": true`.
3. Servidor 3070 inestable por ciclo de vida del shell → daemon detachado.

## 6. Checklist manual reducida (solo intervención humana)

| ID | Dispositivo | URL | Usuario | Qué hacer | Esperado |
|----|-------------|-----|---------|-----------|----------|
| H1 | Mac | http://127.0.0.1:3070/login | SA `emails.sa.075-emails-stage@farmafacil.test` | Login | Shell SA sin error |
| H2 | Mac | pedidos farmacia Fase7 | owner/farmacéutico 074 | Abrir líneas de `#0035` | Líneas visibles |
| H3 | Mac | http://127.0.0.1:3070/e/2mo6cq0yjss6ratr | invitado | Pedido 1 línea | Pedido creado |
| H4 | iPhone Safari | http://192.168.1.16:3070/e/2mo6cq0yjss6ratr | invitado/cliente | Catálogo + login cliente | UI usable; Mis farmacias OK |
| H5 | Mac SA | /emails | SA | Envío allowlist | Links staging |
| H6 | Mac | QR tab / carteles | owner | PDF A4/A3/A5 | Nombre+logo+QR |
| H7 | Kiosko | LAN:3070 | — | Abrir entry farmacia kiosko | Mismo entorno integrado |

Passwords: laboratorio staging existente (sin reset). Informe largo: `ENTREGA_INTEGRACION_20261116.md`.
