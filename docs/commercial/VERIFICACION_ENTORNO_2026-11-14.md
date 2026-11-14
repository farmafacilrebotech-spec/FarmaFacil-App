# Verificación previa — entorno comercial (14/11/2026)

## Preview

| Puerto | Worktree | Rama | Commit servido |
|--------|----------|------|----------------|
| **:3060** | `.worktrees/launch-seats-manage` | `feature/launch-seats-manage` | `3c6ac70` (plazas 2027) + cambios locales FASE A |
| **:3065** | `.worktrees/emails-postprod` | `fix/emails-postprod-signatures-sent` | Emails — **no interferir** |

## Staging Supabase (`dazfdcjscnpfvhcyjddt`)

| Pieza | Estado |
|-------|--------|
| Plazas 084 + eventos 089 | **Aplicado** |
| Assign `ff_assign_commercial_plan_v1` (083/084) | **Presente** en staging |
| Migraciones FASE A **091–095** | **NO aplicadas** (settings 092 404; `trial_plan_sku` 095 ausente) |
| Contratos 069 | **NO** en staging |

## UI «migración 056» (corregido 2026-11-14)

Corregido en `pharmacy-onboarding.ts` / `plan-assignment-panel.tsx`: farmacia por nombre + `ff_assign_commercial_plan_v1`. Migraciones **091–096 aplicadas** en staging.

## Decisión técnica

1. No reaplicar 056.  
2. UI → `ff_assign_commercial_plan_v1` (083).  
3. Aplicar 091–095 en staging de forma controlada.  
4. Simulador / PDF / labels en app (sin duplicar motor).  
5. Emails :3065 intacto; integración presupuesto→email en fase posterior coordinada.
