# FarmaFácil — Diagnóstico QA y plan de correcciones

**Fecha:** 2026-11-23  
**Ámbito:** solo lectura (código `integration/farmafacil-release` + Supabase staging `dazfdcjscnpfvhcyjddt` + Vercel `farmafacil-staging`)  
**Producción / migraciones / datos / credenciales:** no modificados  
**Fuentes:** incidencias del prompt QA (iPhone/Mac); inventario staging previo; inspección de código y consultas read-only a staging.  
**No disponible en esta sesión:** PDF «Pruebas SuperAdmin.pdf» ni Google Sheets «Checklist QA móvil» / «Hallazgos SuperAdmin PDF». Donde falte evidencia de captura, se marca como *reportado en QA* y se contrastó con código/BD.

---

## 1. Resumen ejecutivo

Las pruebas funcionales en staging confirman **aislamiento de escritura** sólido para PHARMACIST y STAFF (Server Actions + RLS + trigger de precios). **No hay bypass P0 de mutación** de precios, usuarios ni kioskos. Lo que el QA percibe como «rebote silencioso» es sobre todo un **fallo de UX/navegación** (enlace visible → redirect sin mensaje), no una filtración de datos.

Los hallazgos accionables se concentran en:

1. **UX de denegación** (Usuarios / Kiosko visibles sin permiso).  
2. **ACL del pack de bienvenida** (Owner/Admin de farmacia pueden descargarlo; debería ser solo SuperAdmin).  
3. **Nombre visible** inconsistente en carteles/QR de panel vs entrada pública.  
4. **Datos de staging insuficientes** (catálogos `own` con 0 `available`; Staging 1 en `pending_setup`; `catalog.dual` fuera del kit `E2E_PASSWORD`).  
5. **Producto / diseño**: asistente solo en kiosko/panel (no en `/e/`); contrato del pack intencionalmente vacío; Cartera comercial aún no publicada.

**No aplicar** migración `105_kiosk_unlink_revokes_device_v1.sql` ni tocar ciclo de vida de kioskos hasta resolver el incidente previo de «Activar piloto» vs entitlement.

---

## 2. Tabla de incidencias

| # | Grav. | Incidencia | Evidencia QA / staging | Causa probable | Archivos implicados | Clasificación |
|---|-------|------------|------------------------|----------------|---------------------|---------------|
| 1 | P0 | PHARMACIST no debe modificar precios/usuarios/kioskos/config general | Reportado en QA; contrastado en código+seed | Mutaciones **bloqueadas** (action+RLS+trigger). UI parcial: precios sin campo PVP; usuarios/kiosko enlaces visibles | `lib/catalog/catalog-permissions.ts`, `app/f/.../catalogo/actions.ts`, `074_*.sql` (trigger), `membership-authz.ts`, `seed.sql` | **Bug UX** (nav); **seguridad escritura OK** |
| 2 | P0 | STAFF no debe usuarios/kioskos/precios | Idem | Escritura denegada; nav Usuarios/Kiosko visibles; redirect silencioso en Usuarios | `usuarios/page.tsx`, `tenant-nav.ts`, `pharmacy-clients-roles.ts` | **Bug UX**; **seguridad escritura OK** |
| 3 | P0 | Protección UI / rutas / actions / API / RLS | Inspección | Middleware **sin** RBAC de farmacia; layout+actions+RLS sostienen el modelo. Hueco: nav no alineada con permisos | `middleware.ts`, `app/f/[pharmacyId]/layout.tsx`, `lib/auth/access.ts`, `012_rls_policies.sql` | **Mejora de defensa en profundidad** (nav/route UX); núcleo OK |
| 4 | P0 | Usuario sin membership | Outsider en kit E2E | Layout → access-denied; RLS `ff_can_read_pharmacy` | `layout.tsx`, `access.ts`, E2E `security-isolation.spec.ts` | **OK confirmado** (no bug) |
| 5 | P0 | Multifarmacia solo ve/modifica su rol×farmacia | `catalog.dual` memberships activas Fase7=PHARMACIST + Staging1=STAFF | Scoping por `pharmacyId` + membership; selector obligatorio si ≥2 | `pharmacy-access-routing.ts`, `access.ts` | **OK en código**; login dual bloqueado por password kit (ver #15) |
| 6 | P0 | Cambio de sesión conserva datos previos | Reportado en QA | Sign-out limpia cookies Auth; **no** limpia cookie de sesión kiosko | `lib/auth/sign-out.ts`, `lib/kiosk/session-cookie.ts` | **Bug confirmado** (residual kiosko en browser compartido) |
| 7 | P1 | «Usuarios y accesos» → rebote silencioso al dashboard | QA PHARMACIST/STAFF | `usuarios/page.tsx` redirect sin EmptyState; nav no gated | `usuarios/page.tsx` L25–27, `tenant-nav.ts` | **Bug UX confirmado** |
| 8 | P1 | SA puede «activar» plan inexistente | Hallazgo SuperAdmin (PDF/Sheets no leídos aquí) | En staging **existen** `plans` commercial + SKUs activos. UI `pilots-panel` / `plan-assignment-panel` usa catálogo hardcodeado; RPC rechaza si falta; error a veces mal mapeado. Panel assignment no pasa `confirmContract` | `components/tarifas/pilots-panel.tsx`, `plan-assignment-panel.tsx`, `095_*.sql`, `lib/commercial/rpc-errors.ts` | **Bug UX/validación**; backend mayormente OK en STG |
| 9 | P1 | Asistente no aparece en área pública cliente | QA `/e/…` | **Por diseño**: `/e/[publicId]` solo catálogo+cuenta. Asistente en `/k/asistente` + panel. Fase7 tiene entitlement `assistant_ai=trial` hasta 2026-12-13 | `app/e/[publicId]/page.tsx`, `app/k/asistente/page.tsx`, entitlements staging | **Decisión funcional** (no bug de flag); no habilitar global |
| 10 | P1 | Pack bienvenida solo SA | QA | `QrTab showPdfPoster` también en Owner/Admin tenant QR | `app/f/.../qr/page.tsx`, `pharmacy-welcome-pack.ts`, `qr-tab.tsx` | **Bug ACL confirmado** |
| 11 | P1 | Separar Cartera comercial vs Farmacias activadas | SA UX | Cartera = futuro/stub (`pharmacy-portfolio-recipients` vacío); Farmacias = tenants reales. No duplicar | `app/(app)/farmacias/`, `MANUAL_SUPERADMIN.md` FUT-CARTERA | **Decisión / producto**; sin migración ahora |
| 12 | P1 | QR, nombre farmacia, nav multi-farmacia cliente | QA | Público usa `visible_name`; carteles/panel usan `pharmacies.name`. Staging: Fase7 `visible_name`≠`name`. Cliente multi vía Mis farmacias OK | `098_*.sql`, `pharmacy-detail-client.tsx`, `lib/pharmacies/tenant.ts`, `SavedPharmaciesList` | **Bug naming confirmado** + datos OK en cliente |
| 13 | P1 | Staging 1 / Piloto Integral sin catálogo útil | QA + BD | Staging1: `pending_setup`, `generic`, **1** producto. Piloto Integral: `own`, **100** productos, **0** `available` (100 confirm). Prueba Piloto igual | `pharmacy_products`, `pharmacy_settings` | **Datos de prueba insuficientes** |
| 14 | P1 | Propuesta catálogo ficticio personalizado | Pedido QA | Ver §14 abajo; **no insertar** sin OK | — | **Propuesta** (autorización) |
| 15 | P1 | `catalog.dual.074` password no funciona | QA + inventario | Usuario y memberships OK; **fuera** de `e2e-prepare-credentials.mjs` → no sincroniza `E2E_PASSWORD` | `scripts/e2e-prepare-credentials.mjs` | **Config / kit** (no regenerar sin OK) |
| 16 | P1 | Sin contrato ficticio descargable | QA pack | Slot contrato del pack siempre «pendiente jurídica»; 0 filas `commercial_contracts` en STG; legal en draft | `pharmacy-welcome-pack.ts`, `docs/contracts-gap-analysis.md` | **Gap intencional / producto** |
| 17 | P1 | Tarifas 2027–29, IVA, recargo | QA SA | Motor TS implementado (IVA 21%, lanzamiento 60/30, recargo default 0) | `lib/tarifas/engine.ts`, `simulator-panel.tsx`, tests | **OK en código**; validar UI manual |
| 18 | P2 | Sección Ayuda / FAQ | QA | Ya existe `/ayuda` + hub + docs; ampliar FAQ/manuales | `app/(app)/ayuda/`, `components/help/`, `lib/help/` | **Mejora** (reutilizar) |
| 19 | P2 | ¿Farmacéutico ve QR en dashboard? | QA | Quick link QR **oculto** para PHARMACIST/STAFF; URL directa → EmptyState | `pharmacy-tenant-dashboard.tsx`, `pharmacy-clients-roles.ts` | **OK vs matriz actual**; no cambiar sin validar matriz |
| 20 | P2 | Alcance consulta clientes PHARMACIST | QA | Clientes list: PHARMACIST sí / STAFF no; consultas view ambos; manage reply no STAFF | `pharmacy-clients-roles.ts`, seed `046` | **OK código**; posible decisión de producto |
| 21 | P2 | Nav móvil: título/farmacia sticky | QA iPhone | Sidebar/topbar tenant; staging banner sticky; falta sticky de título de sección en móvil | `pharmacy-tenant-sidebar.tsx`, shells tenant | **Mejora UX** |
| 22 | P2 | Promociones según módulo | QA | Sin tablas de promociones útiles en STG (confirmado en guías previas); módulo/UI a revisar | `app/.../promociones` | **Datos + posible feature incompleta** |
| 23 | P2 | Pedidos / presupuestos farmacia | QA | Flujo existe; calidad demo depende de pedidos Fase7 | `app/f/.../pedidos`, orders libs | **Verificación manual** pendiente de matriz |
| 24 | P3 | Logos en selector | QA | Branding: Fase7 y Prueba Piloto con `logo_url`; Staging1 y Piloto Integral **null**. Fallback iniciales | `pharmacy_branding`, selector components | **Datos + mejora UI** si selector no muestra logo |
| 25 | P3 | PWA icon/splash fondo blanco iPhone | QA | Manifest `background_color #F7FAFA`; icons `any`+`maskable` **mismo PNG**; iOS usa apple-touch | `public/manifest.webmanifest`, `public/icons/pwa-*.png` | **Mejora assets** (no confundir con PNG transparente) |
| 26 | P3 | Legibilidad / spacing / responsive | QA | Revisión visual continua | shells tenant/cliente | **Mejora** |

---

## 3. Clasificación consolidada

| Tipo | Incidencias |
|------|-------------|
| Bug confirmado (código) | #6 (cookie kiosko), #7 (rebote Usuarios), #10 (pack ACL), #12 (visible_name en materiales) |
| Bug UX / validación (sin bypass datos) | #1–3 (nav/kiosko shell), #8 (SKU hardcode + errores) |
| Configuración / kit | #15 (dual fuera de prepare) |
| Datos de prueba insuficientes | #13, #14 (propuesta), parte de #22–24 |
| Por diseño / gap de producto | #9 (asistente no en `/e/`), #11 (Cartera), #16 (contrato), #19 OK |
| OK / no vulnerabilidad | #4, #5 (código), #17 (motor), #20 (matriz actual) |
| Mejora P2/P3 | #18, #21, #25, #26 |
| Decisión funcional pendiente | #9 (¿asistente en público?), #11 (CRM), #16 (demo contrato), #19–20 (matriz permisos), #14 (insertar seed) |

---

## 4. Matriz de permisos: real vs esperado (farmacia)

Fuente real: `supabase/seed.sql` + migraciones `035`/`046`/`074` + gates de app.

| Capacidad | Esperado QA | OWNER/ADMIN | PHARMACIST | STAFF | ¿Gap? |
|-----------|-------------|-------------|------------|-------|-------|
| Ver catálogo / precios | Sí roles operativos | Sí | Sí (lectura) | Sí (lectura) | No |
| Modificar precios (PVP) | Solo OWNER/ADMIN | Sí | **No** (UI+action+trigger) | **No** | No |
| Actualizar stock | PHARMACIST sí | Sí | Sí | No | No |
| Gestionar usuarios | Solo OWNER/ADMIN | Sí | **No** (action+RLS) | **No** | **UX:** nav visible + redirect silencioso |
| Ver listado peers | — | Sí | `memberships.view` sí (API) | No | Decidir si PHARMACIST debe ver peers |
| Kiosko devices | Solo OWNER/ADMIN | Sí | **No** mutate; página shell+error | **No** | **UX:** nav + banner entitlement |
| QR farmacia (gestión) | OWNER/ADMIN | Sí | No (EmptyState) | No | Alineado |
| Pack bienvenida PDF | **Solo SuperAdmin** (pedido QA) | **Hoy sí en tenant QR** | No | No | **ACL incorrecta vs pedido** |
| Clientes list | PHARMACIST sí / STAFF no | Sí | Sí | No | OK |
| Consultas IA view | Sí | Sí | Sí | Sí | OK |
| Consultas manage | No STAFF | Sí | Sí | No | OK |
| Identidad farmacia (nombre/CIF/logo) | Solo SA | No tenant | No | No | OK (`099`) |
| Settings operativos / contenido asistente | — | Sí | `settings.update` **sí** (seed) | No | Confirmar si es intencional |
| Outsider sin membership | Sin datos | — | — | — | OK |

**Plataforma:** SuperAdmin / Support vía `platform_user_roles` (no membership de farmacia).

---

## 5. Evidencia staging (consultas 2026-11-23)

| Farmacia | status | plan | catalog_mode | visible_name | productos activos | available | confirm | logo | assistant_ai |
|----------|--------|------|--------------|--------------|-------------------|-----------|---------|------|--------------|
| Staging 1 (`91dntkqzz29hscvt`) | `pending_setup` | `starter` | generic | = name | 1 | 1 | 0 | null | — |
| Fase7 (`2mo6cq0yjss6ratr`) | active | `general` | generic | **≠ name** («Farmacia Fase7…» vs «TEST Fase7…») | 101 | 1 | 100 | sí | **trial** → 2026-12-13 |
| Piloto Integral (`8132f4yiijl5igfr`) | active | `personalizado` | own | = name | 100 | **0** | 100 | null | — |
| Prueba Piloto (`l595c6fdmhozxe2u`) | active | `personalizado` | own | = name | 100 | **0** | 100 | sí | cancelled |

- `plans` commercial (`general`, `personalizado`, `asistente_ia_personalizado`) y SKUs (`pilot`, `general`, `personalized`, `ai_personalized`): **activos**.  
- `commercial_contracts`: **0** filas.  
- `catalog.dual.074`: memberships activas (Fase7 PHARMACIST + Staging1 STAFF).

---

## 6. Propuesta datos ficticios catálogo personalizado (#14) — NO insertar

Objetivo: farmacia `own` usable en demo (precios, stock, fotos, agotados/confirm). Preferir UI Owner/Admin o import autorizado; evitar SQL crudo (triggers stock).

| SKU | Nombre | Cat. | PVP € | Estado | Stock | Foto |
|-----|--------|------|------:|--------|------:|------|
| FF-OWN-001 | Crema solar FPS50 200ml | Solar | 18,90 | available | 12 | placeholder |
| FF-OWN-002 | Aftersun aloe 250ml | Solar | 9,50 | available | 20 | placeholder |
| FF-OWN-003 | Champú anticaspa 400ml | Capilar | 7,25 | available | 15 | placeholder |
| FF-OWN-004 | Sérum vitamina C 30ml | Facial | 24,00 | available | 8 | placeholder |
| FF-OWN-005 | Gel hidroalcohólico 100ml | Higiene | 3,50 | available | 40 | placeholder |
| FF-OWN-006 | Test embarazo 2u | Autodiagnóstico | 6,90 | confirm_with_pharmacy | — | — |
| FF-OWN-007 | Tiras glucemia 50u | Autodiagnóstico | 19,90 | confirm_with_pharmacy | — | — |
| FF-OWN-008 | Pañal adulto M 20u | Ortopedia | 14,50 | available | 6 | placeholder |
| FF-OWN-009 | Termómetro digital | Aparatos | 11,00 | available | 10 | placeholder |
| FF-OWN-010 | Omega-3 60 cáps | Nutrición | 16,80 | available | 14 | placeholder |
| FF-OWN-011 | Bálsamo labial SPF | Facial | 4,20 | available | 0 → agotado / confirm | — |
| FF-OWN-012 | Solución lentillas 360ml | Óptica | 8,75 | confirm_with_pharmacy | — | — |

Meta: ≥8 `available` con PVP+stock; 3–4 confirm; 1–2 agotados visibles.

---

## 7. Plan de corrección — PRs pequeñas e independientes

Orden recomendado (después de autorización):

| PR | Título | Incidencias | Migración | Riesgo |
|----|--------|-------------|-----------|--------|
| **PR-A** | UX denegación Usuarios/Kiosko + EmptyState | #1–3, #7 | No | Bajo |
| **PR-B** | Pack bienvenida solo SuperAdmin; QR públicos intactos | #10 | No | Medio (ACL) |
| **PR-C** | Usar `visible_name` en carteles/QR panel/tenant | #12 | No | Bajo |
| **PR-D** | Sign-out limpia cookie sesión kiosko | #6 | No | Bajo |
| **PR-E** | Tarifas SA: validar SKU contra `plans`/SKU activos + mapear `technical_plan_missing` + `confirmContract` | #8 | No* | Medio |
| **PR-F** | Kit E2E: incluir `catalog.dual.074` (+ opcional sinpedidos) en prepare | #15 | No | Bajo; **requiere OK** para reset password |
| **PR-G** | Ops staging: catálogo demo Piloto Integral / Staging1 | #13–14 | No (datos) | Medio datos; **OK explícito** |
| **PR-H** | Sticky título/farmacia móvil | #21 | No | Bajo |
| **PR-I** | PWA icons maskable + splash iOS | #25 | No | Bajo assets |
| **PR-J** | Ampliar Ayuda FAQ reutilizando hub | #18 | No | Bajo |
| **PR-K** | Logos en selector farmacia | #24 | No | Bajo |
| **—** | Asistente en `/e/` | #9 | Posible feature | **Decisión producto**; no global |
| **—** | Contrato demo en pack | #16 | Asset | **Decisión legal/producto** |
| **—** | Cartera CRM | #11 | Futura | No mezclar con `pharmacies` |
| **BLOQUEO** | Migración 105 / unlink kiosko | — | **Prohibido** hasta fix piloto→entitlement | Alto |

\*Si staging careciera de filas `plans` (hoy no es el caso), sería seed/ops, no schema nuevo.

---

## 8. Migraciones

| ¿Necesaria? | Detalle |
|-------------|---------|
| **No** para P0/P1 bugs de código listados | Correcciones app/UX/ACL |
| **No** `105_kiosk_unlink_revokes_device_v1.sql` | Bloqueo explícito; riesgo de cancelar entitlement al «Activar piloto» |
| **Futura** (solo con OK) | Tablas CRM Cartera; ruta pública asistente con gate por entitlement |
| Riesgo/reversión | Cualquier cambio RLS futuro: aplicar solo staging → pruebas matriz → rollback SQL versionado |

---

## 9. Pruebas de validación por corrección

### Automatizadas (existentes a extender)

- `e2e/p0/auth-roles.spec.ts` — ampliar: Usuarios muestra EmptyState / nav oculta; Kiosko no muestra CTA manage sin permiso.  
- `e2e/p0/security-isolation.spec.ts` — outsider.  
- Unit: `lib/tarifas/simulator.test.ts` (ya cubre 2027–29).  
- Nuevo unit: welcome-pack gate (solo platform SA); `visible_name` en builders de cartel.

### Manuales (staging, dry-run email/cobros)

| Tras PR | Quién | Pasos |
|---------|-------|-------|
| A | PHARMACIST, STAFF | Nav: Usuarios/Kiosko ocultos o EmptyState con mensaje; sin redirect silencioso |
| A | OWNER | Usuarios y Kiosko siguen operativos |
| B | SA vs Owner | Solo SA descarga pack; Owner mantiene PNG/SVG QR y `/e/{id}` |
| C | SA | Cartel muestra `visible_name` Fase7 |
| D | Staff→logout→kiosko otro user | Sin sesión kiosko residual |
| E | SA Tarifas | SKU inexistente no activable / error claro; planes reales OK |
| F | dual | Login con password kit tras prepare autorizado |
| G | Cliente iPhone | Catálogo Piloto con disponibles y precios |

---

## 10. Dependencias y bloqueos

1. **Kiosko lifecycle / mig 105** — bloquea cualquier automatización de revoke.  
2. **Autorización** para reset password kit (`test:e2e:prepare`) y para insertar catálogo demo.  
3. **PDF/Sheets** no leídos aquí — contrastar capturas SuperAdmin del plan «inexistente» con SKU exacto UI.  
4. **Decisión producto** asistente en área pública antes de código.  
5. Staging 1 `pending_setup` limita demos de panel aunque el QR público funcione.

---

## 11. Decisiones que requieren autorización

1. ¿Ocultar nav Usuarios/Kiosko a PHARMACIST/STAFF o solo EmptyState?  
2. ¿Pack bienvenida **exclusivo SuperAdmin** (confirmar vs Owner)?  
3. ¿Incluir `catalog.dual.074` (y `cliente.sinpedidos.qa`) en `e2e-prepare` y **resetear** passwords del kit?  
4. ¿Autorizar carga de catálogo ficticio en Piloto Integral (y/o otra farmacia `own`)?  
5. ¿Asistente en `/e/` solo si entitlement activo, o permanece solo kiosko?  
6. ¿Contrato PDF demo (BORRADOR) en pack, sin valor legal?  
7. ¿PHARMACIST debe perder `settings.update` / edición contenido asistente?  
8. ¿Avanzar Cartera CRM (nueva entidad) o solo copy/IA en UI SA?  
9. **No** aplicar mig 105 hasta fix piloto/entitlement — confirmar prioridad de ese fix.

---

## 12. Notas de método

- Inspección: worktree `integration/farmafacil-release`.  
- Staging: service_role **solo SELECT**/list auth metadata; sin updates.  
- No se imprimieron ni regeneraron contraseñas.  
- Al implementar: PRs pequeñas, dry-run email, sin cobros, sin producción.

---

*Fin del diagnóstico. Esperar autorización explícita antes de implementar.*

---

## 13. Estado de implementación (actualizado 2026-11-23)

Autorización recibida. Implementación en rama `fix/qa-2026-11-23-block1`.

Ver detalle y QA-49… en [`RESULTADOS_CORRECCIONES_QA_2026-11-23.md`](./RESULTADOS_CORRECCIONES_QA_2026-11-23.md).

| Bloque | Estado |
|--------|--------|
| 1 Seguridad/UX/pack/visible_name/planes/matriz | Implementado en código |
| 1.2 Cookie kiosko en sign-out | Implementado (solo cookie browser; sin revoke BD) |
| 2 Datos staging | Dual en kit; catálogo Piloto + memberships; contrato HTML demo |
| 3 UX sticky/logos/PWA/ayuda | Implementado |
| 4 Asistente cliente + Cartera | Solo propuestas (sin código de producto) |
| Mig 105 / prod | No tocado |
