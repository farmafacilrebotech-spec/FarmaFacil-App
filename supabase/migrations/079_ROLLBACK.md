# Rollback 079 — unificación pedido general ↔ extensión kiosk

**No ejecutar en producción sin autorización.**

```sql
DROP INDEX IF EXISTS public.kiosk_po_source_quote_idx;
DROP INDEX IF EXISTS public.kiosk_po_general_idx;
DROP INDEX IF EXISTS public.kiosk_po_active_quote_uidx;
DROP INDEX IF EXISTS public.kiosk_po_active_general_uidx;

ALTER TABLE public.kiosk_purchase_orders
  DROP COLUMN IF EXISTS source_quote_id;

ALTER TABLE public.kiosk_purchase_orders
  DROP COLUMN IF EXISTS general_purchase_order_id;
```

Los pedidos generales, documentos, recepciones y filas `kiosk_purchase_orders` existentes **no se eliminan**.
Si se canceló un duplicado histórico en staging, su estado `cancelado` permanece (reversible con UPDATE manual).
