-- =============================================================================
-- 051_create_pharmacy_commercial_prep_v1.sql
-- Alta de farmacia PARA PILOTO COMERCIAL (sin suscripción automática).
--
-- Perfil comercial piloto (fijo):
--   - plan interno siempre `starter` (no hereda límites pro/business/enterprise)
--   - entitlements allowlist vía ff_commercial_pilot_apply_entitlement_profile_v1
--   - sin kiosk; sin assistant contracted
--   - pharmacy_assistant_settings preparado (demo se activa solo en activate)
--   - QR pharmacy_home
--   - trial status=ready
--
-- Fuera de alcance (igual que alta clásica): memberships / Auth / email.
-- Depende de: 042, 049, 050 (perfil + readiness helpers).
-- NO APLICAR sin autorización expresa.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  p_name text,
  p_legal_name text DEFAULT NULL,
  p_cif text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_web text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_country text DEFAULT 'ES',
  p_logo_color text DEFAULT NULL,
  p_primary_color text DEFAULT NULL,
  p_secondary_color text DEFAULT NULL,
  p_welcome_message text DEFAULT NULL,
  p_visible_name text DEFAULT NULL,
  p_schedule text DEFAULT NULL,
  p_settings_phone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_settings_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_plan_id uuid;
  v_pharmacy_id uuid;
  v_trial_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_ep jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_trials.manage') THEN
    RAISE EXCEPTION 'forbidden_commercial_trials' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION 'forbidden_entitlements_manage' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'pharmacy_name_required' USING ERRCODE = '23514';
  END IF;

  -- Siempre starter: mismo set de módulos base + límites piloto
  SELECT p.id INTO v_plan_id
  FROM public.plans p
  WHERE p.key = 'starter' AND p.is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'starter_plan_missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.pharmacies (
    name, legal_name, cif, email, phone, web,
    address_line, postal_code, city, province, country,
    status, plan_id, logo_color, created_by, updated_by
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(p_legal_name), ''),
    NULLIF(trim(p_cif), ''),
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_web), ''),
    NULLIF(trim(p_address_line), ''),
    NULLIF(trim(p_postal_code), ''),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_province), ''),
    COALESCE(NULLIF(trim(p_country), ''), 'ES'),
    'pending_setup',
    v_plan_id,
    NULLIF(trim(p_logo_color), ''),
    v_uid,
    v_uid
  )
  RETURNING id INTO v_pharmacy_id;

  INSERT INTO public.pharmacy_branding (
    pharmacy_id, primary_color, secondary_color, welcome_message, updated_by
  ) VALUES (
    v_pharmacy_id,
    NULLIF(trim(p_primary_color), ''),
    NULLIF(trim(p_secondary_color), ''),
    NULLIF(trim(p_welcome_message), ''),
    v_uid
  );

  INSERT INTO public.pharmacy_settings (
    pharmacy_id, visible_name, schedule, phone, whatsapp, email, updated_by
  ) VALUES (
    v_pharmacy_id,
    COALESCE(NULLIF(trim(p_visible_name), ''), trim(p_name)),
    NULLIF(trim(p_schedule), ''),
    COALESCE(NULLIF(trim(p_settings_phone), ''), NULLIF(trim(p_phone), '')),
    NULLIF(trim(p_whatsapp), ''),
    COALESCE(NULLIF(trim(p_settings_email), ''), NULLIF(trim(p_email), '')),
    v_uid
  );

  -- Perfil entitlements piloto (allowlist + límites starter; cancela kiosk/contracted)
  PERFORM public.ff_commercial_pilot_apply_entitlement_profile_v1(v_pharmacy_id);

  -- Settings del asistente (sin entitlement usable todavía)
  INSERT INTO public.pharmacy_assistant_settings (pharmacy_id, updated_by)
  VALUES (v_pharmacy_id, v_uid)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  INSERT INTO public.pharmacy_commercial_trials (
    pharmacy_id, program, status, prepared_at, created_by, updated_by
  ) VALUES (
    v_pharmacy_id, 'commercial_v1_15d', 'ready', v_now, v_uid, v_uid
  )
  RETURNING id INTO v_trial_id;

  v_ep := public.ff_ensure_pharmacy_home_entrypoint_v1(v_pharmacy_id);
  IF coalesce(v_ep->>'status', '') IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION 'entrypoint_ensure_failed'
      USING ERRCODE = 'P0001',
            MESSAGE = 'No se pudo generar el QR / entrypoint de la farmacia.',
            DETAIL = coalesce(v_ep::text, 'null');
  END IF;

  PERFORM public.ff_write_audit_log(
    'commercial.pharmacy.prep_create',
    v_pharmacy_id,
    'pharmacy',
    v_pharmacy_id::text,
    jsonb_build_object(
      'trial_id', v_trial_id,
      'plan_key', 'starter',
      'commercial_profile', 'pilot_v1',
      'entrypoint', v_ep,
      'subscription', 'none',
      'next_steps', jsonb_build_array(
        'invite_owner_and_wait_active',
        'seed_demo_catalog',
        'verify_readiness',
        'activate_trial'
      )
    ),
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_pharmacy_id,
    'trial_id', v_trial_id,
    'trial_status', 'ready',
    'pharmacy_status', 'pending_setup',
    'plan_key', 'starter',
    'entrypoint', v_ep,
    'subscription_id', NULL,
    'readiness', public.ff_commercial_trial_readiness_v1(v_pharmacy_id),
    'next_steps', jsonb_build_array(
      'invite_owner_and_wait_active',
      'seed_demo_catalog',
      'ff_commercial_trial_readiness_v1',
      'ff_commercial_trial_activate_v1'
    )
  );
END;
$$;

COMMENT ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) IS
  'Alta piloto comercial: starter + perfil entitlements pilot_v1 + settings assistant + QR + trial ready. Sin subscription. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) TO authenticated;

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_create_pharmacy_commercial_prep_v1(
--   text, text, text, text, text, text, text, text, text, text, text,
--   text, text, text, text, text, text, text, text, text
-- );
