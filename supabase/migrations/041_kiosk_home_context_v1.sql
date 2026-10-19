-- =============================================================================
-- 041_kiosk_home_context_v1.sql
-- Contexto de bienvenida del kiosko: nombre de farmacia + entrypoint QR propio.
--
-- Reutiliza public_entrypoints (009). NO crea un sistema paralelo de QR.
-- Solo LEE purpose=pharmacy_home. La creación/backfill está en 042.
--
-- NO APLICAR automáticamente en producción.
-- Depende de: 006, 009, 034, 036. Provision: 042.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_kiosk_get_home_context_v1(
  p_credential_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
  v_pharmacy_name text;
  v_welcome text;
  v_ep public.public_entrypoints%ROWTYPE;
BEGIN
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'session_invalid');
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

  SELECT p.name
  INTO v_pharmacy_name
  FROM public.pharmacies p
  WHERE p.id = v_session.pharmacy_id;

  IF v_pharmacy_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT b.welcome_message
  INTO v_welcome
  FROM public.pharmacy_branding b
  WHERE b.pharmacy_id = v_session.pharmacy_id;

  -- Solo el entrypoint de inicio de ESTA farmacia (no otros tenants).
  SELECT *
  INTO v_ep
  FROM public.public_entrypoints pe
  WHERE pe.pharmacy_id = v_session.pharmacy_id
    AND pe.purpose = 'pharmacy_home'
    AND pe.is_active = true
    AND (pe.expires_at IS NULL OR pe.expires_at > pg_catalog.now())
  LIMIT 1;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_session.pharmacy_id,
    'pharmacy_name', v_pharmacy_name,
    'welcome_message', v_welcome,
    'device_display_name', v_device.display_name,
    'entrypoint', CASE
      WHEN v_ep.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'public_id', v_ep.public_id,
        'purpose', v_ep.purpose,
        'internal_route', v_ep.internal_route,
        'qr_asset_path', v_ep.qr_asset_path,
        'qr_version', v_ep.qr_version
      )
    END
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_get_home_context_v1(text) IS
  'Bienvenida kiosko: farmacia + entrypoint pharmacy_home de la sesión de dispositivo.';

REVOKE ALL ON FUNCTION public.ff_kiosk_get_home_context_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_get_home_context_v1(text)
  TO anon, authenticated, service_role;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.ff_kiosk_get_home_context_v1(text);
