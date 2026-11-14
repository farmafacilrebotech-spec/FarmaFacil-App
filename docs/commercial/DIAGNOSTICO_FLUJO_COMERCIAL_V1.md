# Diagnóstico — Flujo comercial, piloto, plazas, contrato y suscripción

**Fecha:** 13/11/2026  
**Actualizado:** 13/11/2026 — **decisiones aprobadas** (implementación FASE A en curso)  
**Worktree:** `.worktrees/launch-seats-manage` · rama `feature/launch-seats-manage` · preview `:3060`  
**Contratos 069:** `.worktrees/commercial-contracts-v1` (integración controlada; **no** en staging aún)  
**Emails:** `:3065` / `090` — **no interferir**  
**Producción:** no tocar · no merge a `main` sin aprobación expresa

---

## 0. Decisiones aprobadas (13/11/2026)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Alta | **Sin trial automático** (ni 30d legacy ni 15d). Farmacia `pending_setup`, pendiente de activación comercial. SA Total activa expresamente piloto 15d (plan G/P/IA) o contratación directa. Separar estado operativo ≠ comercial. No alterar trials/subs existentes. |
| 2 | Reserva promo | **15 días naturales** por defecto; `expires_at` obligatorio en nuevas; duración configurable; ampliar/liberar solo SA Total (motivo obligatorio); caducidad automática si no confirmada; historial completo; **no** tocar piloto/plan/sub al reservar/ampliar/liberar. Avisos 5d / 2d / día vencimiento **preparados** (sin emails automáticos). Reservas staging existentes: **revisión manual** antes de caducidad (no backfill silencioso). |
| 3 | Confirmación | Solo SA Total tras formalización contractual válida. Distinguir: solicitud → contrato en prep → formalizado → plaza confirmada → sub pendiente inicio → sub activa. Confirmación ≠ inicio facturación. Sin firma/emisión jurídica: no confirmar con borradores/ficticios; staging solo con **fixtures identificados**. Confirmada irreversible (proteger 089). Cancelar/suspender sub **no** libera plaza confirmada. |
| 4 | Reserva titular | Titular autorizado reserva plaza disponible desde sección contractual (sin OK previo SA). Verifica identidad, elegibilidad, plan promo, condiciones/caducidad, disponibilidad transaccional, anti-duplicado, autor/fecha, notificación interna SA. Titular: consultar + solicitar contratación. **No** liberar/ampliar/confirmar/modificar. Empleados sin acceso. Permisos backend + RLS + DB. |
| 5 | Migraciones | Inventario previo. **No reutilizar 090** (Emails). Números libres **091+**. No renumerar aplicadas. Solo staging. Rollback documentado. |
| 6 | Contratos 069 | Incorporar a staging en FASE C, integración controlada. Reutilizar worktree; no duplicar. Mantener bloqueos: emisión definitiva, firma, envío definitivo, formalización real. Borradores OK. Sin datos societarios definitivos. |
| 7 | Simulador | PR independiente (FASE D). `engine.ts` única fuente. Proyección 2027 (−60 %) / 2028 (−30 %) / 2029+ (0 %). Kiosko sin dto SaaS; prepago anual; IVA; totales; ahorro. Word/PDF. Selección promo **no** reserva plaza. |
| 8 | Orden | A modelo/migraciones → B UI → C 069 → D simulador → E pruebas integrales |
| 9 | Restricciones | Solo staging · `:3060` · no `:3065` · no emails reales · no prod · no main sin OK |

---

## 1. Veredicto (pre-aprobación)

El sistema **sí tiene piezas separables** (trials, plazas, subscriptions, quotes, contracts draft), pero la **UI SuperAdmin y varias RPCs las acoplan**.  

Riesgo principal histórico: `ff_assign_commercial_plan_v1` con `p_use_launch_promo` **asignaba plan + reservaba plaza + cancelaba piloto** en un acto → FASE A lo desacopla (migración `093`).

---

## 2. Inventario del modelo actual (referencia)

### A. Farmacia (alta / estado operativo)

| Elemento | Ubicación |
|----------|-----------|
| Tabla | `pharmacies` (`status`: pending_setup, active, suspended, archived, …) |
| Alta legacy | `ff_create_pharmacy_v1` — `016` / `030` (**trialing 30d**) |
| Alta piloto prep | `ff_create_pharmacy_commercial_prep_v1` — `051` (sin sub; trial `ready`) |
| UI SA | `/farmacias/nueva`, ficha `/farmacias/[id]` |

**Objetivo FASE A:** neutralizar trial 30d en `ff_create_pharmacy_v1` (`091`); alta limpia = configuración sin reloj comercial.

### B. Piloto comercial 15 días

| Elemento | Ubicación |
|----------|-----------|
| Tabla | `pharmacy_commercial_trials` (`049`) |
| RPCs | `050` prepare / activate / extend / end / readiness |
| Permiso | `platform.commercial_trials.manage` |

**Objetivo:** activate con **plan de prueba explícito** G/P/IA (`095`).

### C. Plaza promocional lanzamiento 2027

| Elemento | Ubicación |
|----------|-----------|
| Contador | `commercial_launch_cohort_counters` (`084`) — máx. 20 |
| Reservas | `commercial_launch_seat_reservations` (`084` + `089`) |
| Eventos | `commercial_launch_seat_events` (`089`) |
| RPCs | reserve / release / confirm |

**Staging (13/11):** 2 reservas `active` sin `confirmed_at` — **revisar antes de asignar `expires_at`**.

### D. Contrato 069

En worktree `commercial-contracts-v1`. **No** en staging (`commercial_contracts` 404). Emisión/firma ya bloqueadas en docs legales del worktree. FASE C.

### E–F. Suscripción / simulador

Sin cambio de dominio en FASE A. Simulador multi-año → FASE D / PR aparte.

---

## 3. Modelo objetivo (5 dominios) — APROBADO

| Dominio | Fuente | Mutadores |
|---------|--------|-----------|
| **A. Farmacia** | `pharmacies.status` | Alta limpia; sin piloto ni plaza |
| **B. Piloto** | `pharmacy_commercial_trials` + plan prueba | Solo SA: activar (G/P/IA), ampliar, historial |
| **C. Plaza** | reservations + events | Reservar (SA/titular) / ampliar / liberar / caducar / confirmar |
| **D. Contrato** | `commercial_contracts` (069) | Borrador; firma bloqueada |
| **E. Suscripción** | `subscriptions` | Assign/transition; no libera plaza confirmada |

### Pipeline comercial (estados)

1. Solicitud de contratación  
2. Contrato en preparación  
3. Contrato formalizado  
4. Plaza confirmada  
5. Suscripción pendiente de inicio  
6. Suscripción activa  

---

## 4. Migraciones — inventario y numeración

Ver `docs/commercial/MIGRACIONES_INVENTARIO_V1.md`.

| ID | Fase | Contenido |
|----|------|-----------|
| **090** | Emails | **RESERVADO** — no usar en comercial |
| **091** | A | Alta sin trial 30d (`ff_create_pharmacy_v1`) |
| **092** | A | Plaza: `expires_at`, `expired`, ampliar, caducar idempotente, config 15d, stubs avisos |
| **093** | A | Desacoplar assign ↔ reserva/cancel-trial automático por promo |
| **094** | A | Reserva titular + permisos RLS/RPC + notificación interna |
| **095** | A | Activate piloto con plan comercial explícito |
| **069→C** | C | Copiar/aplicar contratos desde worktree (contenido 069; orden tras inventario staging) |
| App / PR | D | Proyección `engine.ts` + Word/PDF |

---

## 5. Orden de implementación (aprobado)

- **FASE A** — Modelo + migraciones 091–095 + permisos (en curso)  
- **FASE B** — UI ficha SA / contratos / titular / historiales  
- **FASE C** — Contratos 069 controlados  
- **FASE D** — Simulador 2027–2029 (PR independiente)  
- **FASE E** — Pruebas integrales (concurrencia 20 plazas, permisos, importes)

---

## 6. Fuera de alcance / bloqueado

- Cron caducidad en **producción**  
- Emails automáticos de aviso (solo hooks preparados)  
- Emisión/firma/formalización jurídica real  
- Merge `main` / deploy prod  
- Alterar datos prod o plazas confirmadas  
- Interferir Emails `:3065`
