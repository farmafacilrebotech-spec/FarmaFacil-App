# FarmaFácil — Hoja de ruta Fase 1 (seguimiento)

**Base:** `main` = `9a445dd` (PR #24 publicada).  
**Actualizado:** 2026-11-12  
**Fase 2 (fuera de alcance):** pagos, TPV, Bizum, facturación avanzada, conciliación.

## Orden aprobado

| # | Módulo | Estado | Rama prevista | Migraciones | Dependencias |
|---|--------|--------|---------------|-------------|--------------|
| 1 | Emails corporativos Fase B | **En curso** | `feature/emails-phase-b-send` | `075` (ya en STG/PROD) + `085` Fase B | Resend, SA `platform.emails.*` |
| 2 | Asistente por niveles de plan | Pendiente | `feature/assistant-plan-tiers-…` | nueva serie post-085 | PR #24 plans/entitlements; OpenAI |
| 3 | Cartera comercial de farmacias | Pendiente | `feature/pharmacy-portfolio-…` | nueva serie | rol Comercial; import Excel; Sheets después |
| 4 | Promociones comerciales reutilizables y reservas | Registrado / no implementar | TBD | TBD | `launch_2027` contador 084; cartera |
| 5 | Contratos documentales | Registrado / no implementar | recuperar worktree `069` | `069` + evoluciones | presupuestos; Storage privado |
| 6 | Pulido interfaz y gestión comercial | Registrado / no implementar | TBD | — | UI farmacias/planes |
| 7 | Centro de ayuda y manuales | Registrado / no implementar | TBD | — | docs existentes |

## Pendientes adicionales (no implementar aún)

### A. Promociones comerciales
- Promociones reutilizables en presupuestos y contratos.
- Integrar `launch_2027` sin duplicar contador.
- Diferenciar plazas reservadas / confirmadas / liberadas; liberar provisionales.
- Vincular reservas futuras a cartera comercial.

### B. Contratos
- Recuperar desarrollo worktree `069` / `feature/commercial-contracts-v1`.
- Generación desde presupuestos; Storage privado de firmados.
- Snapshots de condiciones económicas y promociones.
- Plantilla factura recurrente (sin sistema de facturación).
- Listado Contratos → pestaña Contrato de la farmacia.
- Emisión definitiva bloqueada hasta aprobación jurídica.

### C. Pulido
- Ocultar planes legacy del selector comercial.
- Traducir estados; eliminar jerga técnica.
- Logos en listado de farmacias.
- Estados `pending_setup` / activación pilotos.
- Revisar Configuración y Centro de ayuda.

## Reservas de numeración de migraciones

| Rango | Uso |
|-------|-----|
| `075` | Emails Fase A drafts/outbox (aplicada STG+PROD) |
| `076`–`084` | Proveedores/inventario + planes comerciales (main) |
| **`085`** | **Emails Fase B** (send/consent/attachments) — esta rama |
| `086+` | Reservar por módulo en ramas independientes (asistente, cartera, promo, contratos) |

## Política

- Sin SQL producción salvo autorización explícita por módulo.
- Sin merge/deploy sin GO y autorización.
- Sin correos reales / masivos en Emails hasta autorización.
- Pagos = Fase 2.
