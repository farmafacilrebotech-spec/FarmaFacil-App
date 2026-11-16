-- =============================================================================
-- staging_public_entrypoint_logo_url_v1.sql
-- Extiende ff_resolve_public_entrypoint_v1 para devolver logo_url público
-- (pharmacy_branding) sin exponer pharmacy_id.
-- Solo staging. No aplica políticas RLS nuevas.
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
  v_logo_url text;
BEGIN
  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id IS NULL OR v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

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

  SELECT nullif(btrim(pb.logo_url), '')
  INTO v_logo_url
  FROM public.pharmacy_branding pb
  WHERE pb.pharmacy_id = v_ep.pharmacy_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'public_id', v_ep.public_id,
    'pharmacy_name', v_pharmacy_name,
    'logo_url', v_logo_url
  );
END;
$$;

COMMENT ON FUNCTION public.ff_resolve_public_entrypoint_v1(text) IS
  'Resuelve public_id pharmacy_home. Respuesta: status, public_id, pharmacy_name, logo_url opcional.';
