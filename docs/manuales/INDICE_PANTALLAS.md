# Índice de pantallas — FarmaFácil App

**Baseline documentado:** `origin/main` @ `00e8de4` (producción Vercel `app.farmafacil.solutions`).  
**Worktree:** `FarmaFacil-App-docs-manuales` / rama `docs/manuales-y-pruebas`.  
**Fecha:** 2026-11-03 · **2ª revisión capturas/matriz:** 2026-11-03.

## Convenciones

| Campo | Valores |
|---|---|
| **Estado** | `produccion` · `parcial` · `placeholder` · `no_publicado` |
| **Roles** | `SUPERADMIN` · `SOPORTE` · `FARMACIA` · `CLIENTE` · `PUBLIC/QR` · `AUTH` · `KIOSKO` |
| **URLs** | Producción: `https://app.farmafacil.solutions` · Local típico: `http://127.0.0.1:3010` |

**Capturas (2ª revisión):** 0 capturas UI de producción. Inventario en [capturas/README.md](capturas/README.md). Motivo habitual: *sin captura UI en repo/worktrees para este baseline*. Cómo obtenerlas: sesión local/preview con datos de prueba, anonimizar, sin escrituras en producción sin autorización.

**Enlaces:** [Farmacia](MANUAL_FARMACIA.md) · [Cliente](MANUAL_CLIENTE.md) · [SuperAdmin](MANUAL_SUPERADMIN.md) (interno) · [Plan de pruebas](../pruebas/PLAN_MAESTRO_PRUEBAS.md)

---

## AUTH / sistema

| ID | Nombre | Ruta | Rol | Estado | Captura | Notas |
|---|---|---|---|---|---|---|
| SCR-SYS-001 | Redirección raíz | `/` | AUTH | produccion | n/a (redirect) | → `/dashboard` |
| SCR-SYS-002 | Acceso denegado | `/access-denied` | AUTH, CLIENTE | produccion | Captura pendiente — sin UI en repo | |
| SCR-AUTH-001 | Login panel | `/login` | AUTH | produccion | Captura pendiente — prioridad piloto | Panel / farmacia |
| SCR-AUTH-002 | Recuperar contraseña | `/forgot-password` | AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-AUTH-003 | Restablecer contraseña | `/reset-password` | AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-AUTH-004 | Primer acceso | `/first-access` | AUTH | produccion | Captura pendiente — sin UI en repo | Invitación |
| SCR-AUTH-005 | Continuar post-login | `/auth/continue` | AUTH | produccion | n/a (router) | |
| SCR-AUTH-006 | Abrir invitación | `/auth/invite-open` | AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-AUTH-007 | Invitaciones pendientes | `/auth/invitations` | AUTH, FARMACIA | produccion | Captura pendiente — sin UI en repo | |
| SCR-AUTH-008 | Seleccionar farmacia | `/auth/select-pharmacy` | FARMACIA | produccion | Captura pendiente — sin UI en repo | |
| SCR-AUTH-009 | Recovery bridge | `/auth/recovery` | AUTH | produccion | n/a (bridge) | |

## SuperAdmin / Soporte

| ID | Nombre | Ruta | Rol | Estado | Captura | Notas |
|---|---|---|---|---|---|---|
| SCR-SA-001 | Dashboard | `/dashboard` | SUPERADMIN | parcial | Captura pendiente — sin UI en repo | Acciones cliente/pedido/promo deshabilitadas |
| SCR-SA-002 | Farmacias | `/farmacias` | SUPERADMIN, SOPORTE | produccion | Captura pendiente — prioridad piloto | Import/Export disabled |
| SCR-SA-003 | Nueva farmacia | `/farmacias/nueva` | SUPERADMIN | produccion | Captura pendiente — sin UI en repo | |
| SCR-SA-004 | Ficha farmacia | `/farmacias/[id]` | SUPERADMIN, SOPORTE | parcial | Captura pendiente — sin UI en repo | Tabs Clientes/Actividad no ready; Contrato mock |
| SCR-SA-005 | Inventario kioskos | `/inventario-kioskos` | SUPERADMIN, SOPORTE | produccion | Captura pendiente — prioridad piloto | |
| SCR-SA-006 | Detalle activo KSK | `/inventario-kioskos/[assetId]` | SUPERADMIN, SOPORTE | produccion | Captura pendiente — sin UI en repo | |
| SCR-SA-007 | Pegatina activo | `/inventario-kioskos/[assetId]/pegatina` | SUPERADMIN, SOPORTE | produccion | Captura pendiente — sin UI en repo | |
| SCR-SA-008 | Resolver código KSK | `/inventario-kioskos/codigo/[assetCode]` | SUPERADMIN, SOPORTE | produccion | n/a (redirect) | |
| SCR-SA-009 | Catálogo maestro | `/catalogo` | SUPERADMIN | produccion | Captura pendiente — sin UI en repo | |
| SCR-SA-010 | Tarifas y simulador | `/tarifas` | SUPERADMIN | produccion | Captura pendiente — sin UI en repo | |
| SCR-SA-011 | Usuarios plataforma | `/usuarios` | SUPERADMIN | placeholder | Captura pendiente — stub | |
| SCR-SA-012 | Detalle usuario | `/usuarios/[id]` | SUPERADMIN | placeholder | Captura pendiente — stub | |
| SCR-SA-013 | Perfil | `/perfil` | SUPERADMIN, SOPORTE | parcial | Captura pendiente — sin UI en repo | |
| SCR-SA-014 | Clientes SA | `/clientes` | SUPERADMIN | placeholder | Captura pendiente — placeholder | Fase 2 |
| SCR-SA-015 | Pedidos SA | `/pedidos` | SUPERADMIN | placeholder | Captura pendiente — placeholder | Fase 2 |
| SCR-SA-016 | Promociones SA | `/promociones` | SUPERADMIN | placeholder | Captura pendiente — placeholder | Fase 2 |
| SCR-SA-017 | Contratos SA | `/contratos` | SUPERADMIN | placeholder | Captura pendiente — placeholder | Fase 4; WIP otra rama |
| SCR-SA-018 | Configuración SA | `/configuracion` | SUPERADMIN | placeholder | Captura pendiente — placeholder | |
| SCR-SA-019 | Ayuda | `/ayuda` | SUPERADMIN | placeholder | Captura pendiente — placeholder | |

**Nav Soporte (producción):** solo Farmacias + Inventario kioskos.

## Farmacia (`/f/[pharmacyId]/…`)

| ID | Nombre | Ruta | Rol | Estado | Captura | Notas |
|---|---|---|---|---|---|---|
| SCR-FAR-001 | Dashboard | `/f/[pharmacyId]/dashboard` | FARMACIA | produccion | Captura pendiente — prioridad piloto | |
| SCR-FAR-002 | Pedidos | `/f/[pharmacyId]/pedidos` | FARMACIA | produccion | Captura pendiente — prioridad piloto | |
| SCR-FAR-003 | Catálogo | `/f/[pharmacyId]/catalogo` | FARMACIA | produccion | Captura pendiente — prioridad piloto | Incluye import Excel |
| SCR-FAR-004 | Clientes | `/f/[pharmacyId]/clientes` | FARMACIA | placeholder | Captura pendiente — placeholder | |
| SCR-FAR-005 | Promociones | `/f/[pharmacyId]/promociones` | FARMACIA | placeholder | Captura pendiente — placeholder | |
| SCR-FAR-006 | Asistente IA | `/f/[pharmacyId]/asistente` | FARMACIA | produccion | Captura pendiente — sin UI en repo | Entitlement |
| SCR-FAR-007 | Consultas asistente | `/f/[pharmacyId]/asistente/consultas` | FARMACIA | produccion | Captura pendiente — sin UI en repo | |
| SCR-FAR-008 | Usuarios | `/f/[pharmacyId]/usuarios` | FARMACIA | produccion | Captura pendiente — sin UI en repo | Jerarquía OWNER/ADMIN |
| SCR-FAR-009 | Dispositivos kiosko | `/f/[pharmacyId]/dispositivos` | FARMACIA | produccion | Captura pendiente — prioridad piloto | Pairing |
| SCR-FAR-010 | Configuración | `/f/[pharmacyId]/configuracion` | FARMACIA | produccion | Captura pendiente — sin UI en repo | |

## Cliente

| ID | Nombre | Ruta | Rol | Estado | Captura | Notas |
|---|---|---|---|---|---|---|
| SCR-CLI-001 | Hub cuenta | `/cuenta` | CLIENTE | produccion | Captura pendiente — prioridad piloto | PWA |
| SCR-CLI-002 | Entrar | `/cuenta/entrar` | CLIENTE, AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-003 | Registro | `/cuenta/registro` | CLIENTE, AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-004 | Mis farmacias | `/cuenta/mis-farmacias` | CLIENTE | produccion | Captura pendiente — prioridad piloto | |
| SCR-CLI-005 | Cuenta en farmacia | `/e/[publicId]/cuenta` | CLIENTE | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-006 | Entrar (/e) | `/e/[publicId]/cuenta/entrar` | CLIENTE, AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-007 | Registro (/e) | `/e/[publicId]/cuenta/registro` | CLIENTE, AUTH | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-008 | Perfil | `/e/[publicId]/cuenta/perfil` | CLIENTE | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-009 | Direcciones | `/e/[publicId]/cuenta/direcciones` | CLIENTE | produccion | Captura pendiente — sin UI en repo | |
| SCR-CLI-010 | Mis pedidos | `/e/[publicId]/cuenta/pedidos` | CLIENTE | produccion | Captura pendiente — prioridad piloto | Solo vinculados |

## Público QR / presupuesto

| ID | Nombre | Ruta | Rol | Estado | Captura | Notas |
|---|---|---|---|---|---|---|
| SCR-PUB-001 | Home QR | `/e/[publicId]` | PUBLIC/QR | produccion | Captura pendiente — prioridad piloto | |
| SCR-PUB-002 | Catálogo QR | `/e/[publicId]/catalogo` | PUBLIC/QR, CLIENTE | produccion | Captura pendiente — prioridad piloto | Rediseño móvil: WIP otra rama |
| SCR-PUB-003 | Presupuesto | `/q/[token]` | PUBLIC/QR | produccion | Captura pendiente — sin UI en repo | |

## Kiosko

| ID | Nombre | Ruta | Rol | Estado | Captura | Notas |
|---|---|---|---|---|---|---|
| SCR-KSK-001 | Emparejar | `/k/pair` | KIOSKO | produccion | Captura pendiente — sin UI en repo | |
| SCR-KSK-002 | Inicio | `/k` | KIOSKO | produccion | Assets tiles: `capturas/kiosko/referencia-assets/` (no captura UI completa). Mockup NO usar: `capturas/kiosko/desarrollo/MOCKUP_…` | |
| SCR-KSK-003 | Catálogo | `/k/catalogo` | KIOSKO | produccion | Captura pendiente — sin UI en repo | |
| SCR-KSK-004 | Asistente | `/k/asistente` | KIOSKO | produccion | Captura pendiente — sin UI en repo | |
| SCR-KSK-005 | Carrito | `/k/carrito` | KIOSKO | produccion | Captura pendiente — sin UI en repo | Impresión vía bridge Android |

## Legal

| ID | Nombre | Ruta | Rol | Estado | Captura |
|---|---|---|---|---|---|
| SCR-LEG-001 | Privacidad | `/legal/privacidad` | PUBLIC | produccion | Captura pendiente — sin UI en repo |
| SCR-LEG-002 | Términos | `/legal/terminos` | PUBLIC | produccion | Captura pendiente — sin UI en repo |

---

## Funcionalidades no publicadas (no documentar como disponibles)

| ID lógico | Tema | Ubicación | Estado | Material |
|---|---|---|---|---|
| FUT-066 | Historial errores kiosko | worktree `kiosk-error-history` | no_publicado | — |
| FUT-068 | Compras a proveedores | worktree `kiosk-supplier-purchases` | no_publicado | — |
| FUT-069 | Contratos legales | worktree `commercial-contracts-v1` | no_publicado | PDF preview en ese WT (no copiado) |
| FUT-070 | Ciclo de vida directorio | worktree `pharmacy-lifecycle-directory` | no_publicado | — |
| FUT-CARTERA | CRM cartera | worktree plantilla import | no_publicado | — |
| FUT-AGENDA | Calendly / agenda | — | no_publicado | — |
| FUT-QR-UI | Rediseño grid catálogo QR | `FarmaFacil-App-qr-catalog-mobile` | no_publicado | — |
| FUT-ANDROID | App Android kiosko | `android-kiosk/` no en origin/main | no_publicado | `capturas/kiosko/desarrollo/FUT-ANDROID_diagnostico-usb.jpg` (**DESARROLLO**) |

---

## Conteos (2ª revisión)

| Métrica | Valor |
|---|---|
| Pantallas inventariadas | **62** |
| Captura UI producción incorporada | **0** |
| Asset producto referenciado (no UI) | **1** (SCR-KSK-002) |
| Material desarrollo/mockup archivado | **2** |
| Captura pendiente | **~57** (+ n/a redirects) |
| Casos de prueba (matriz) | **76** |

**URLs de referencia (no son capturas):**

- Producción: `https://app.farmafacil.solutions/login`
- Catálogo demo (si existe): `https://app.farmafacil.solutions/e/demo/catalogo`
