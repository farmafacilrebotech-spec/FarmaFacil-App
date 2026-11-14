-- =============================================================================
-- 091_create_pharmacy_no_auto_trial_v1.sql
-- Alta limpia: ff_create_pharmacy_v1 SIN suscripción trialing 30d ni piloto.
--
-- Comportamiento:
--   - pharmacy status = pending_setup (por defecto)
--   - branding + settings + entitlements del plan elegido (configuración)
--   - NO inserta subscriptions
--   - NO crea pharmacy_commercial_trials
--
-- No altera farmacias / suscripciones / pilotos existentes.
-- Prerrequisito: 030 (firma de ff_create_pharmacy_v1).
-- SOLO staging. NO producción.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_create_pharmacy_v1(
  p_name text,
  p_plan_key text,
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
  p_status text DEFAULT 'pending_setup',
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_plan_id uuid;
  v_pharmacy_id uuid;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'pharmacy_name_required'
      USING ERRCODE = '23514';
  END IF;

  IF p_plan_key IS NULL OR length(trim(p_plan_key)) = 0 THEN
    RAISE EXCEPTION 'plan_key_required'
      USING ERRCODE = '23514';
  END IF;

  SELECT p.id
    INTO v_plan_id
  FROM public.plans p
  WHERE p.key = trim(p_plan_key)
    AND p.is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_not_found_or_inactive: %', p_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plan_modules pm
    INNER JOIN public.modules m ON m.id = pm.module_id
    WHERE pm.plan_id = v_plan_id
      AND m.is_active = true
  ) THEN
    RAISE EXCEPTION 'plan_has_no_active_modules: %', p_plan_key
      USING ERRCODE = 'P0002';
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
    COALESCE(NULLIF(trim(p_status), ''), 'pending_setup'),
    v_plan_id,
    NULLIF(trim(p_logo_color), ''),
    v_uid,
    v_uid
  )
  RETURNING id INTO v_pharmacy_id;

  INSERT INTO public.pharmacy_branding (
    pharmacy_id, primary_color, secondary_color, welcome_message, updated_by
  )
  VALUES (
    v_pharmacy_id,
    NULLIF(trim(p_primary_color), ''),
    NULLIF(trim(p_secondary_color), ''),
    NULLIF(trim(p_welcome_message), ''),
    v_uid
  );

  INSERT INTO public.pharmacy_settings (
    pharmacy_id, visible_name, schedule, phone, whatsapp, email, updated_by
  )
  VALUES (
    v_pharmacy_id,
    COALESCE(NULLIF(trim(p_visible_name), ''), trim(p_name)),
    NULLIF(trim(p_schedule), ''),
    COALESCE(NULLIF(trim(p_settings_phone), ''), NULLIF(trim(p_phone), '')),
    NULLIF(trim(p_whatsapp), ''),
    COALESCE(NULLIF(trim(p_settings_email), ''), NULLIF(trim(p_email), '')),
    v_uid
  );

  -- Entitlements del plan para configuración operativa (sin reloj comercial).
  INSERT INTO public.pharmacy_entitlements (
    pharmacy_id, module_id, status, source, source_plan_id,
    limits, config, starts_at, created_by, updated_by
  )
  SELECT
    v_pharmacy_id,
    pm.module_id,
    'active',
    'plan',
    v_plan_id,
    COALESCE(pm.default_limits, '{}'::jsonb),
    '{}'::jsonb,
    v_now,
    v_uid,
    v_uid
  FROM public.plan_modules pm
  INNER JOIN public.modules m ON m.id = pm.module_id
  WHERE pm.plan_id = v_plan_id
    AND m.is_active = true;

  -- 091: sin subscriptions (ni trialing 30d). Sin pharmacy_commercial_trials.
  PERFORM public.ff_write_audit_log(
    'pharmacy.create.clean_v1',
    v_pharmacy_id,
    'pharmacy',
    v_pharmacy_id::text,
    jsonb_build_object(
      'plan_key', trim(p_plan_key),
      'subscription', 'none',
      'commercial_trial', 'none',
      'note', 'Alta limpia 091: pendiente activación comercial explícita'
    ),
    NULL,
    NULL
  );

  RETURN v_pharmacy_id;
END;
$$;

COMMENT ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) IS
  '091: alta limpia. Farmacia + branding + settings + entitlements. SIN subscription trial 30d ni piloto. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) TO authenticated;

-- DOWN (desarrollo): reaplicar cuerpo de 030_create_pharmacy_trial_defaults_v1.sql
