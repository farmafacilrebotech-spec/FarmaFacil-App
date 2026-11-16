# Entrega — FarmaFácil versión integrada (2026-11-16)

**Estado:** lista para validación global en staging. Sin merge a `main`, sin producción.

## 1. Rama integrada y commit

| Campo | Valor |
|-------|--------|
| Rama | `integration/farmafacil-release` |
| Worktree | `.worktrees/integration-farmafacil-release` |
| HEAD | `93a428f` |
| Base | `origin/main` @ `53e0512` (tip remoto verificado) |
| Puerto | **3070** (único) |
| DB | staging `dazfdcjscnpfvhcyjddt` |

## 2. Ramas / commits incorporados

| Bloque | Origen / contenido | Commit integración |
|--------|--------------------|--------------------|
| 1 Cliente / QR / Mis farmacias / carrito / branding / logout | `1a2fdfc` (+ estabilización CLI) | `f76b234` |
| 2 Emails postprod | emails-phase + plantillas/firmas/adjuntos | `3baec33` |
| 3 Launch seats + C10–C18 | `launch-seats-manage` | `2c8f37c`, `3b76786` |
| 4 Permisos catálogo | tip ya en main → **no reintegrar** | — |
| 5 SuperAdmin / datos personales | tip ya en main → **no reintegrar** | — |
| 6 Contratos comerciales (borrador) | commercial-contracts-v1 → `097` | `001b20f` + typecheck |
| 7 Carteles A3/A5 + pack bienvenida | dirties launch-seats | `d0eed86` |
| 8 Centro de ayuda / docs | docs hub | `a5769c4` |
| 9 CLI SQL oficial + identidad SA | `098`, `099` | `33a517c`, `b515724` |

## 3. Funcionalidades incluidas

- Área cliente: Mis farmacias (`saved_at`, logo, `visible_name`), Mis pedidos enriquecidos, líneas vía `ff_order_linked_to_auth_uid`, QR / resolve con branding.
- Emails corporativos (plantillas, firmas, adjuntos, registro de envíos) — destinatarios de prueba.
- Plazas de lanzamiento 2027 + correcciones comerciales C10–C18.
- Contratos: generación, preview, PDF, estados; **firma/emisión definitiva bloqueada** (`legal/contracts/STATUS.json`, ReBoTech pendiente).
- Carteles QR + publicitarios A3/A5 personalizados + pack bienvenida.
- Centro de ayuda / documentación compatible por audiencia.
- Migraciones oficiales `097`–`099` + mapa en `MIGRATIONS_MAP_20261116.md`.

## 4. Funcionalidades excluidas y motivo

| Ítem | Motivo |
|------|--------|
| Firma definitiva de contratos | Validación jurídica pendiente; sociedad ReBoTech no constituida como tal en textos. |
| Merge a `main` / deploy Vercel prod / migraciones prod | Explicitamente no autorizados. |
| Deltas catalog-role / sa-shell históricos | Contenido ya en `origin/main` (squash); evitar reintegración. |
| Suite E2E Playwright completa P0/P1 | **NOT IMPLEMENTED** en repo (sin `playwright.config`); unitarias P0 cliente/contratos/carteles PASS. |
| Rediseño nuevo de carteles | No autorizado en estabilización; se integró lo existente. |
| Dirties experimentales de worktrees históricos | Conservados en respaldos; no mergeados a ciegas (ver §5). |

## 5. Cambios dirty preservados

Respaldo: AgentStores  
`…/integration-backups-20261116/`  
(`dirty-patches/`, `git-bundles/`, `worktree-archives/`, `staging/`, `RECOVERY.md`, `manifests/dirty-backup-manifest.json`).

Clasificación (resumen):

- **Ya incorporados:** cliente CLI, emails, launch-seats, contratos, carteles, help, SQL CLI/identidad.
- **Corrección pendiente / fuera:** lint plugin conflict warning (worktree vs root `.eslintrc`) — no bloquea `next lint` (exit 0).
- **Experimental / histórico:** dirties de consolidation, docs-manuales residuales, etc. — recuperar desde patches si hace falta; no bloquean la build integrada.
- **Sin descartar:** ningún worktree eliminado; ningún `reset --hard` / `git clean`.

## 6. Ubicación de respaldos

| Tipo | Ruta |
|------|------|
| Git dirties + untracked safe | `integration-backups-20261116/dirty-patches/` |
| Bundles / ramas | `integration-backups-20261116/git-bundles/` |
| Staging schema/datos | `integration-backups-20261116/staging/` |
| Instrucciones recuperación | `integration-backups-20261116/RECOVERY.md` |

Secretos / `.env*` **no** incluidos en commits ni archives seguros.

## 7. Mapa oficial de migraciones

Ver `docs/releases/integration/MIGRATIONS_MAP_20261116.md`.

- No hay `supabase_migrations.schema_migrations` en staging.
- Seguimiento por objetos reales + `public._ff_staging_recovery_log`.

## 8. Validación de esquema (staging)

| Check | Resultado |
|-------|-----------|
| Pedidos `#0029` `#0033` `#0034` `#0035` | **PASS** (presentes) |
| CLI resolve `visible_name` + `logo_url` | **PASS** |
| `ff_list_my_customer_orders_v1` con `pharmacyName` | **PASS** |
| `ff_order_linked_to_auth_uid` + policy items | **PASS** |
| Objetos 089–096 | **PASS** (presentes por inventario) |
| `097` `commercial_contracts` | **PASS** (aplicada 2026-11-16) |
| `098` / `099` en DB | **PASS** (ya presentes; oficializadas en repo) |
| Migraciones en producción | **No ejecutadas** |
| Rebuild DB vacía solo con cola oficial | **BLOCKED / documentado**: requiere baseline histórico previo a 089 (sin `schema_migrations` app) |

## 9. Pruebas automatizadas

| Suite | Resultado |
|-------|-----------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (warning plugin conflict worktree/root) |
| `test:customer-account` | **PASS** (22) |
| `test:public-catalog-request` | **PASS** (37) |
| contracts + ad/qr poster unit | **PASS** (10 + 5) |
| `next build` | **MANUAL PENDING** (no ejecutado en esta pasada; `dev` 3070 OK) |
| E2E Playwright P0/P1 | **NOT IMPLEMENTED** |
| Safari iPhone / PWA / QR impreso / kiosko físico / email real / PDF visual | **MANUAL PENDING** |

## 10. Incidencias corregidas en integración

- Typecheck contratos (imports `.ts`, null-safe firmas PDF).
- Help catalog `readonly` audiences.
- `provider-assets` `matchAll` → `Array.from`.
- Oficialización SQL CLI e identidad.
- Aplicación staging de `097`.

## 11. Incidencias pendientes

- E2E automatizado completo (P0/P1).
- Confirmar Site URL / Redirect URLs en panel Supabase Auth apuntan a `http://192.168.1.16:3070` (y 127.0.0.1) — **MANUAL PENDING**.
- Lint plugin path conflict (cosmético).
- `metadataBase` warning Next (localhost vs LAN).
- Inventario plan_key vía `commercial_plan_skus` join devolvió `?` en varias farmacias — verificar mapeo plan en smoke comercial.

## 12. Riesgos de seguridad

- Identidad logo/`visible_name`: triggers SA-only presentes en staging (`099`).
- No desactivar RLS; no `service_role` en navegador.
- Firma contractual sigue gated.
- Emails: usar allowlist/destinatarios de prueba.
- Credenciales: **no** en repo; no se han reseteado passwords existentes.

## 13–15. URLs entorno único

| Destino | URL |
|---------|-----|
| Mac | http://127.0.0.1:3070 |
| iPhone (LAN actual) | http://192.168.1.16:3070 |
| Kiosko de pruebas | Misma base `http://192.168.1.16:3070` + public_id de la farmacia kiosko |

Otros previews (3000/3010/3023/3060) **detenidos**. Worktrees **no** eliminados.

QR / emails deben usar staging + `APP_URL=http://192.168.1.16:3070`.

## 16. Usuarios de prueba por rol (emails; passwords en almacenamiento local seguro)

| Rol | Email de referencia |
|-----|---------------------|
| SuperAdmin | `emails.sa.075-emails-stage@farmafacil.test` |
| Soporte | `emails.support.075-emails-stage@farmafacil.test` |
| Propietario | `catalog.owner.074@farmafacil.test` |
| Administrador | `catalog.admin.074@farmafacil.test` |
| Farmacéutico | `catalog.pharmacist.074@farmafacil.test` |
| Empleado | `catalog.staff.074@farmafacil.test` |
| Multifarmacia | `catalog.dual.074@farmafacil.test` |
| Cliente | `cliente.test3070@farmafacil.test` |
| 2º cliente (aislamiento) | `lab.cliente.b.clientsqr@farmafacil.test` (verificar account_kind en smoke) |

**No se han reseteado contraseñas.** Usar las ya conocidas del laboratorio staging.

## 17. Farmacias de prueba

| Farmacia | Notas | QR `public_id` |
|----------|-------|----------------|
| TEST Fase7 QR Requests 20261021 | Catálogo/roles 074; subscription `active` | `2mo6cq0yjss6ratr` |
| Farmacia Staging 1 | Multifarmacia dual | `91dntkqzz29hscvt` |
| Farmacia Prueba Piloto | `trialing` | `l595c6fdmhozxe2u` |
| TEST3070 - Farmacia Piloto Valencia | Entorno 3070 | `zc1oi3bwakoeo450` |
| TEST Fase6 / Pilotos comerciales | Varios estados trial/expired | ver listado QR |

Entrada pública: `http://192.168.1.16:3070/e/{public_id}`

## 18. Procedimiento de rollback

1. **App:** apuntar de nuevo al worktree/commit anterior; no borrar `integration/farmafacil-release`.
2. **Código:** `git switch` / worktree previo; dirties en AgentStores.
3. **DB staging:** restaurar desde `integration-backups-20261116/staging/`; consultar `_ff_staging_recovery_log` (`apply_097_…`). No confiar solo en DOWN.
4. **Producción:** sin cambios → no requiere rollback prod.

## 19. Checklist manual (solo lo no cubierto por automatización)

| # | Dispositivo | URL | Usuario | Farmacia | Datos | Acción | Esperado | Evidencia |
|---|-------------|-----|---------|----------|-------|--------|----------|-----------|
| M1 | Mac Safari/Chrome | http://127.0.0.1:3070/login | SA | — | credencial conocida | Login | Entra a shell SA | Screenshot home |
| M2 | Mac | /farmacias → Fase7 | owner.074 | Fase7 | — | Abrir líneas pedido #0035 | Líneas visibles sin error RLS | Network sin 401/42501 |
| M3 | Mac | /e/2mo6cq0yjss6ratr | invitado | Fase7 | 1 producto | Pedido invitado | Pedido creado | Nº display |
| M4 | Mac | /cuenta o Mis pedidos | cliente.test3070 | — | — | Ver pedidos + farmacia/logo | Lista con nombre/logo | Screenshot |
| M5 | iPhone Safari | http://192.168.1.16:3070/e/2mo6cq0yjss6ratr | invitado | Fase7 | — | Navegar catálogo | UI usable; sin errores técnicos | Screenshot |
| M6 | iPhone | mismo host /login | cliente | — | — | Login + Mis farmacias | `saved_at`/logo OK | Screenshot |
| M7 | Mac SA | /emails | SA | — | destinatario allowlist | Envío prueba | Link staging, no prod | Cabeceras/URL en mail |
| M8 | Mac SA | /contratos | SA | con presupuesto aceptado | — | Preview + PDF borrador | Watermark/borrador; sin firmar | PDF |
| M9 | Mac farmacia | QR tab | owner/admin | Fase7 | — | Descargar cartel A4/A3/A5 | PDF con nombre/logo/QR | PDF |
| M10 | Kiosko Android | LAN:3070 + entry | — | farmacia kiosko | — | Abrir catálogo | Mismo entorno integrado | Foto pantalla |
| M11 | Mac | pedido staff | farmacéutico | Fase7 | pedido antiguo #0029 | Valorar / disponibilidad | Flujo OK; sin tocar precios maestros | Screenshot estado |
| M12 | Mac | aislamiento | cliente A vs B | — | IDs ajenos | Intentar abrir pedido ajeno | Denegado | Network error |

No repetir batería unitaria ya PASS salvo regresión visual/UX.
EOF