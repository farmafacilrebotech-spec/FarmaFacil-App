# Rollback 076 — platform suppliers + kiosk purchases

**No ejecutar en producción sin autorización.**

Orden sugerido (staging / local):

1. Eliminar políticas Storage `supplier_docs_*` y `kiosk_purchase_docs_*`.
2. `DELETE FROM storage.buckets WHERE id IN ('supplier-docs','kiosk-purchase-docs');` solo si vacíos.
3. `DROP FUNCTION` RPCs `ff_kiosk_purchase_*` / `ff_kiosk_po_*` creadas en 076.
4. Quitar `kiosk_assets.purchase_order_id` si se añadió solo aquí.
5. `DROP TABLE` en orden:
   - `platform_supplier_quote_documents`
   - `platform_supplier_quote_lines`
   - `platform_supplier_quotes`
   - `platform_supplier_activity`
   - `platform_supplier_contacts`
   - `kiosk_purchase_receipts`
   - `kiosk_purchase_order_documents`
   - `kiosk_purchase_order_costs`
   - `kiosk_purchase_orders`
   - `platform_suppliers`
6. Revocar `platform.suppliers.*` y `platform.kiosk_purchasing.*` de `platform_role_permissions` / `platform_permissions`.

Los datos de proveedores/presupuestos/compras se pierden con el DROP.
