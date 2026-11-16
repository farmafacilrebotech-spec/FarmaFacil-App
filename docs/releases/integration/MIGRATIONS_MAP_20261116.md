# Mapa oficial de migraciones — integration/farmafacil-release (2026-11-16)

Proyecto staging: `dazfdcjscnpfvhcyjddt`. **Producción no tocada.**

## Mecanismo de seguimiento

- No existe `supabase_migrations.schema_migrations` en staging.
- Existe `auth.schema_migrations` (GoTrue) y `public._ff_staging_recovery_log` (auditoría CLI).
- Estado real se valida por objetos (tablas/funciones/policies/triggers), no por numeración asumida.

## 089–099 (cola de integración)

| Migración | Objeto clave | Staging 2026-11-16 |
|-----------|--------------|--------------------|
| 089 launch seats events/commitment | `commercial_launch_seat_events`, `ff_release_launch_seat_v1` | Presente (objetos) |
| 090 email sends / mailbox | `email_sends`, claim send | Presente |
| 091 create pharmacy no auto trial | `ff_create_pharmacy_v1` | Presente |
| 092 launch seat expiry/extend | `commercial_launch_seat_settings` | Presente |
| 093 decouple assign plan | `ff_assign_commercial_plan_v1` | Presente |
| 094 holder self-reserve | holder policies / RPCs | Presente (revisar firmas) |
| 095 trial activate with plan | `ff_commercial_trial_activate_v1` | Verificar en smoke |
| 096 quote cancelled PDF docs | `commercial_quote_documents` | Presente |
| 097 commercial contracts | `commercial_contracts` | **Aplicada 2026-11-16** (recovery log) |
| 098 CLI branding/orders RLS | resolve/list/order_linked | **Ya presente** (CLI 2026-11-16; oficializada en repo) |
| 099 pharmacy identity SA-only | triggers logo/visible_name | **Ya presente** (triggers); oficializada en repo |

## Pedidos de regresión preservados

`#0029`, `#0033`, `#0034`, `#0035` — presentes en staging tras 097.

## Restauración

1. Dump schema/datos: AgentStores `integration-backups-20261116/staging/`.
2. Recovery log: `public._ff_staging_recovery_log`.
3. No usar scripts DOWN como único mecanismo.
