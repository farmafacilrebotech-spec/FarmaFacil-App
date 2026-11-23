# Matriz de permisos de farmacia — real vs aprobado

**Fecha:** 2026-11-23  
**Rama:** `fix/qa-2026-11-23-block1` (sin commit; sin migraciones nuevas; sin producción)  
**Fuentes (código/BD versionada):** `supabase/seed.sql`, migraciones `035`, `040`, `046`, `074`, `099`; `lib/pharmacies/pharmacy-clients-roles.ts`, `lib/pharmacies/pharmacy-materials-access.ts`, `lib/pharmacies/tenant-nav.ts`, gates de `app/f/[pharmacyId]/*`.  
**Complementa:** `docs/qa/DIAGNOSTICO_QA_2026-11-23.md` §4.

> «Aprobado» = decisiones indicadas en el prompt de autorización QA de esta entrega
> (QR oculto a farmacéutico, clientes visibles para farmacéutico, pack de bienvenida solo SuperAdmin,
> sin edición de precios/usuarios/kioskos por PHARMACIST/STAFF).
> Donde el prompt no se pronunció se marca **«Sin decisión»**; no se ha cambiado comportamiento.

Leyenda: ✅ permitido · ❌ denegado · 👁 solo lectura · — no aplica.  
Roles: **OWNER** = `PHARMACY_OWNER`, **ADMIN** = `PHARMACY_ADMIN`, **PHARMACIST**, **STAFF**.

## 1. Matriz

| Capacidad | OWNER | ADMIN | PHARMACIST | STAFF | Aprobado | ¿Exceso / gap? |
|-----------|:-----:|:-----:|:----------:|:-----:|----------|----------------|
| Dashboard / datos básicos (`pharmacy.view`) | ✅ | ✅ | ✅ | ✅ | Todos | No |
| Pedidos: ver (`orders.view`) | ✅ | ✅ | ✅ | ✅ | Operativo | No |
| Pedidos: gestionar (`orders.manage`) | ✅ | ✅ | ✅ | ❌ | STAFF solo lectura | No |
| Catálogo: ver (`catalog.view`) | ✅ | ✅ | 👁 | 👁 | Sí | No |
| Catálogo: crear/editar producto y **precios** (`catalog.manage`) | ✅ | ✅ | ❌ | ❌ | Solo OWNER/ADMIN | No (acción + RLS + trigger `074`) |
| Catálogo: stock/disponibilidad (`catalog.stock.update`) | ✅ | ✅ | ✅ | ❌ | PHARMACIST sí | No |
| **Clientes** (listado con pedidos vinculados) | ✅ | ✅ | ✅ | ❌ | PHARMACIST **sí**, STAFF no | No. Gate: `requirePharmacyClientsAccess` (`roleCanViewPharmacyClients` + `orders.view`) y nav `clientes` |
| **QR de mi farmacia** (página `/f/{id}/qr`, nav y acceso directo dashboard) | ✅ | ✅ | ❌ (oculto) | ❌ | PHARMACIST **oculto** | No. `roleCanManagePharmacyQr`; URL directa → EmptyState «Sin acceso al QR». Nota: PHARMACIST/STAFF conservan `entrypoints.view` (lectura RLS del entrypoint) pero sin UI |
| QR: descargar PNG / SVG individual | ✅ | ✅ | ❌ | ❌ | Owner/Admin | No |
| QR: carteles personalizados (acceso/publicitario), vista previa, PDF, impresión | ❌ | ❌ | ❌ | ❌ | **Solo SuperAdmin** | Corregido en esta rama (antes ✅ OWNER/ADMIN). Los PDF se generan en navegador (jsPDF): no hay endpoint ni Server Action; la puerta es `canGenerateMaterials` calculado en servidor en `app/(app)/farmacias/[id]/page.tsx` (`hasPlatformSuperAdminRole`) y nunca activado en `/f/[id]/qr` |
| Pack de bienvenida (PDF multipágina) | ❌ | ❌ | ❌ | ❌ | **Solo SuperAdmin** | Corregido (misma puerta). Mensaje tenant: «Si necesitas más material publicitario personalizado…» |
| Usuarios y accesos: ver peers (`memberships.view`) | ✅ | ✅ | 👁 (API/RLS) | ❌ | Solo OWNER/ADMIN gestionan | **Sin decisión**: PHARMACIST puede leer miembros vía permiso; la página tenant redirige al dashboard |
| Usuarios y accesos: invitar/cambiar rol/suspender (`memberships.manage`) | ✅ | ✅ (jerarquía) | ❌ | ❌ | Solo OWNER/ADMIN | No en escritura. **UX pendiente (PR-A del diagnóstico):** enlace visible y redirect silencioso a dashboard |
| Kiosko: dispositivos ver/gestionar (`kiosk.devices.*`) | ✅ | ✅ | ❌ | ❌ | Solo OWNER/ADMIN | No en escritura. **UX pendiente:** nav visible; página muestra shell/errores sin permiso |
| Asistente: consultas ver (`assistant.consults.view`) | ✅ | ✅ | ✅ | ✅ | Sí | No |
| Asistente: responder/gestionar consultas (`assistant.consults.manage`) | ✅ | ✅ | ✅ | ❌ | STAFF no | No |
| Asistente: contenido (`pharmacy_assistant_settings`) | ✅ | ✅ | ✅ (`settings.update`) | ❌ | **Sin decisión** | **Posible exceso:** PHARMACIST tiene `settings.update` en seed (ver §3) |
| Ajustes operativos (`settings.update`) | ✅ | ✅ | ✅ | ❌ | **Sin decisión** | **Posible exceso** (ver §3) |
| Branding (`branding.update`) | ✅ | ✅ | ❌ | ❌ | — | No (y logo/nombre visible: solo SuperAdmin, migración `099`) |
| Identidad: logo, `visible_name`, nombre fiscal, CIF | ❌ | ❌ | ❌ | ❌ | Solo SuperAdmin | No (`099`) |
| Promociones (módulo) | ✅ | ✅ | ✅ | ✅ | **Sin decisión** | Página informativa sin datos reales todavía |
| Planes / tarifas / contratación / pilotos | ❌ | ❌ | ❌ | ❌ | Solo SuperAdmin | No (panel `/tarifas`, plataforma) |

## 2. Resumen de decisiones aplicadas en esta entrega

1. **QR para PHARMACIST:** oculto (sin cambios; ya alineado). Test existente: `tenant-nav.test.ts` («farmacéutico ve clientes pero no QR»).
2. **Clientes para PHARMACIST:** acceso permitido (sin cambios). STAFF sin acceso.
3. **Material publicitario / pack:** exclusivo SuperAdmin (nuevo). OWNER/ADMIN: solo PNG/SVG + mensaje de contacto con FarmaFácil.
4. **Nombre visible:** ver `lib/pharmacies/display-name.ts` — `visible_name` → `name` para UX pública y carteles; el nombre fiscal (`pharmacies.name`) sigue en documentos legales.

## 3. Excesos / puntos a decidir (no modificados)

| # | Hallazgo | Riesgo | Propuesta |
|---|----------|--------|-----------|
| E1 | PHARMACIST tiene `settings.update` (seed). | Puede editar ajustes operativos de la farmacia (horario, teléfono, etc.). | Decidir si se revoca (requiere migración de permisos; **no** incluida aquí). |
| E2 | PHARMACIST tiene `memberships.view`. | Ve el listado de peers vía API/RLS aunque la UI redirige. | Decidir si debe verlos; si no, quitar permiso (migración) o mantener solo por defensa en UI. |
| E3 | Nav tenant muestra «Usuarios y accesos» y «Kiosko» a PHARMACIST/STAFF. | UX: enlace → redirect silencioso/pantalla sin permiso. No es bypass de datos. | PR-A del diagnóstico: ocultar nav o EmptyState explícito. |
| E4 | Generación de PDF en cliente (jsPDF): un usuario técnico podría invocar las funciones desde el bundle. | El material no contiene secretos (solo nombre, logo y URL pública), pero la restricción es de producto, no criptográfica. | Si se exige garantía fuerte, mover la generación a un endpoint/Server Action con `hasPlatformSuperAdminRole`. |
| E5 | `loadPharmacyCommercialGate` y pantallas de suspensión/preparación usan `pharmacies.name`. | Nombre fiscal visible en esas pantallas internas. | Opcional: usar `visible_name`. |
| E6 | RPCs públicas aún devuelven `pharmacies.name`: `ff_kiosk_get_home_context_v1` (041, compensado en app), `ff_public_catalog_list_v1` (055, compensado en app), `057`, `062` (presupuesto público `/q`), `072`, `067/071` (guardar farmacia). | Posible nombre fiscal en confirmaciones/presupuestos públicos. | Requiere migración (no incluida): `COALESCE(NULLIF(btrim(ps.visible_name),''), p.name)` como en `098`. |
| E7 | Multifarmacia (`catalog.dual.074`: PHARMACIST + STAFF en dos farmacias): el rol efectivo es por membership de la farmacia activa. | Ninguno detectado en código. | Verificar manualmente tras sincronizar credenciales E2E (autorización aparte). |

## 4. Pruebas relacionadas

- `npm run test:pharmacy-clients` — roles de clientes/QR y nav.
- `npm run test:pharmacy-qr` — incluye `pharmacy-materials-access.test.ts` y `display-name.test.ts`.
- `npm run test:commercial-ui` — incluye `available-skus.test.ts` y mapeo `technical_plan_missing`.
- E2E (staging, requiere kit de credenciales): `e2e/p1/help-posters.spec.ts` (Owner sin carteles/pack + mensaje de contacto; SuperAdmin con material) y `e2e/p1/pdf-content.spec.ts` (cartel PDF desde ficha SuperAdmin).
- Estado: pruebas técnicas unitarias OK en local; validación funcional en staging **pendiente_validacion_usuario**.
