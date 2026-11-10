-- =============================================================================
-- 079_STAGING_REMEDIATE_chino_duplicates.sql
-- Remediación ONE-SHOT de staging: vincular extensión kiosk canónica al pedido
-- general y cancelar el duplicado histórico «Chino kiosk» / mismo presupuesto.
-- NO borrar filas. NO APLICAR en producción.
-- Requiere 079 ya aplicada.
-- =============================================================================

DO $$
DECLARE
  v_quote uuid := '5f266180-52de-45d2-8d5a-efd1dadbec96';
  v_general uuid := 'd6f4ea5a-c7b5-43ac-838d-ffa36424c70c';
  v_keep uuid := '89835205-ac34-4b1e-b5e7-f1542e163536'; -- más antiguo
  v_dup uuid := '1327f84b-d199-413b-a8ca-222880180c92';  -- duplicado
BEGIN
  -- Vincular el original al pedido económico
  UPDATE public.kiosk_purchase_orders
  SET
    general_purchase_order_id = v_general,
    source_quote_id = v_quote,
    updated_at = pg_catalog.now()
  WHERE id = v_keep
    AND status <> 'cancelado';

  -- Cancelar duplicado histórico (conservar fila)
  UPDATE public.kiosk_purchase_orders
  SET
    status = 'cancelado',
    source_quote_id = v_quote,
    notes = COALESCE(notes, '') || E'\n[079] Duplicado histórico cancelado; compra canónica = '
      || v_keep::text
      || ' / pedido económico = '
      || v_general::text,
    updated_at = pg_catalog.now()
  WHERE id = v_dup
    AND status <> 'cancelado';
END $$;
