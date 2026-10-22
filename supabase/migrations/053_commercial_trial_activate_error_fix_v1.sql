-- =============================================================================
-- 053_commercial_trial_activate_error_fix_v1.sql
-- Corrige RAISE inválidos en funciones comerciales 050/051.
--
-- Defecto:
--   RAISE EXCEPTION 'codigo' USING MESSAGE = '...'  → Postgres ya usa el
--   literal primario como MESSAGE → "RAISE option already specified: MESSAGE".
--
-- Alcance:
--   - ff_commercial_trial_activate_v1: todos los RAISE con MESSAGE duplicado
--     (checklist no-ready, entitlements, assistant, unique_violation).
--   - ff_create_pharmacy_commercial_prep_v1: RAISE entrypoint_ensure_failed.
--
-- NO cambia la lógica cuando readiness=true ni el flujo de activate/extend/end.
-- Conserva SECURITY INVOKER, search_path y reafirma GRANT post-052.
-- NO APLICAR sin autorización expresa.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_commercial_trial_activate_v1(
  p_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_end timestamptz;
  v_ph public.pharmacies%ROWTYPE;
  v_trial public.pharmacy_commercial_trials%ROWTYPE;
  v_sub_id uuid;
  v_assistant jsonb;
  v_ready jsonb;
  v_starter_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_trials.manage') THEN
    RAISE EXCEPTION 'forbidden_commercial_trials' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.subscriptions.manage') THEN
    RAISE EXCEPTION 'forbidden_subscriptions_manage' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'Se requiere platform.entitlements.manage para activar el asistente genérico del piloto.',
            HINT = 'forbidden_entitlements_manage';
  END IF;

  SELECT * INTO v_ph FROM public.pharmacies WHERE id = p_pharmacy_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_trial
  FROM public.pharmacy_commercial_trials t
  WHERE t.pharmacy_id = p_pharmacy_id
    AND t.status = ANY (ARRAY['ready', 'active', 'extended'])
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commercial_trial_not_ready' USING ERRCODE = 'P0002';
  END IF;

  IF v_trial.status IN ('active', 'extended') THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'trial_id', v_trial.id,
      'trial_status', v_trial.status,
      'ends_at', v_trial.ends_at,
      'subscription_id', v_trial.subscription_id
    );
  END IF;

  SELECT id INTO v_starter_id FROM public.plans WHERE key = 'starter' AND is_active;
  IF v_starter_id IS NULL THEN
    RAISE EXCEPTION 'starter_plan_missing' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.pharmacies
  SET plan_id = v_starter_id, updated_by = v_uid
  WHERE id = p_pharmacy_id AND plan_id IS DISTINCT FROM v_starter_id;

  PERFORM public.ff_commercial_pilot_apply_entitlement_profile_v1(p_pharmacy_id);

  v_ready := public.ff_commercial_trial_readiness_v1(p_pharmacy_id);
  IF coalesce((v_ready->>'ready')::boolean, false) IS NOT TRUE THEN
    -- ERRCODE + DETAIL (checklist) conservados; sin literal primario + MESSAGE.
    RAISE EXCEPTION
      USING ERRCODE = '23514',
            MESSAGE = 'Faltan condiciones obligatorias para activar el piloto.',
            DETAIL = v_ready::text,
            HINT = 'commercial_trial_not_ready_checklist';
  END IF;

  v_end := v_now + interval '15 days';

  v_assistant := public.ff_set_pharmacy_assistant_entitlement_v1(
    p_pharmacy_id,
    'activate_demo',
    50,
    v_end,
    false,
    'commercial_trial_activate_v1'
  );

  IF coalesce((v_assistant->>'ok')::boolean, false) IS NOT TRUE
     OR coalesce(v_assistant->>'mode', '') IS DISTINCT FROM 'demo' THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0001',
            MESSAGE = 'No se pudo habilitar el asistente genérico; el piloto no se activa.',
            DETAIL = coalesce(v_assistant::text, 'null'),
            HINT = 'commercial_trial_assistant_demo_failed';
  END IF;

  IF NOT public.ff_pharmacy_has_module(p_pharmacy_id, 'assistant_ai') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0001',
            MESSAGE = 'El módulo assistant_ai no quedó usable tras activate_demo.',
            HINT = 'commercial_trial_assistant_not_usable';
  END IF;

  INSERT INTO public.subscriptions (
    pharmacy_id, plan_id, status, provider,
    trial_start, trial_end, current_period_start, current_period_end,
    created_by, updated_by
  ) VALUES (
    p_pharmacy_id, v_starter_id, 'trialing', 'manual',
    v_now, v_end, v_now, v_end, v_uid, v_uid
  )
  RETURNING id INTO v_sub_id;

  UPDATE public.pharmacies
  SET status = 'active', plan_id = v_starter_id, updated_by = v_uid
  WHERE id = p_pharmacy_id;

  UPDATE public.pharmacy_commercial_trials
  SET
    status = 'active',
    activated_at = v_now,
    original_ends_at = v_end,
    ends_at = v_end,
    subscription_id = v_sub_id,
    updated_by = v_uid
  WHERE id = v_trial.id
  RETURNING * INTO v_trial;

  PERFORM public.ff_write_audit_log(
    'commercial.trial.activate', p_pharmacy_id, 'pharmacy_commercial_trial',
    v_trial.id::text,
    jsonb_build_object(
      'subscription_id', v_sub_id,
      'ends_at', v_end,
      'assistant', v_assistant,
      'plan_key', 'starter',
      'commercial_profile', 'pilot_v1',
      'kiosk', 'not_activated'
    ),
    NULL, NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'trial_id', v_trial.id,
    'trial_status', 'active',
    'subscription_id', v_sub_id,
    'activated_at', v_now,
    'ends_at', v_end,
    'assistant', v_assistant
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION
      USING ERRCODE = '23505',
            MESSAGE = 'Conflicto de concurrencia: ya existe suscripción corriente.',
            HINT = 'pharmacy_has_current_subscription';
END;
$$;

COMMENT ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) IS
  'Activa piloto 15d (assistant demo → subscription). Error no-ready: ERRCODE 23514 + DETAIL checklist.';

-- Misma clase de defecto en alta comercial (ruta rara: fallo de entrypoint).
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

  PERFORM public.ff_commercial_pilot_apply_entitlement_profile_v1(v_pharmacy_id);

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
    RAISE EXCEPTION
      USING ERRCODE = 'P0001',
            MESSAGE = 'No se pudo generar el QR / entrypoint de la farmacia.',
            DETAIL = coalesce(v_ep::text, 'null'),
            HINT = 'entrypoint_ensure_failed';
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

-- Reafirmar ACL post-052 (CREATE OR REPLACE conserva owner; grants explícitos)
REVOKE ALL ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_activate_v1(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) TO authenticated, service_role;

-- =============================================================================
-- DOWN (manual): redeploy cuerpos 050/051 previos si hiciera falta.
-- =============================================================================
