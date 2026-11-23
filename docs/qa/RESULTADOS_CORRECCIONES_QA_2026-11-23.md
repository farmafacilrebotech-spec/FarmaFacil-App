# Resultados correcciones QA — 2026-11-23

**Rama:** `fix/qa-2026-11-23-block1`  
**Staging app:** https://farmafacil-staging.vercel.app  
**Supabase:** `dazfdcjscnpfvhcyjddt`  
**Producción / mig 105 / ciclo kiosko comercial:** no tocados  

## Tabla de correcciones

| Incidencia | Corrección | Archivos clave | Commit/PR | Tests | Manual pendiente | URL staging | Usuario prueba | Esperado |
|---|---|---|---|---|---|---|---|---|
| #7 Usuarios rebote | Nav oculta + EmptyState con mensaje + volver dashboard | `pharmacy-clients-roles.ts`, `usuarios/page.tsx`, `pharmacy-section-access-denied.tsx` | PR block1 | unit tenant-nav; e2e auth-roles actualizado | Abrir `/usuarios` como PHARMACIST/STAFF | `/f/{fase7}/usuarios` | `catalog.pharmacist.074@…` / `catalog.staff.074@…` | Mensaje permiso + link dashboard |
| #1–3 Kiosko nav | Idem dispositivos + gate `requireKioskDevicesView` | `dispositivos/page.tsx` | PR block1 | e2e auth-roles | Abrir `/dispositivos` STAFF | `/f/{fase7}/dispositivos` | staff | Access denied UI |
| #6 Cookie kiosko | `signOut` limpia cookie `/k` sin revoke BD/entitlement | `lib/auth/sign-out.ts` | PR block1 | — | Logout staff en browser que usó `/k` | `/login` | owner | Cookie kiosko ausente; device BD intacto |
| #10 Pack SA-only | Materiales PDF solo SuperAdmin; tenant mensaje contacto | `qr-tab.tsx`, `pharmacy-materials-access.ts`, `qr/page.tsx` | PR block1 | test:pharmacy-qr | SA vs Owner en QR | `/farmacias/{id}` vs `/f/{id}/qr` | SA / owner | Solo SA ve pack/carteles PDF |
| #12 visible_name | Helper + uso en público/tenant/carteles | `display-name.ts`, tenant, `/e`, kiosk home | PR block1 | display-name tests | QR Fase7 muestra nombre visible | `/e/2mo6cq0yjss6ratr` | cliente | «Farmacia Fase7…» no «TEST Fase7…» |
| #8 Planes | SKUs activos solo; errores ES; confirmContract | `available-skus.ts`, pilots/assignment panels, rpc-errors | PR block1 | commercial-ui (PDF chromium flaky) | Tarifas SA activar plan | `/tarifas` | SA | Sin SKU fantasma; error claro |
| #15 dual kit | `E2E_DUAL_EMAIL` + `--only=` | `e2e-prepare-credentials.mjs`, `test-data.ts` | PR block1 | — | Login dual + selector | `/login` | `catalog.dual.074@…` | Selector Fase7/Staging1 |
| #13–14 Catálogo | +34 productos manuales Piloto Integral; plantilla Excel | seed script, `docs/qa/PLANTILLA_*` | PR block1 + datos STG | — | Catálogo público | `/e/8132f4yiijl5igfr/catalogo` | cliente | Varios available + precios |
| Memberships Piloto | Owner/Admin/Pharmacist/Staff en Piloto Integral | staging DB insert | datos STG | — | Panel catálogo roles | `/f/{piloto}/catalogo` | kit roles | Owner precio; PHARMACIST stock |
| #16 Contrato | HTML ficticio watermark (sin fila legal) | `CONTRATO_FICTICIO_DEMO_STAGING.html` | PR block1 | — | Abrir/imprimir HTML | archivo docs/qa | — | Marca ficticio |
| #21 Sticky | Header sticky safe-area cliente/catálogo | `customer-sticky-header.tsx` | PR block1 | — | iPhone Safari scroll | `/cuenta/mis-farmacias` | cliente | Título visible |
| #24 Logos selector | PharmacyLogo en select-pharmacy + mis farmacias | `select-pharmacy/page.tsx`, saved-pharmacies | PR block1 | — | Selector dual/multi | `/auth/select-pharmacy` | dual/owner | Logo o iniciales |
| #25 PWA | Maskable dedicados + apple-touch opaco | `manifest`, icons, sw | PR block1 | — | Añadir a inicio iPhone | PWA `/cuenta` | cliente | Icono circular; iOS sin transparencia |
| #18 Ayuda tenant | `/f/.../ayuda` + hub estructura | ayuda pages, tenant-nav | PR block1 | help access tests | Ver Ayuda en panel | `/f/{fase7}/ayuda` | owner | Hub sin docs inventadas |
| Matriz permisos | Documentada | `MATRIZ_PERMISOS_FARMACIA_2026-11-23.md` | PR block1 | — | Revisar excesos `settings.update` | — | — | Decisión futura |
| #9/#11 diseño | Solo propuestas | `PROPUESTA_ASISTENTE_*`, `PROPUESTA_CARTERA_*` | PR block1 | — | Aprobar diseño | — | — | No implementado |

## Verificación automática (local)

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | OK |
| ESLint archivos tocados B1 | OK |
| `test:pharmacy-clients` / tenant-nav | OK (gates usuarios/kiosko) |
| `test:pharmacy-qr` (sesión previa) | OK |
| `test:commercial-ui` | 37/40 — 3 fallos Chromium PDF preexistentes |
| E2E Playwright | Pendiente en staging tras deploy |
| `next build` | Pendiente en deploy Vercel |

## Despliegue

| Entorno | Estado |
|---------|--------|
| Código en rama | `fix/qa-2026-11-23-block1` @ `0f49208` |
| PR | https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/28 → `integration/farmafacil-release` |
| Staging Vercel | **Desplegado** `dpl_9mhJchbCsZCjPTRYeRWjjXSgxS5W` → https://farmafacil-staging.vercel.app (Ready; smoke `/login` `/e/…` 200) |
| Datos staging | Aplicados (catálogo Piloto, memberships, dual password kit) |
| FarmaFácil producción | **No tocada** |

## Pruebas manuales nuevas (desde QA-49)

| ID | Prueba | Usuario | URL / ruta | Esperado |
|----|--------|---------|------------|----------|
| QA-49 | PHARMACIST: Usuarios oculto en menú | pharmacist | Panel Fase7 | Sin ítem Usuarios |
| QA-50 | PHARMACIST: URL directa Usuarios | pharmacist | `/f/{fase7}/usuarios` | Mensaje permiso + Volver dashboard |
| QA-51 | STAFF: URL Kiosko | staff | `/f/{fase7}/dispositivos` | Idem denegación |
| QA-52 | OWNER: Usuarios y Kiosko OK | owner | mismas rutas | Paneles operativos |
| QA-53 | Logout limpia sesión kiosko browser | owner tras visitar `/k` | logout → `/k` | Pide emparejar; device BD sigue |
| QA-54 | Pack bienvenida solo SA | SA vs owner | ficha farmacia / QR tenant | Solo SA PDF pack |
| QA-55 | Nombre visible en QR público | — | `/e/2mo6cq0yjss6ratr` | visible_name Fase7 |
| QA-56 | Tarifas: solo SKUs vigentes | SA | `/tarifas` | No planes fantasma |
| QA-57 | Login dual + selector | dual | `/login` | 2 farmacias, roles distintos |
| QA-58 | Aislamiento dual | dual | pedidos Fase7 vs Staging1 | Solo datos de farmacia activa |
| QA-59 | Catálogo Piloto available | cliente | `/e/8132f4yiijl5igfr/catalogo` | ≥8 disponibles, precios |
| QA-60 | Owner cambia precio Piloto | owner | `/f/{piloto}/catalogo` | Precio editable |
| QA-61 | PHARMACIST stock no precio Piloto | pharmacist | catálogo Piloto | Stock sí / PVP no |
| QA-62 | STAFF solo lectura precios | staff | catálogo Piloto | Sin edición comercial |
| QA-63 | Staging1 sigue pending | — | `/e/91dntkqzz29hscvt` | Sin catálogo rico; status intacto |
| QA-64 | Contrato HTML ficticio | — | `docs/qa/CONTRATO_FICTICIO_DEMO_STAGING.html` | Preview/print, marca ficticio |
| QA-65 | Sticky Mis farmacias iPhone | cliente | `/cuenta/mis-farmacias` | Header no tapa lista |
| QA-66 | Logos selector | dual | `/auth/select-pharmacy` | Logo/fallback |
| QA-67 | PWA icono iPhone | cliente | Añadir a inicio | Icono FarmaFácil; fondo sistema OK |
| QA-68 | Ayuda tenant | owner | `/f/{fase7}/ayuda` | Hub visible, sin docs falsas |
| QA-69 | Import plantilla (dry) | owner | import catálogo | Plantilla Excel válida |
| QA-70 | Asistente sigue en kiosko Fase7 | — | `/k/asistente` | Trial; **no** en `/e/` (diseño pendiente) |

## Pendiente / no hecho

1. Redeploy staging Vercel con esta rama.  
2. E2E completo en CI/staging.  
3. Implementación Bloque 4 (asistente cliente + cartera) — **solo propuestas**.  
4. Fila `commercial_contracts` real — bloqueada por plantilla legal / quote; HTML demo como alternativa.  
5. Migración 105 — **no aplicada**.  
6. Excesos documentados: PHARMACIST `settings.update` / `memberships.view` — sin cambio de seed.

## Contraseñas

No se listan. Kit vía `npm run test:e2e:prepare` / `--only=E2E_DUAL_EMAIL`. Valor solo en `.env.e2e.local` (gitignored).
