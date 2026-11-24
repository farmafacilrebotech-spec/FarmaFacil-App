# Entrega — STAGING integrado para aceptación manual

**Fecha:** 2026-11-24  
**Estado global:** controles técnicos **mayormente superados**; E2E CI Playwright **en re-ejecución** (Node 22). No declarar aceptación cerrada hasta verde E2E + checklist manual.

## URL y versión

| Ítem | Valor |
|------|-------|
| URL staging | https://farmafacil-staging.vercel.app |
| Deploy | `dpl_7S1ZFSZiSeY9myfuzekGd42T7HG4` |
| Inspector | https://vercel.com/pilars-projects-4b376277/farmafacil-staging/7S1ZFSZiSeY9myfuzekGd42T7HG4 |
| Rama integrada | `integration/farmafacil-release` (= `integration/farmafacil-staging-2026-11-24`) |
| Commit tip (CI Node22) | `d54c090` |
| Commit app desplegado | `95669a6` (equivalente funcional; tip CI posterior solo workflow) |
| Supabase staging | `dazfdcjscnpfvhcyjddt` |
| APK | TEST v0.2.13 — **sin cambios** |

## PR incorporados

| PR | Contenido | Integración |
|----|-----------|-------------|
| #28 | QA permisos/pack/UX + pin ubuntu-24.04 + Node 22 | merge → integration |
| #29 | Entrega1 PDF/emails/ACL/E2E | merge → integration |
| #30 | Catálogo taxonomía/import + P0 mig + typefix stock | merge → integration (conflicto UX stock resuelto) |

## Migraciones

### Producción (única escritura autorizada)

| Mig/acción | Resultado |
|------------|-----------|
| P0 `ff_customer_claim_order_v1` fail-closed | **Aplicado** 2026-11-24T21:19Z · invariantes 6/1/26 · RPC `disabled` |
| Código | `091_p0_disable_customer_claim_order_by_phone_v1.sql` (idempotente; no reabrir phone-match) |

### Staging

| Mig | Resultado |
|-----|-----------|
| 089 taxonomy | **Aplicado** (+ RLS firmas corregidas) · 27 cats · 8 aliases · columnas import |
| 090 import jobs | **Aplicado** · RPC batch/revert |
| 091 P0 claim | **Aplicado** (idempotente) |
| Productos QA | **2696** conservados |

### Higiene repo

- `079_STAGING_*` → `supabase/one_shots/staging/`
- `083_00`/draft 056 → sección A de `083_commercial_plans_activation_v1.sql`
- Sin colisiones de versión 079/083
- Correspondencia: `MIGRATION_REMOTE_CORRESPONDENCE_2026-11-24.md`

## Seguridad P0

| Entorno | Estado |
|---------|--------|
| Staging | Fail-closed verificado (sesión previa + 091) |
| Producción | Fail-closed verificado · anon EXECUTE=0 · sin phone logic |
| Rollback | **Prohibido** restaurar BEFORE; mantener disabled hasta E2 token |

## Tests

| Suite | Resultado |
|-------|-----------|
| `tsc` app (integration) | **OK** (sin errores app) |
| `npm run build` | **OK** |
| `test:product-import` | **14/14** |
| `test:taxonomy` | **9/9** |
| Smoke BD `:54532` import/RLS/perf | **OK** (57 ms / 500 filas) |
| HTTP staging `/login` `/e/…/catalogo` `/k` | **200** |
| Playwright CI #28 | Browser install **OK** tras ubuntu-24.04; prepare falló Node20 → **fix Node22 pusheado**; re-run disparado |
| E2E roles completo post-Node22 | **Pendiente** resultado run |

## Rendimiento ENTREGA 1B (HTTP real staging)

Medición pública 2026-11-24 (TTFB+body, sin auth de sesión):

| Ruta | Frío | Caliente |
|------|------|----------|
| `/login` | ~466 ms | ~304 ms |
| `/e/8132f4yiijl5igfr/catalogo` | ~663 ms | ~638 ms |
| `/k` | ~312 ms | ~331 ms |

**Pendiente medición autenticada:** SuperAdmin nav, panel farmacia, búsquedas, import wizard UI, PDF presupuestos/contratos (requiere sesión QA).

## Incidencias resueltas

1. Claim por teléfono P0 staging + **prod**
2. Vercel #30 `isGenericCatalogProduct` types
3. Playwright deps ubuntu-26.04 → pin 24.04
4. supabase-js WebSocket → Node 22 en e2e
5. Deuda 079/083/056 en cadena local
6. 089 RLS firmas en staging
7. Deploy `farmafacil-staging` con build integrado

## Incidencias / bloqueos pendientes

| Ítem | Clasificación |
|------|----------------|
| Resultado final Playwright full post-Node22 | **bloqueante técnico** hasta verde |
| Mediciones auth (SA/farmacia/PDF/import UI) | pendiente |
| Validación manual por rol/dispositivo | pendiente aceptación |
| Rama avisos E2/E1/E3 | **no abierta** (fuera de alcance) |
| Cartera comercial | **no iniciada** |

## Checklist manual (enlaces)

Base: https://farmafacil-staging.vercel.app

### Común
- [ ] Banner STAGING visible
- [ ] Login QA existentes (no regenerar credenciales)
- [ ] Sin cobros reales / emails dry-run

### SuperAdmin
- [ ] https://farmafacil-staging.vercel.app/login → panel SA
- [ ] Tarifas / farmacias / catálogo maestro
- [ ] Emails composer (sin envío real)

### Farmacia (Piloto Integral)
- [ ] Dashboard: https://farmafacil-staging.vercel.app/f/f55f94af-2d0f-424b-81d3-a4f687abd495/dashboard
- [ ] Catálogo admin + import wizard + historial/revert
- [ ] Pedidos / QR / usuarios

### Cliente QR
- [ ] Home: https://farmafacil-staging.vercel.app/e/8132f4yiijl5igfr
- [ ] Catálogo: https://farmafacil-staging.vercel.app/e/8132f4yiijl5igfr/catalogo
- [ ] Disponibilidad sin stock bloqueante

### Kiosko web
- [ ] https://farmafacil-staging.vercel.app/k
- [ ] Catálogo / carrito / asistente

### Kiosko físico (intervención tuya)
- [ ] APK TEST v0.2.13 pairing contra staging
- [ ] Flujo pedido físico + ticket
- [ ] Sin apuntar a prod

## Clasificación funcional

| Área | Estado |
|------|--------|
| Auth / roles (código+build) | validada técnica · **pendiente aceptación manual** |
| Catálogo taxonomía/import (BD staging 089/090) | validada técnica local+BD · **pendiente aceptación UI** |
| Stock no bloqueante | validada código+smoke · pendiente manual |
| Pedidos create/status RPCs | presentes · claim phone **disabled** |
| Seguridad P0 prod/staging | **validada** |
| E2E CI full | **bloqueada** hasta run Node22 verde |
| Avisos recogida | no empezada |
| Perf auth/PDF | pendiente |

## Confirmaciones

- Usuarios QA existentes: **conservados** (sin regenerar)
- Datos QA / 2696 productos: **conservados**
- Separación prod: app prod **no** desplegada; solo P0 SQL en DB prod
- Envíos/cobros: sin cambios que activen cobro real
