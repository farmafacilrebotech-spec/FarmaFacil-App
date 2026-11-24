# Rollback 091 — NO reabrir claim por teléfono

**Prohibido** restaurar el cuerpo de 064/071 con match por `customer_phone`.

Si hace falta “deshacer” el deploy de 091:

1. Mantener la función fail-closed (`status=disabled`).
2. Activar claim seguro por token (E2) antes de cualquier reopen.
3. Evidencia forense BEFORE: `docs/qa/share/backups/prod_claim_order_BEFORE_*` / staging equivalente — **solo lectura**.
