-- =============================================================================
-- 091 — P0: deshabilitar claim de pedido por coincidencia de teléfono
-- =============================================================================
-- Sustituye ff_customer_claim_order_v1 (064/071) por fail-closed.
-- Staging + prod ya contenidas vía proposed SQL (2026-11-24); esta migración
-- garantiza que db reset / entornos nuevos / futuros applies NO reintroducen
-- el match por teléfono.
--
-- NO restaurar la implementación insegura como rollback.
-- Recuperación operativa = mantener disabled hasta claim por access token (E2).
-- =============================================================================

REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.ff_customer_claim_order_v1(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'disabled',
    'message', 'Claim por teléfono deshabilitado. Use el enlace seguro del ticket.'
  );
END;
$$;

COMMENT ON FUNCTION public.ff_customer_claim_order_v1(uuid) IS
  '091/P0: fail-closed. No vincula por teléfono. Sustituido por token claim (E2) cuando exista.';

REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_customer_claim_order_v1(uuid)
  TO authenticated, service_role;
