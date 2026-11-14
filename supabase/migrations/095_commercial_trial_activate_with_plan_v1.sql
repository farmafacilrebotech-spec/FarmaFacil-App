-- =============================================================================
-- 095_commercial_trial_activate_with_plan_v1.sql
-- Activación de piloto 15d con plan explícito: general | personalized | ai_personalized.
--
-- - Añade trial_plan_sku a pharmacy_commercial_trials
-- - Nueva firma activate(pharmacy_id, trial_plan_sku)
-- - La firma de 1 argumento queda bloqueada (exige plan)
-- - No reserva plaza ni confirma promoción
--
-- Prerrequisitos: 050, 083 (SKUs / effects).
-- SOLO staging.
-- =============================================================================

ALTER TABLE public.pharmacy_commercial_trials
  ADD COLUMN IF NOT EXISTS trial_plan_sku text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pharmacy_commercial_trials_trial_plan_sku_chk'
  ) THEN
    ALTER TABLE public.pharmacy_commercial_trials
      ADD CONSTRAINT pharmacy_commercial_trials_trial_plan_sku_chk
      CHECK (
        trial_plan_sku IS NULL
        OR trial_plan_sku = ANY (
          ARRAY['general'::text, 'personalized'::text, 'ai_personalized'::text]
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.pharmacy_commercial_trials.trial_plan_sku IS
  '095: plan comercial del piloto (General / Personalizado / IA). Obligatorio al activar.';

-- Bloquear activate sin plan
CREATE OR REPLACE FUNCTION public.ff_commercial_trial_activate_v1(
  p_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'commercial_trial_plan_required'
    USING ERRCODE = '23514',
          MESSAGE = 'Indique el plan del piloto: general | personalized | ai_personalized (ff_commercial_trial_activate_v1 pharmacy_id, plan).';
END;
$$;

CREATE OR REPLACE FUNCTION public.ff_commercial_trial_activate_v1(
  p_pharmacy_id uuid,
  p_trial_plan_sku text
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
  v_assistant jsonb := NULL;
  v_ready jsonb;
  v_sku text := lower(btrim(coalesce(p_trial_plan_sku, '')));
  v_effects jsonb;
  v_plan_id uuid;
  v_tech_key text;
  v_mode text;
  v_attach jsonb := NULL;
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
    RAISE EXCEPTION 'forbidden_entitlements_manage' USING ERRCODE = '42501';
  END IF;

  IF v_sku NOT IN ('general', 'personalized', 'ai_personalized') THEN
    RAISE EXCEPTION 'commercial_trial_invalid_plan'
      USING ERRCODE = '23514',
            MESSAGE = 'Plan de piloto inválido. Use general, personalized o ai_personalized.';
  END IF;

  v_effects := public.ff_commercial_sku_effects_v1(v_sku);
  v_tech_key := v_effects->>'technical_plan_key';
  v_mode := v_effects->>'catalog_mode';

  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE key = v_tech_key AND is_active = true;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'technical_plan_missing: %', v_tech_key USING ERRCODE = 'P0002';
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
      'trial_plan_sku', v_trial.trial_plan_sku,
      'ends_at', v_trial.ends_at,
      'subscription_id', v_trial.subscription_id
    );
  END IF;

  -- Perfil entitlements del plan elegido (sin plaza promo)
  UPDATE public.pharmacies
  SET plan_id = v_plan_id, updated_by = v_uid
  WHERE id = p_pharmacy_id;

  UPDATE public.pharmacy_entitlements pe
  SET status = 'cancelled', ends_at = v_now, updated_by = v_uid
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.source = 'plan'
    AND pe.status IS DISTINCT FROM 'cancelled'
    AND NOT EXISTS (
      SELECT 1
      FROM public.plan_modules pm
      INNER JOIN public.modules m ON m.id = pm.module_id
      WHERE pm.plan_id = v_plan_id
        AND pm.module_id = pe.module_id
        AND m.is_active = true
    );

  INSERT INTO public.pharmacy_entitlements (
    pharmacy_id, module_id, status, source, source_plan_id,
    limits, config, starts_at, ends_at, created_by, updated_by
  )
  SELECT
    p_pharmacy_id, pm.module_id, 'active', 'plan', v_plan_id,
    COALESCE(pm.default_limits, '{}'::jsonb), '{}'::jsonb,
    v_now, NULL, v_uid, v_uid
  FROM public.plan_modules pm
  INNER JOIN public.modules m ON m.id = pm.module_id
  WHERE pm.plan_id = v_plan_id
    AND m.is_active = true
  ON CONFLICT (pharmacy_id, module_id) DO UPDATE
  SET
    status = 'active',
    source_plan_id = EXCLUDED.source_plan_id,
    limits = EXCLUDED.limits,
    ends_at = NULL,
    updated_by = EXCLUDED.updated_by
  WHERE public.pharmacy_entitlements.source = 'plan';

  PERFORM public.ff_set_pharmacy_catalog_mode_v1(p_pharmacy_id, coalesce(v_mode, 'generic'));
  IF coalesce((v_effects->>'attach_master')::boolean, false) THEN
    v_attach := public.ff_attach_master_catalog_v1(p_pharmacy_id);
  END IF;

  v_ready := public.ff_commercial_trial_readiness_v1(p_pharmacy_id);
  IF coalesce((v_ready->>'ready')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'commercial_trial_not_ready_checklist'
      USING ERRCODE = '23514',
            MESSAGE = 'Faltan condiciones obligatorias para activar el piloto.',
            DETAIL = v_ready::text;
  END IF;

  v_end := v_now + interval '15 days';

  IF v_sku = 'ai_personalized' OR v_effects->>'assistant_action' IN ('activate_demo', 'activate_contracted') THEN
    v_assistant := public.ff_set_pharmacy_assistant_entitlement_v1(
      p_pharmacy_id,
      'activate_demo',
      50,
      v_end,
      false,
      'commercial_trial_activate_with_plan_v1'
    );
    IF coalesce((v_assistant->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'commercial_trial_assistant_demo_failed'
        USING ERRCODE = 'P0001',
              MESSAGE = 'No se pudo habilitar el asistente del piloto.',
              DETAIL = coalesce(v_assistant::text, 'null');
    END IF;
  END IF;

  INSERT INTO public.subscriptions (
    pharmacy_id, plan_id, status, provider,
    trial_start, trial_end, current_period_start, current_period_end,
    created_by, updated_by
  ) VALUES (
    p_pharmacy_id, v_plan_id, 'trialing', 'manual',
    v_now, v_end, v_now, v_end, v_uid, v_uid
  )
  RETURNING id INTO v_sub_id;

  UPDATE public.pharmacies
  SET status = 'active', plan_id = v_plan_id, updated_by = v_uid
  WHERE id = p_pharmacy_id;

  UPDATE public.pharmacy_commercial_trials
  SET
    status = 'active',
    trial_plan_sku = v_sku,
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
      'trial_plan_sku', v_sku,
      'technical_plan_key', v_tech_key,
      'assistant', v_assistant,
      'master_catalog_attach', v_attach,
      'launch_seat', 'untouched'
    ),
    NULL, NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'trial_id', v_trial.id,
    'trial_status', 'active',
    'trial_plan_sku', v_sku,
    'subscription_id', v_sub_id,
    'activated_at', v_now,
    'ends_at', v_end,
    'assistant', v_assistant
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'pharmacy_has_current_subscription'
      USING ERRCODE = '23505',
            MESSAGE = 'Conflicto de concurrencia: ya existe suscripción corriente.';
END;
$$;

COMMENT ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) IS
  '095: bloqueada — requiere plan (usar overload con p_trial_plan_sku).';
COMMENT ON FUNCTION public.ff_commercial_trial_activate_v1(uuid, text) IS
  '095: activa piloto 15d con plan explícito general|personalized|ai_personalized. No toca plazas.';

REVOKE ALL ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_commercial_trial_activate_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_activate_v1(uuid, text) TO authenticated;
