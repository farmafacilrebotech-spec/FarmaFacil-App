# Activación comercial completa — GO/NO-GO (publicación)

**Fecha:** 2026-11-11  
**Rama:** `feature/commercial-plans-activation` (desde `main` @ `a61ff31`)  
**Staging:** `dazfdcjscnpfvhcyjddt` — 083 + 084 aplicados y smoke OK  
**Producción:** sin SQL, sin merge, sin deploy

---

## Veredicto

**GO CONDICIONAL a publicación** cuando autorices, tras checks Vercel verdes del tip de la rama.

Bloqueo previo (UI → 017 incompleto) **resuelto** en esta rama:
- SuperAdmin asigna General/Personalizado/IA vía `ff_assign_commercial_plan_v1`
- `ff_change_pharmacy_plan_v1` **rechaza** keys comerciales
- Plazas launch_2027 atómicas (máx. 20), sin doble consumo por farmacia
- Plan técnico ≠ tarifa lista ≠ promo ≠ −15 % anual

**NO-GO** si se intenta publicar solo SQL sin el código de esta rama (o al revés).

---

## Migraciones (orden exacto en prod)

| Orden | Archivo | Qué hace | ¿056 draft? |
|-------|---------|----------|-------------|
| 1 | `083_00_ff_assign_commercial_plan_from_056_v1.sql` | Promueve draft 056 (tabla assignments + RPC assign). Idempotente. | **Sustituye** aplicar el draft a mano |
| 2 | `083_commercial_plans_activation_v1.sql` | Plans `general`/`personalizado`/`asistente_ia_personalizado`, mapa SKU, tarifa lista `v2-list-2027`, contador plazas | Requiere assign RPC |
| 3 | `084_commercial_assign_guard_launch_seats_v1.sql` | Guard 017, reservas/liberación plazas, assign con `p_use_launch_promo` | Requiere 083 |

**Draft 056 en prod:** no hace falta el archivo de `drafts/` si se aplica `083_00`. En staging 056 ya estaba; `083_00` es no-op seguro + alinea mapa a planes 083.

**No aplicar:** seeds staging, backfill de farmacias, 079_STAGING_REMEDIATE.

---

## Comportamiento plazas 2027

| Evento | Efecto |
|--------|--------|
| Assign con `p_use_launch_promo=true` | Reserva atómica (FOR UPDATE contador); 39/69/99 € documentados; lista 97,50/172,50/247,50 intacta |
| Misma farmacia repite promo | Idempotente (no consume 2ª plaza) |
| Cambio de plan con promo | Actualiza SKU en la misma reserva |
| Assign sin promo o a piloto | Libera plaza activa (`released`) y decrementa contador |
| Agotar 20 | `launch_slots_exhausted` — se puede asignar a tarifa normal |
| Cancelación módulo kiosko | No afecta plazas SaaS (add-on distinto) |

Prepago anual −15 %: `saas_annual_discount_bps=1500` en tarifa lista; no altera monthly lista ni promo.

---

## Código UI / app

- `changePharmacyPlanAction` → comerciales a assign RPC; legacy a 017
- Diálogo: solo asignables; precios lista/promo; plazas; confirmación; checkbox promo
- Textos kiosko: «Iniciar prueba gratuita», «Activar servicio Kiosko», «Suspender servicio» (sin cambiar lógica)

---

## Pruebas staging realizadas

| Prueba | Resultado |
|--------|-----------|
| 017 rechaza `general` (SA auth) | PASS |
| Assign General + promo | PASS (`technical_plan_key=general`) |
| Re-assign promo misma farmacia | PASS (idempotente) |
| Assign Personalizado tarifa lista | PASS |
| Assign IA + promo | PASS |
| Cambio General→Personalizado con promo | PASS |
| Farmacias/subs legacy sin cambios | PASS |
| Concurrencia 8 reservas paralelas | PASS (delta contador = éxitos, ≤20) |
| Cleanup ficticias | PASS |
| Unit `plan-catalog-mode` / labels / simulator | (ver log build) |
| `tsc` + `npm run build` | (ver log) |

SQL producción: **no ejecutado**. Merge/deploy: **no**.

---

## Pasos exactos para publicar (cuando autorices)

1. Push rama `feature/commercial-plans-activation` y abrir PR a `main`.
2. Esperar Vercel Preview + checks verdes.
3. Preflight RO prod: ¿existe `ff_assign_commercial_plan_v1`? ¿existen `plans.general`? (solo lectura).
4. Backup/PITR prod.
5. SQL prod **en orden**: `083_00` → verify → `083` → verify → `084` → verify.  
   Verify mínimo:
   - `ff_change_pharmacy_plan_v1(...,'general')` falla con `commercial_plan_requires_assign_rpc`
   - `plans` tiene general/personalizado/asistente_ia_personalizado
   - tarifa current `v2-list-2027` con 9750/17250/24750
   - contador `launch_2027` max=20
   - **cero** cambios en `pharmacies.plan_id` / `subscriptions` existentes tras el DDL
6. Merge PR → verificar Vercel Production Ready en el commit de merge.
7. Smoke SA: abrir Cambiar plan (sin confirmar) en farmacia de prueba; opcional assign controlado a farmacia ficticia/nueva.
8. No migrar legacy en masa. No habilitar promo sin entender plazas restantes.

### Rollback

- Código: revert merge.
- SQL: restaurar tarifa previous; DROP/restore funciones desde backups; **no** borrar plans comerciales si ya hay assignments. Plazas: marcar `released` / reconciliar contador.

---

## Pendientes menores (no bloquean GO técnico)

- Panel Tarifas: actualizar copy “draft 056” → RPC disponible.
- Espejo TS `commercial-plan-assign.ts` ya en rama; tests dedicados de pricing helpers opcionales.
- Reassign opt-in de assignment staging `general|starter` (histórico pre-083).
