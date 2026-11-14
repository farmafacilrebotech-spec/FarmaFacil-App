# Inventario de migraciones — Flujo comercial V1

**Fecha:** 13/11/2026  
**Worktree activo:** `.worktrees/launch-seats-manage` (`:3060`)  
**Staging project:** `dazfdcjscnpfvhcyjddt`  
**Producción:** no aplicar

## Números en juego (worktrees activos)

| Rango / ID | Origen | Estado |
|------------|--------|--------|
| ≤089 | launch-seats-manage (incluye emails 085–088 + plazas 089) | En rama comercial |
| **090** | emails-postprod `090_email_sends_mailbox_purposes_v1` | **RESERVADO Emails — no reutilizar** |
| 069 | commercial-contracts-v1 | **No** en staging (tabla ausente). FASE C |
| 083–084 | commercial-plans-activation / launch seats | Staging OK (plazas existen) |

## Asignación comercial (números libres)

| ID | Archivo | Dependencias | Rollback |
|----|---------|--------------|----------|
| **091** | `091_create_pharmacy_no_auto_trial_v1.sql` | 030/051 | Restaurar cuerpo 030 (trial 30d) — solo si hace falta |
| **092** | `092_launch_seat_expiry_extend_v1.sql` | 084, 089 | DROP cols/funcs nuevas; no borrar events |
| **093** | `093_decouple_assign_plan_from_launch_seat_v1.sql` | 084 assign | Reaplicar cuerpo assign de 084 (acoplado) |
| **094** | `094_launch_seat_holder_self_reserve_v1.sql` | 092 | DROP RPC titular + policies |
| **095** | `095_commercial_trial_activate_with_plan_v1.sql` | 050, 083 SKUs | DROP overload activate con plan |

## Staging — datos a revisar (no backfill silencioso)

Reservas `active` sin confirmación (2026-11-13): **2 filas**.  
Antes de asignar `expires_at` masivo: revisión SA (mantener / liberar / fijar caducidad explícita).

## Orden de aplicación en staging

1. 091 → 092 → 093 → 094 → 095  
2. Verificar RPCs y permisos  
3. FASE B UI  
4. FASE C: integrar 069 (contenido contracts) sin chocar con 090  

## Fuera de esta oleada

- Renumerar 069 → no necesario si 069 nunca se aplicó; al integrar, preferir **mantener nombre 069** solo si el historial de migraciones staging no lo tiene; si el runner exige secuencia, documentar como `096_commercial_contracts_from_069_v1.sql` wrapper que ejecuta el SQL 069.
