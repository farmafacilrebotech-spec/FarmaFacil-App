-- CANDIDATO PROD — audit 2026-11-24: función VULNERABLE (phone match) activa.
-- unlinked_with_phone=6 linked=1 total=26 · anon sin EXECUTE.
-- REQUIERE autorización explícita de escritura en producción.
-- =============================================================================
-- P0 CONTENCIÓN — Deshabilitar claim por teléfono (NO APLICAR EN PRODUCCIÓN sin autorización específica adicional)
-- Staging primero; prod solo tras audit + OK explícito.
-- No es migración de catálogo 089/090.
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

REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_customer_claim_order_v1(uuid)
  TO authenticated, service_role;
