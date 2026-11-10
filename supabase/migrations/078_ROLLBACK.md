# Rollback 078 — shipping_includes_vat

**No ejecutar en producción sin autorización.**

```sql
ALTER TABLE public.platform_supplier_purchase_orders
  DROP COLUMN IF EXISTS shipping_includes_vat;
```
