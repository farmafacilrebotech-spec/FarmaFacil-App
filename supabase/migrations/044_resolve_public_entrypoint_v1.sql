-- =============================================================================
-- 044_resolve_public_entrypoint_v1.sql
-- Resolución pública de QR (/e/{public_id}) sin service_role en la app.
--
-- 012: public_entrypoints no tiene policy anon; la app no debe depender de
-- SUPABASE_SERVICE_ROLE_KEY para una página pública.
--
-- Solo purpose = 'pharmacy_home' (DEFAULT 009; QR oficial 042).
-- Respuesta mínima: status, public_id, pharmacy_name.
-- No expone pharmacy_id ni internal_route.
-- SECURITY DEFINER: solo lectura; no regenera public_id ni modifica filas.
--
-- NO APLICAR automáticamente. Depende de: 006, 009.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_resolve_public_entrypoint_v1(
  p_public_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id text;
  v_ep public.public_entrypoints%ROWTYPE;
  v_pharmacy_name text;
BEGIN
  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id IS NULL OR v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- QR público de farmacia = pharmacy_home (otros purpose → not_found).
  SELECT *
  INTO v_ep
  FROM public.public_entrypoints pe
  WHERE pe.public_id = v_id
    AND pe.purpose = 'pharmacy_home'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_ep.is_active IS NOT TRUE
     OR (v_ep.expires_at IS NOT NULL AND v_ep.expires_at <= pg_catalog.now()) THEN
    RETURN jsonb_build_object('status', 'inactive');
  END IF;

  SELECT p.name
  INTO v_pharmacy_name
  FROM public.pharmacies p
  WHERE p.id = v_ep.pharmacy_id;

  IF v_pharmacy_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'public_id', v_ep.public_id,
    'pharmacy_name', v_pharmacy_name
  );
END;
$$;

COMMENT ON FUNCTION public.ff_resolve_public_entrypoint_v1(text) IS
  'Resuelve public_id pharmacy_home activo/no caducado para /e/{id}. Respuesta: status, public_id, pharmacy_name.';

REVOKE ALL ON FUNCTION public.ff_resolve_public_entrypoint_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_resolve_public_entrypoint_v1(text)
  TO anon, authenticated, service_role;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.ff_resolve_public_entrypoint_v1(text);
