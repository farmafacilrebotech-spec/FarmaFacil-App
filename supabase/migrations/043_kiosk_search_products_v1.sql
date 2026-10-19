-- =============================================================================
-- 043_kiosk_search_products_v1.sql
-- Catálogo de lectura para el kiosko (sesión de dispositivo).
--
-- Justificación: pharmacy_products solo concede SELECT a authenticated (020).
-- El runtime /k es anon + cookie de dispositivo; necesita DEFINER acotado
-- a la farmacia de la sesión (mismo patrón que 040/041).
--
-- NO modifica RPCs existentes. NO crea tablas.
-- Solo productos is_active=true de ESA farmacia.
-- No hay columna de receta en el esquema: el catálogo 020 es para
-- parafarmacia/OTC; no se inventa un filtro Rx aquí.
--
-- NO APLICAR automáticamente. Depende de: 020, 034, 036.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_kiosk_search_products_v1(
  p_credential_hash text,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
  v_q text;
  v_q_like text;
  v_limit integer;
  v_items jsonb;
BEGIN
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  v_limit := greatest(1, least(COALESCE(p_limit, 40), 80));
  v_q := nullif(btrim(COALESCE(p_query, '')), '');
  IF v_q IS NOT NULL AND length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  -- %, _ y \ del usuario son literales (no comodines ILIKE).
  -- Orden: primero \, luego % y _.
  IF v_q IS NOT NULL THEN
    v_q_like := replace(
      replace(
        replace(v_q, E'\\', E'\\\\'),
        '%',
        E'\\%'
      ),
      '_',
      E'\\_'
    );
  END IF;

  SELECT *
  INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = btrim(p_credential_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  SELECT *
  INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  IF v_device.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_session.pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'brand', p.brand,
        'sku', p.sku,
        'ean', p.ean,
        'category', p.category,
        'price', p.price,
        'stock', p.stock,
        'is_active', p.is_active
      )
      ORDER BY p.name_sort, p.id
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT
      pr.id,
      pr.name,
      pr.brand,
      pr.sku,
      pr.ean,
      pr.category,
      pr.price,
      pr.stock,
      pr.is_active,
      lower(pr.name) AS name_sort
    FROM public.pharmacy_products pr
    WHERE pr.pharmacy_id = v_session.pharmacy_id
      AND pr.is_active IS TRUE
      AND (
        v_q IS NULL
        OR pr.name ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.brand, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.sku, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.ean, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
      )
    ORDER BY lower(pr.name), pr.id
    LIMIT v_limit
  ) p;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_session.pharmacy_id,
    'query', v_q,
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_search_products_v1(text, text, integer) IS
  'Búsqueda de productos activos de la farmacia de la sesión kiosko. Aislado por credential_hash. ILIKE trata %, _ y \\ del usuario como literales.';

REVOKE ALL ON FUNCTION public.ff_kiosk_search_products_v1(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_search_products_v1(text, text, integer)
  TO anon, authenticated, service_role;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.ff_kiosk_search_products_v1(text, text, integer);
