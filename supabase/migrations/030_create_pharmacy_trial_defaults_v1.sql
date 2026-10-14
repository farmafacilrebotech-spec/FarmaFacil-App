-- =============================================================================
-- 030_create_pharmacy_trial_defaults_v1.sql
-- REPLACE de ff_create_pharmacy_v1: trial gratuito de 30 días.
--
-- Cambios respecto a 016:
--   - trial_start / trial_end (now + 30 days)
--   - current_period_end = trial_end (permite cancel_at_period_end en trial)
--
-- Misma firma, SECURITY INVOKER, RLS. NO toca memberships ni auth.
-- NO APLICAR automáticamente.
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

  -- Resolver plan activo por key real (starter|pro|business|enterprise)
  SELECT p.id
    INTO v_plan_id
  FROM public.plans p
  WHERE p.key = trim(p_plan_key)
    AND p.is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_not_found_or_inactive: %', p_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  -- Exigir al menos un módulo activo en el plan antes de crear nada
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

  -- 1) Farmacia
  INSERT INTO public.pharmacies (
    name,
    legal_name,
    cif,
    email,
    phone,
    web,
    address_line,
    postal_code,
    city,
    province,
    country,
    status,
    plan_id,
    logo_color,
    created_by,
    updated_by
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

  -- 2) Branding inicial
  INSERT INTO public.pharmacy_branding (
    pharmacy_id,
    primary_color,
    secondary_color,
    welcome_message,
    updated_by
  )
  VALUES (
    v_pharmacy_id,
    NULLIF(trim(p_primary_color), ''),
    NULLIF(trim(p_secondary_color), ''),
    NULLIF(trim(p_welcome_message), ''),
    v_uid
  );

  -- 3) Settings iniciales
  INSERT INTO public.pharmacy_settings (
    pharmacy_id,
    visible_name,
    schedule,
    phone,
    whatsapp,
    email,
    updated_by
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

  -- 4) Suscripción manual con trial de 30 días
  INSERT INTO public.subscriptions (
    pharmacy_id,
    plan_id,
    status,
    provider,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    created_by,
    updated_by
  )
  VALUES (
    v_pharmacy_id,
    v_plan_id,
    'trialing',
    'manual',
    v_now,
    v_now + interval '30 days',
    v_now,
    v_now + interval '30 days',
    v_uid,
    v_uid
  );

  -- 5) Entitlements desde plan_modules del plan elegido
  INSERT INTO public.pharmacy_entitlements (
    pharmacy_id,
    module_id,
    status,
    source,
    source_plan_id,
    limits,
    config,
    starts_at,
    created_by,
    updated_by
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

  RETURN v_pharmacy_id;
END;
$$;

COMMENT ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) IS
  'Alta atómica V1 de farmacia + branding + settings + subscription manual (trial 30d) + entitlements. SECURITY INVOKER (RLS aplica).';

REVOKE ALL ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_create_pharmacy_v1(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) TO authenticated;

-- Backfill opcional (NO ejecutar aquí; solo referencia tras aplicar 030):
-- UPDATE public.subscriptions
-- SET
--   trial_start = coalesce(trial_start, current_period_start, created_at),
--   trial_end = coalesce(trial_end, coalesce(current_period_start, created_at) + interval '30 days'),
--   current_period_end = coalesce(current_period_end, coalesce(trial_end, created_at + interval '30 days'))
-- WHERE status = 'trialing'
--   AND (trial_end IS NULL OR current_period_end IS NULL);

-- DOWN (desarrollo): redeploy cuerpo 016 (sin trial_end).
