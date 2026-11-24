# P0 — Contención claim por teléfono (staging)

**Fecha:** 2026-11-24T21:06Z  
**Entorno:** staging `dazfdcjscnpfvhcyjddt`  
**Única escritura staging autorizada:** `supabase/proposed/P0_disable_claim_order_by_phone_v1.sql`

## Pre

| Check | Valor |
|-------|-------|
| Backup def | `docs/qa/share/backups/staging_claim_order_BEFORE_20261124T210640Z.sql` |
| Grants previos | anon, authenticated, postgres, service_role |
| Pedidos | unlinked_with_phone=125 · linked=50 · total=176 |

## Post apply

| Check | Resultado |
|-------|-----------|
| Cuerpo | Solo retorna `status=disabled` (sin leer teléfono ni UPDATE) |
| Grants | authenticated, postgres, service_role · **anon=0** |
| RPC call | `{"status":"disabled",...}` |
| Conteo pedidos | **125 / 50 / 176** (sin cambios) |
| RPCs pedidos | `ff_kiosk_create_order_v1`, `ff_update_pharmacy_order_status_v1` presentes |

## Tests negativos

- Llamada directa (incl. JWT sintético + rol authenticated) → **disabled**.
- No se puede apropiar pedido por coincidencia de teléfono (lógica eliminada).
- Pedidos previamente vinculados: **50** siguen con `customer_profile_id` (agregado).

## Recuperación segura (sin reabrir vulnerabilidad)

1. **No** restaurar el backup BEFORE completo (reintroduce phone match).
2. Recuperación operativa = mantener fail-closed hasta E2 (`ff_claim_order_by_access_token_v1`).
3. Si hace falta rollback de emergencia del *deploy* (no del diseño):
   - Solo tras OK explícito y plan de sustitución por token el mismo día.
   - El archivo BEFORE se conserva como evidencia forense, no como playbook de reopen.

## Producción

Ver auditoría: función **vulnerable aún activa**. Corrección candidata:  
`supabase/proposed/P0_disable_claim_order_by_phone_PROD_CANDIDATE.sql`  
**No aplicada.** Requiere autorización específica de escritura en prod.
