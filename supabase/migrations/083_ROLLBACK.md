# 083 — rollback notes (manual)

No ejecutar en producción sin autorización.

1. Restaurar tarifa current anterior (`previous_tariff_id` en snapshot de `v2-list-2027`).
2. Opcional: restaurar `ff_commercial_sku_effects_v1` desde draft 056 (mapa starter/pro/business).
3. No borrar `plans` comerciales si alguna farmacia/subscription ya los usa.
4. `commercial_launch_cohort_counters` se puede dropear si no hay consumidores.

083 no reescribe farmacias legacy; el rollback no debe tocar `subscriptions` existentes salvo filas de prueba.
