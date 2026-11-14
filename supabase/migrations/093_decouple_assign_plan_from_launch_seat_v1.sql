-- =============================================================================
-- 093_decouple_assign_plan_from_launch_seat_v1.sql
-- Desacopla ff_assign_commercial_plan_v1 de reserva/liberación de plaza.
-- p_use_launch_promo=true → error orientativo (usar RPCs de plaza).
-- No modifica plazas existentes. Solo staging.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_assign_commercial_plan_v1(
  p_pharmacy_id uuid,
  p_commercial_plan_key text,
  p_reason text DEFAULT NULL,
  p_end_open_pilot boolean DEFAULT false,
  p_use_launch_promo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_sku text := lower(btrim(coalesce(p_commercial_plan_key, '')));
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');
  v_effects jsonb;
  v_prev public.pharmacy_commercial_assignments%ROWTYPE;
  v_plan_id uuid;
  v_tech_key text;
  v_mode text;
  v_attach jsonb := NULL;
  v_sub_id uuid;
  v_has_sub boolean;
  v_open_trial public.pharmacy_commercial_trials%ROWTYPE;
  v_assistant jsonb := NULL;
  v_from_key text;
  v_launch jsonb := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
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

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = p_pharmacy_id) THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.commercial_plan_skus s
    WHERE s.key = v_sku AND s.is_active
  ) THEN
    RAISE EXCEPTION 'unknown_commercial_sku: %', v_sku USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(p_use_launch_promo, false) AND v_sku = 'pilot' THEN
    RAISE EXCEPTION 'launch_promo_not_for_pilot' USING ERRCODE = '23514';
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

  SELECT * INTO v_prev
  FROM public.pharmacy_commercial_assignments
  WHERE pharmacy_id = p_pharmacy_id
  FOR UPDATE;

  v_from_key := v_prev.commercial_sku_key;

  IF FOUND AND v_prev.commercial_sku_key = v_sku
     AND v_prev.catalog_mode = v_mode
     AND v_prev.technical_plan_key = v_tech_key
     AND coalesce(p_use_launch_promo, false) IS FALSE
     AND NOT EXISTS (
       SELECT 1 FROM public.commercial_launch_seat_reservations r
       WHERE r.pharmacy_id = p_pharmacy_id AND r.cohort_key = 'launch_2027' AND r.status = 'active'
     ) THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'pharmacy_id', p_pharmacy_id,
      'commercial_plan_key', v_sku,
      'catalog_mode', v_mode,
      'technical_plan_key', v_tech_key,
      'subscription_id', NULL,
      'launch', NULL,
      'note', 'Sin cambios'
    );
  END IF;

  -- Piloto abierto
  SELECT * INTO v_open_trial
  FROM public.pharmacy_commercial_trials t
  WHERE t.pharmacy_id = p_pharmacy_id
    AND t.status = ANY (ARRAY['ready', 'active', 'extended'])
  ORDER BY t.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND (v_effects->>'is_pilot')::boolean IS NOT TRUE THEN
    IF v_open_trial.status IN ('active', 'extended') THEN
      IF coalesce(p_end_open_pilot, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'pilot_must_end_first'
          USING ERRCODE = '23514',
                MESSAGE = 'Hay un piloto en curso. Finalízalo antes de asignar un plan de pago (p_end_open_pilot=true).';
      END IF;
      PERFORM public.ff_commercial_trial_end_v1(
        p_pharmacy_id,
        coalesce(v_reason, 'end_before_plan_assign')
      );
    ELSIF v_open_trial.status = 'ready' THEN
      UPDATE public.pharmacy_commercial_trials
      SET status = 'cancelled', ended_at = v_now, updated_by = v_uid
      WHERE id = v_open_trial.id;
    END IF;
  END IF;

  -- 093: plaza desacoplada. p_use_launch_promo ya no reserva ni libera.
  IF coalesce(p_use_launch_promo, false) THEN
    RAISE EXCEPTION 'launch_promo_use_dedicated_rpc'
      USING ERRCODE = '23514',
            MESSAGE = 'La plaza se gestiona aparte: use ff_reserve_launch_2027_seat_v1 / ff_release_launch_seat_v1. Assign no reserva ni libera.';
  END IF;
  v_launch := NULL;

  IF (v_effects->>'is_pilot')::boolean THEN
    IF NOT public.ff_has_platform_permission('platform.commercial_trials.manage') THEN
      RAISE EXCEPTION 'forbidden_commercial_trials' USING ERRCODE = '42501';
    END IF;

    UPDATE public.pharmacies
    SET plan_id = v_plan_id, updated_by = v_uid
    WHERE id = p_pharmacy_id;

    PERFORM public.ff_commercial_pilot_apply_entitlement_profile_v1(p_pharmacy_id);
    PERFORM public.ff_set_pharmacy_catalog_mode_v1(p_pharmacy_id, 'generic');
    v_attach := public.ff_attach_master_catalog_v1(p_pharmacy_id);

    IF NOT EXISTS (
      SELECT 1 FROM public.pharmacy_commercial_trials t
      WHERE t.pharmacy_id = p_pharmacy_id
        AND t.status = ANY (ARRAY['ready', 'active', 'extended'])
    ) THEN
      INSERT INTO public.pharmacy_commercial_trials (
        pharmacy_id, program, status, prepared_at, created_by, updated_by
      ) VALUES (
        p_pharmacy_id, 'commercial_v1_15d', 'ready', v_now, v_uid, v_uid
      );
    END IF;

  ELSE
    UPDATE public.pharmacies
    SET plan_id = v_plan_id,
        status = CASE
          WHEN status IN ('suspended', 'archived') THEN status
          ELSE 'active'
        END,
        updated_by = v_uid
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

    PERFORM public.ff_ensure_pharmacy_home_entrypoint_v1(p_pharmacy_id);
    PERFORM public.ff_set_pharmacy_catalog_mode_v1(p_pharmacy_id, v_mode);
    IF (v_effects->>'attach_master')::boolean THEN
      v_attach := public.ff_attach_master_catalog_v1(p_pharmacy_id);
    END IF;

    v_has_sub := public.ff_pharmacy_has_current_subscription(p_pharmacy_id);
    IF v_has_sub THEN
      UPDATE public.subscriptions s
      SET plan_id = v_plan_id,
          status = CASE WHEN s.status = 'trialing' THEN 'active' ELSE s.status END,
          updated_by = v_uid
      WHERE s.pharmacy_id = p_pharmacy_id
        AND s.status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused'])
      RETURNING s.id INTO v_sub_id;
    ELSIF (v_effects->>'creates_paid_subscription')::boolean THEN
      INSERT INTO public.subscriptions (
        pharmacy_id, plan_id, status, provider,
        current_period_start, current_period_end,
        created_by, updated_by
      ) VALUES (
        p_pharmacy_id, v_plan_id, 'active', 'manual',
        v_now, v_now + interval '30 days',
        v_uid, v_uid
      )
      RETURNING id INTO v_sub_id;
    END IF;
  END IF;

  IF v_effects->>'assistant_action' = 'activate_contracted' THEN
    v_assistant := public.ff_set_pharmacy_assistant_entitlement_v1(
      p_pharmacy_id, 'activate_contracted', 500, NULL, false,
      'commercial_plan_assign_v1'
    );
  ELSIF v_effects->>'assistant_action' = 'none' THEN
    IF EXISTS (
      SELECT 1
      FROM public.pharmacy_entitlements pe
      INNER JOIN public.modules m ON m.id = pe.module_id
      WHERE pe.pharmacy_id = p_pharmacy_id
        AND m.key = 'assistant_ai'
        AND pe.status = ANY (ARRAY['active', 'trial', 'suspended'])
    ) THEN
      v_assistant := public.ff_set_pharmacy_assistant_entitlement_v1(
        p_pharmacy_id, 'cancel', NULL, NULL, false,
        'commercial_plan_assign_v1_assistant_off'
      );
    END IF;
  END IF;

  INSERT INTO public.pharmacy_commercial_assignments (
    pharmacy_id, commercial_sku_key, technical_plan_key, catalog_mode,
    assigned_at, assigned_by, reason, metadata
  ) VALUES (
    p_pharmacy_id, v_sku, v_tech_key, v_mode,
    v_now, v_uid, v_reason,
    jsonb_build_object(
      'from', v_from_key,
      'profile', v_effects->>'profile',
      'attach', v_attach,
      'assistant', v_assistant,
      'launch', v_launch,
      'use_launch_promo', coalesce(p_use_launch_promo, false)
    )
  )
  ON CONFLICT (pharmacy_id) DO UPDATE
  SET
    commercial_sku_key = EXCLUDED.commercial_sku_key,
    technical_plan_key = EXCLUDED.technical_plan_key,
    catalog_mode = EXCLUDED.catalog_mode,
    assigned_at = v_now,
    assigned_by = v_uid,
    reason = EXCLUDED.reason,
    metadata = EXCLUDED.metadata,
    updated_at = v_now;

  PERFORM public.ff_write_audit_log(
    'commercial.plan.assign',
    p_pharmacy_id,
    'pharmacy_commercial_assignment',
    p_pharmacy_id::text,
    jsonb_build_object(
      'from', v_from_key,
      'to', v_sku,
      'catalog_mode', v_mode,
      'technical_plan_key', v_tech_key,
      'subscription_id', v_sub_id,
      'reason', v_reason,
      'end_open_pilot', coalesce(p_end_open_pilot, false),
      'use_launch_promo', coalesce(p_use_launch_promo, false),
      'launch', v_launch,
      'activated_pilot', false
    ),
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'pharmacy_id', p_pharmacy_id,
    'commercial_plan_key', v_sku,
    'from', v_from_key,
    'catalog_mode', v_mode,
    'technical_plan_key', v_tech_key,
    'subscription_id', v_sub_id,
    'master_catalog_attach', v_attach,
    'assistant', v_assistant,
    'launch', v_launch,
    'use_launch_promo', coalesce(p_use_launch_promo, false),
    'activated_pilot', false
  );
END;
$$;


COMMENT ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean) IS
  '093: asigna plan comercial. NO reserva ni libera plaza launch_2027 (usar RPCs dedicadas).';

REVOKE ALL ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean)
  TO authenticated, service_role;
