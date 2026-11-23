# Staging — matriz de módulos y farmacias de prueba (2026-11-23)

> Solo **staging** (proyecto Supabase `dazfdcjscnpfvhcyjddt`, app `https://farmafacil-staging.vercel.app`).
> No usar producción. Sin contraseñas en este documento: las del kit E2E viven en `.env.e2e.local`
> (gitignored; `npm run test:e2e:prepare`). Solo se listan correos `@farmafacil.test`.

## 1. Farmacias de prueba y URLs

URL pública (QR): `https://farmafacil-staging.vercel.app/e/<publicId>` · catálogo: `/e/<publicId>/catalogo` ·
panel tenant: `/f/<pharmacyId>/dashboard` · SuperAdmin: `/farmacias/<pharmacyId>`.

| Farmacia | Estado | catalog_mode | Productos | URL pública (QR) | Panel tenant |
|---|---|---|---|---|---|
| TEST Fase7 QR Requests 20261021 (`98ea2742-5b57-4271-8448-b132cae70598`) | active | generic | 100 generic + 1 manual | [/e/2mo6cq0yjss6ratr](https://farmafacil-staging.vercel.app/e/2mo6cq0yjss6ratr) | `/f/98ea2742-5b57-4271-8448-b132cae70598/dashboard` |
| Farmacia Piloto Integral (`f55f94af-2d0f-424b-81d3-a4f687abd495`) | active | **own** | 100 generic (no visibles en own) + **34 manual QA** | [/e/8132f4yiijl5igfr](https://farmafacil-staging.vercel.app/e/8132f4yiijl5igfr) · [catálogo](https://farmafacil-staging.vercel.app/e/8132f4yiijl5igfr/catalogo) | `/f/f55f94af-2d0f-424b-81d3-a4f687abd495/dashboard` (**sin miembros**, ver §4) |
| Farmacia Staging 1 (`187c908e-1f21-4db9-92f4-eae0e79ad2a2`) | **pending_setup** (no activar) | generic | 1 manual | [/e/91dntkqzz29hscvt](https://farmafacil-staging.vercel.app/e/91dntkqzz29hscvt) | `/f/187c908e-1f21-4db9-92f4-eae0e79ad2a2/dashboard` |
| Farmacia Prueba Piloto (`af477147-a1cf-4520-b4cf-ba65596d6f4a`) | active | own | 100 generic | [/e/l595c6fdmhozxe2u](https://farmafacil-staging.vercel.app/e/l595c6fdmhozxe2u) | tiene presupuesto **aceptado** FF-PRE-20261116-NH9C (módulo contratos) |
| TEST3070 - Farmacia Piloto Valencia (`1e77debd-…`) | pending_setup | own | 100 generic | [/e/zc1oi3bwakoeo450](https://farmafacil-staging.vercel.app/e/zc1oi3bwakoeo450) | invitación pendiente |
| TEST Piloto Comercial …084244 (`e32e7f53-…`) | active | generic | 30 demo + 100 generic | [/e/gtelvo35nsi4l2ma](https://farmafacil-staging.vercel.app/e/gtelvo35nsi4l2ma) | owner de laboratorio |
| TEST Piloto Comercial …090021 (`5678313c-…`) | active | generic | 30 demo | [/e/pwovw2emet7eykuz](https://farmafacil-staging.vercel.app/e/pwovw2emet7eykuz) | owner de laboratorio |
| TEST Fase6 Piloto …103334 (`e5be9e6e-…`) | active | generic | 100 generic | [/e/uy1n0h5eafuvdtzi](https://farmafacil-staging.vercel.app/e/uy1n0h5eafuvdtzi) | owner de laboratorio |

## 2. Usuarios de prueba (solo emails)

| Rol E2E (`roleEmail`) | Email | Notas |
|---|---|---|
| `superadmin` | `emails.sa.075-emails-stage@farmafacil.test` | SuperAdmin Total (plataforma, contratos, tarifas, catálogo maestro) |
| `owner` | `catalog.owner.074@farmafacil.test` | PHARMACY_OWNER en Fase7 |
| `admin` | `catalog.admin.074@farmafacil.test` | PHARMACY_ADMIN en Fase7 |
| `pharmacist` | `catalog.pharmacist.074@farmafacil.test` | PHARMACIST en Fase7 (solo stock/disponibilidad) |
| `staff` | `catalog.staff.074@farmafacil.test` | STAFF en Fase7 |
| `dual` (**nuevo en kit**, `E2E_DUAL_EMAIL`) | `catalog.dual.074@farmafacil.test` | Multi-farmacia: PHARMACIST en Fase7 (active) + STAFF en Staging 1 (active, farmacia `pending_setup`). Prueba selector `/auth/select-pharmacy` y roles distintos por farmacia |
| `customer` | `cliente.test3070@farmafacil.test` | Cliente con pedidos (histórico 0029/0033/0034/0035) |
| `customerB` | `lab.cliente.b.clientsqr@farmafacil.test` | Cliente B (aislamiento entre clientes) |
| `outsider` | `catalog.outsider.074@farmafacil.test` | Sin membership: debe ser rechazado en `/f/*` |
| (fuera del kit) | `cliente.sinpedidos.qa@farmafacil.test` | Cliente sin pedidos (estado vacío) |
| (fuera del kit) | `titular.demo@farmafacil.test` | Titular demo |

Otras cuentas `*.test` fuera del kit: `emails.out.075-emails-stage`, `emails.sa2.075-emails-stage`, `emails.support.075-emails-stage`
(módulo Emails), `lab.cliente.a.clientsqr`, `owner.fase6.20261021103334`, `test.pilot.owner.2026102108*/09*`.
Hay además cuentas reales de personas del equipo con memberships `invited`/`active` en staging; **no se listan aquí**.

### Kit E2E y contraseñas

- `node scripts/e2e-prepare-credentials.mjs` (default): resetea **todo** el kit con **una contraseña compartida**
  (`E2E_PASSWORD` del entorno o aleatoria) y reescribe `.env.e2e.local`. Rota la contraseña de todos.
- `node scripts/e2e-prepare-credentials.mjs --only=E2E_DUAL_EMAIL`: resetea **solo** esa(s) clave(s) **reusando** la
  contraseña ya guardada en `.env.e2e.local` (no rota al resto). Falla si no hay contraseña previa.
- El script nunca imprime la contraseña.

## 3. Módulo → qué prueba → dónde

| Módulo | Qué probar | Farmacia / URL | Usuario |
|---|---|---|---|
| Acceso y roles tenant | Menús por rol, 403 en secciones restringidas (`MATRIZ_PERMISOS_FARMACIA_2026-11-23.md`) | Fase7 `/f/98ea…/dashboard` | owner, admin, pharmacist, staff, outsider |
| Multi-farmacia | Selector con logo/fallback de iniciales, rol por farmacia, «Cambiar de farmacia» | `/auth/select-pharmacy` | dual |
| Catálogo propio (own) | Estados disponible / agotado / confirmar / no disponible, precios variados, stock bajo | Piloto Integral `/e/8132f4yiijl5igfr/catalogo` | anónimo/cliente (público); SuperAdmin vía `/farmacias/f55f…` |
| Import Excel/CSV | Preview de altas, actualizaciones por SKU y filas con error | `docs/qa/PLANTILLA_IMPORT_CATALOGO_PARAFARMACIA_QA.xlsx` (+ `.csv`) → `/f/<id>/catalogo` | owner/admin (requiere `catalog.manage`) |
| Catálogo genérico (generic) | Sin precio/stock inventado, «Confirmar en farmacia», no añadible al carrito | Fase7 `/e/2mo6cq0yjss6ratr/catalogo` | anónimo/cliente |
| QR y pedidos públicos | Solicitud desde QR, carrito, pedidos vinculados a cuenta | Fase7 `/e/2mo6cq0yjss6ratr` | customer, customerB |
| Área cliente / PWA | «Mis farmacias» (logos+fallback), «Mis pedidos», cabeceras sticky móvil, instalación PWA | `/cuenta/mis-farmacias`, `/e/<id>/cuenta/pedidos` | customer, `cliente.sinpedidos.qa` |
| Clientes (tenant) | Listado de clientes con pedidos vinculados; ocultar perfil | Fase7 `/f/98ea…/clientes` | owner, admin, pharmacist |
| QR/cartel/pack bienvenida | Descarga PNG/SVG, cartel, pack | Fase7 `/f/98ea…/qr` | owner, admin |
| Usuarios y accesos | Invitaciones, roles | Fase7 `/f/98ea…/usuarios` | owner, admin |
| Kiosko | Dispositivos y pairing (sin revocar/desvincular en QA) | Fase7 `/f/98ea…/dispositivos` | owner, admin |
| Estado pending_setup | Pantalla de preparación, sin operación | Staging 1 (**no activar**) | dual (STAFF) |
| Comercial/tarifas/pilotos | Planes, pilotos, asignación | `/tarifas`, `/farmacias/<id>` | superadmin |
| Contratos (BORRADOR) | Vista previa/PDF desde presupuesto aceptado | `/contratos` con FF-PRE-20261116-NH9C (Farmacia Prueba Piloto) | superadmin |
| Contrato ficticio demo | Impresión/PDF sin validez legal | `docs/qa/CONTRATO_FICTICIO_DEMO_STAGING.html` (abrir en navegador → Imprimir) | cualquiera |
| Ayuda | Hub con primeros pasos/manuales/FAQ/soporte | Plataforma `/ayuda`; tenant `/f/<id>/ayuda` | superadmin; owner/admin/pharmacist/staff |
| PWA iconos | Maskable/apple-touch | `/manifest.webmanifest`, `/icons/*` | — |

## 4. Limitaciones conocidas

1. **Piloto Integral no tiene miembros** (0 memberships). Con usuarios tenant no se puede entrar a su panel; la
   vista pública `/e/8132f4yiijl5igfr/catalogo` y la ficha SuperAdmin sí funcionan. Para probar import con rol owner/admin
   hay que invitar a un usuario de prueba desde SuperAdmin (no se ha hecho: no se crean ni modifican usuarios en esta tanda).
2. Las 100 filas `generic` de Piloto Integral son de solo lectura (trigger `pharmacy_products_guard_generic`) y no se
   muestran en modo `own`; el catálogo visible son las 34 filas `manual` (`source_ref = qa_piloto_integral_v1:PI-QA-xxx`).
3. Los triggers del catálogo (054/074) bloquean `UPDATE` con `service_role` (sin `auth.uid()`); por eso la semilla solo
   **inserta** (idempotente). Para alterar luego precios/stock, hacerlo desde la UI con un usuario con permiso, o con el import.
4. Staging 1 permanece `pending_setup` (sin cambios).
5. Contratos: ver §5.

## 5. Contrato ficticio (Bloque 2.3)

`commercial_contracts` exige `quote_id NOT NULL` (FK a `commercial_quotes`) y solo se crea desde un presupuesto
**aceptado**; la plantilla legal FF-MARCO-v1 sigue en `draft_pending_legal_review` (ReBoTech sin constituir). Crear un
presupuesto/contrato falso arriesgaría tocar estados comerciales, así que **no se ha insertado ninguna fila**.

- **Preview/PDF/print de prueba**: `docs/qa/CONTRATO_FICTICIO_DEMO_STAGING.html` (marca de agua «FICTICIO», sin validez legal,
  sin vínculo a presupuestos/suscripciones/cobros).
- **Cómo generar un BORRADOR real en staging (SuperAdmin Total)**: `/contratos` → presupuesto aceptado
  `FF-PRE-20261116-NH9C` (Farmacia Prueba Piloto) → «Vista previa» → «Guardar borrador» → «PDF». Firma y emisión definitiva
  siguen bloqueadas por `legal/contracts/STATUS.json`. Guardar borrador crea una fila en `commercial_contracts` (acción
  del módulo; no activa servicio ni facturación).
- El pack de bienvenida (`lib/pharmacies/pharmacy-welcome-pack.ts`) solo admite una nota en el slot de contrato, no un documento,
  así que no se ha cableado.

## 6. Mutaciones de datos en staging (esta tanda)

| Acción | Tabla | Cantidad |
|---|---|---|
| Reset de contraseña de `catalog.dual.074@farmafacil.test` (misma contraseña del kit) | `auth.users` | 1 |
| Inserción de productos propios de muestra (Piloto Integral): 19 disponibles, 6 agotados, 6 confirmar con farmacia, 3 no disponibles | `pharmacy_products` | +34 |
| Reescritura local de `.env.e2e.local` (añade `E2E_DUAL_EMAIL`) | archivo local gitignored | 1 |

Sin borrados, sin cambios de estado de farmacias, sin cambios de `catalog_mode`, sin migraciones.

## Memberships Piloto Integral (añadido en corrección)

Para poder probar el panel tenant sobre el catálogo propio, se añadieron memberships activas (sin borrar las existentes):

| Email | Rol en Piloto Integral |
|-------|------------------------|
| catalog.owner.074@farmafacil.test | PHARMACY_OWNER |
| catalog.admin.074@farmafacil.test | PHARMACY_ADMIN |
| catalog.pharmacist.074@farmafacil.test | PHARMACIST |
| catalog.staff.074@farmafacil.test | STAFF |

URL panel: `/f/f55f94af-2d0f-424b-81d3-a4f687abd495/catalogo`  
Público: https://farmafacil-staging.vercel.app/e/8132f4yiijl5igfr/catalogo
