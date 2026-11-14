# FASE A — Entrega (modelo comercial + migraciones)

**Fecha:** 13/11/2026  
**Worktree:** `.worktrees/launch-seats-manage` · `:3060`  
**Emails `:3065`:** no tocado · **Producción:** no aplicar

## Decisiones técnicas

1. **090 reservado Emails** → comerciales en **091–095**.
2. Alta limpia: `ff_create_pharmacy_v1` sin subscription (091). Prep piloto (`051`) sigue preparando trial `ready` sin reloj.
3. Plazas: caducidad 15d naturales en **nuevas** reservas; filas staging existentes **sin** `expires_at` hasta revisión manual.
4. Assign (`093`) ya no reserva/libera plaza; `useLaunchPromo` bloqueado en UI+RPC.
5. Confirmación (`092`) exige fixture `[STAGING_FIXTURE]` mientras 069/firma estén bloqueados.
6. Titular: RPC `ff_holder_reserve_launch_2027_seat_v1` + policies SELECT (094).
7. Activate piloto exige plan G/P/IA (095).

## Migraciones creadas

| Archivo | Estado aplicación staging |
|---------|---------------------------|
| `091_create_pharmacy_no_auto_trial_v1.sql` | Pendiente aplicar |
| `092_launch_seat_expiry_extend_v1.sql` | Pendiente aplicar |
| `093_decouple_assign_plan_from_launch_seat_v1.sql` | Pendiente aplicar |
| `094_launch_seat_holder_self_reserve_v1.sql` | Pendiente aplicar |
| `095_commercial_trial_activate_with_plan_v1.sql` | Pendiente aplicar |

Orden: 091 → 092 → 093 → 094 → 095.

## Reservas staging a revisar (antes de caducidad)

Consulta (lectura):

```sql
SELECT r.id, r.pharmacy_id, p.name, r.status, r.commercial_sku_key,
       r.reserved_at, r.expires_at, r.confirmed_at
FROM commercial_launch_seat_reservations r
JOIN pharmacies p ON p.id = r.pharmacy_id
WHERE r.cohort_key = 'launch_2027' AND r.status = 'active'
ORDER BY r.reserved_at;
```

A 13/11 había **2** activas sin confirmación. Decidir por fila: liberar / fijar `expires_at` / confirmar con fixture.

## App (parcial FASE A)

- `activateCommercialTrialAction(pharmacyId, trialPlanSku)`
- `changePharmacyPlanAction` bloquea `useLaunchPromo`
- Actions: `extendLaunchSeatAction`, `confirmLaunchSeatAction`, `holderReserveLaunchSeatAction`
- Tipos plaza: `expiresAt`, `expired`, `canExtend`

## Pendiente FASE B

- UI ficha: bloques separados piloto / plaza / contrato / suscripción
- Selector plan al activar piloto
- Titular: sección contractual
- Contadores caducidad / ampliar en `/contratos`

## Pruebas mínimas post-aplicación staging

1. Alta limpia → sin subscription trialing  
2. Prep piloto → activate con `general` → 15d  
3. Assign plan **sin** plaza; reservar plaza aparte → `expires_at`  
4. Titular reserva; empleado denegado  
5. Ampliar / liberar con motivo; confirmada no liberable  
6. Confirmación sin fixture → error  
7. Concurrencia: 20ª plaza OK, 21ª `launch_slots_exhausted`

## Incidencias

- Migraciones **preparadas** en rama; aplicación staging pendiente de ejecución controlada (no prod).
- 069 contracts aún ausente en staging → FASE C.
- Simulador multi-año → FASE D / PR independiente.
