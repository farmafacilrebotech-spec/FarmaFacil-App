# Rollback 077 — supplier quote/PO workflow

**No ejecutar en producción sin autorización.**

1. `DROP TABLE IF EXISTS public.platform_supplier_status_events;`
2. Revocar `platform.suppliers.approve` de role_permissions / permissions.
3. `DROP INDEX IF EXISTS platform_spo_active_quote_uidx;`
4. `DROP INDEX IF EXISTS platform_spo_client_request_uidx;`
5. `ALTER TABLE platform_supplier_purchase_orders DROP COLUMN IF EXISTS client_request_id;`
6. Restaurar check de status de quotes a 076 (sin `archivado`) solo si no hay filas `archivado`.
7. `ALTER TABLE platform_supplier_quotes DROP COLUMN IF EXISTS rejection_reason, rejected_by, rejected_at;`

Los documentos y pedidos existentes de 076 no se eliminan.
