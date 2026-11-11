# Rollback 080 — numeración anual de pedidos

Solo en staging / con autorización. No elimina pedidos ni números ya asignados
(conserva integridad histórica).

```sql
DROP TRIGGER IF EXISTS trg_platform_spo_protect_order_number
  ON public.platform_supplier_purchase_orders;

DROP FUNCTION IF EXISTS public.ff_supplier_po_protect_order_number_v1();
DROP FUNCTION IF EXISTS public.ff_supplier_po_confirm_v1(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS public.ff_supplier_po_next_number_v1(integer);

DROP INDEX IF EXISTS public.platform_spo_order_number_uidx;

DROP TABLE IF EXISTS public.platform_supplier_po_year_counters;
```

Notas:
- Los `order_number` ya escritos en `platform_supplier_purchase_orders` /
  `kiosk_purchase_orders` **no** se borran con este rollback.
- Tras el rollback, la app no podrá confirmar con número correlativo hasta
  reaplicar 080.
