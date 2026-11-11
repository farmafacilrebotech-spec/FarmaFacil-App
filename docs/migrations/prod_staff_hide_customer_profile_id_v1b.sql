-- =============================================================================
-- PRODUCCIÓN — complemento staff_hide v1b (REVOKE tabla + GRANT columnas)
-- Proyecto: gsnohwsvjxpjfcsstnfd
-- Equivalente a staging_staff_hide_customer_profile_id_v1b.sql
-- NO aplicar sin autorización explícita de publish PR #23.
-- =============================================================================

BEGIN;

REVOKE SELECT ON public.pharmacy_orders FROM authenticated;
REVOKE SELECT ON public.pharmacy_orders FROM anon;

-- Columnas operativas de pedidos (incluye contacto del pedido; excluye vínculo de cuenta)
GRANT SELECT (
  id,
  pharmacy_id,
  order_number,
  display_number,
  source,
  device_id,
  device_session_id,
  status,
  payment_status,
  total_amount,
  currency,
  client_request_id,
  created_by_profile_id,
  status_changed_at,
  status_changed_by,
  payment_changed_at,
  payment_changed_by,
  created_at,
  updated_at,
  customer_name,
  customer_phone,
  privacy_accepted_at,
  customer_note,
  amount_confirmed_at,
  amount_confirmed_by,
  lines_valued_at,
  lines_valued_by,
  customer_accepted_at,
  customer_accepted_by,
  quote_legacy_total_only,
  quote_version,
  quote_expires_at,
  customer_rejected_at
) ON public.pharmacy_orders TO authenticated, anon;

-- service_role / postgres conservan acceso pleno vía grants de tabla existentes
GRANT SELECT ON public.pharmacy_orders TO service_role;


COMMIT;
