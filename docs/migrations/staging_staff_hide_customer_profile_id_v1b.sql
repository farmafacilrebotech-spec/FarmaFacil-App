-- =============================================================================
-- STAGING ONLY — complemento v1b
-- Con GRANT SELECT de tabla, REVOKE de una columna NO oculta el acceso.
-- Solución: REVOKE SELECT de tabla + GRANT SELECT de columnas operativas
-- (sin customer_profile_id) a authenticated/anon.
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

INSERT INTO public._ff_staging_recovery_log (label, detail)
VALUES (
  'staff_hide_customer_profile_id_v1b',
  jsonb_build_object(
    'method', 'table_revoke_plus_column_grants',
    'excluded', 'customer_profile_id'
  )
);

COMMIT;
