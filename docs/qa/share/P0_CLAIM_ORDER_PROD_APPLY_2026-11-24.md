# P0 — Contención claim por teléfono (producción)

**Fecha apply:** 2026-11-24T21:19Z  
**Proyecto:** `gsnohwsvjxpjfcsstnfd` (distinto de staging `dazfdcj…`)  
**SQL:** `supabase/proposed/P0_disable_claim_order_by_phone_PROD_CANDIDATE.sql`  
**Única escritura prod autorizada.**

## Pre

| Check | Valor |
|-------|-------|
| Bodies prod-candidate ≡ staging SQL | **iguales** |
| Backup def | `backups/prod_claim_order_BEFORE_20261124T211917Z.sql` |
| Grants | authenticated, postgres, service_role (anon=0 ya) |
| Dependientes | ninguno |
| Pedidos | unlinked_phone=6 · linked=1 · total=26 |
| Cuerpo previo | phone match / `phone_mismatch` (vulnerable) |

## Post

| Check | Resultado |
|-------|-----------|
| Cuerpo | Solo `status=disabled` |
| mentions phone/mismatch | **false** |
| RPC | `{"status":"disabled",...}` |
| anon EXECUTE | **0** |
| Invariantes pedidos | **6 / 1 / 26** (sin cambio) |
| RPCs create/status | presentes |

## Recuperación

**No** restaurar BEFORE. Mantener fail-closed hasta claim por token (E2).  
Migración de código: `091_p0_disable_customer_claim_order_by_phone_v1.sql` (impide reactivación en deploys futuros).
