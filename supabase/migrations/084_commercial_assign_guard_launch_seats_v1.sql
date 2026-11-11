-- =============================================================================
-- 084_commercial_assign_guard_launch_seats_v1.sql
-- 1) Bloquea planes comerciales en ff_change_pharmacy_plan_v1 (017).
-- 2) Reservas atómicas de plazas launch_2027 (máx. 20).
-- 3) Extiende ff_assign_commercial_plan_v1 con p_use_launch_promo.
-- Idempotente. NO migra farmacias/subs existentes. NO SQL de cobros.
-- Prerrequisitos: 083_00 (assign RPC) + 083 (plans comerciales + tarifa lista).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'ff_assign_commercial_plan_v1'
  ) THEN
    RAISE EXCEPTION '084 requires ff_assign_commercial_plan_v1 (apply 083_00 / draft 056)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = 'general' AND is_active) THEN
    RAISE EXCEPTION '084 requires plans.general (apply 083_commercial_plans_activation_v1)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- A) Guard en 017: rechazar claves comerciales / alias (cuerpo = 017 + guard)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_change_pharmacy_plan_v1(
  p_pharmacy_id uuid,
  p_new_plan_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_pharmacy_id uuid;
  v_old_plan_id uuid;
  v_old_plan_key text;
  v_new_plan_id uuid;
  v_new_plan_key text;
  v_subscription_id uuid;
  v_subscription_status text;
  v_subscription_plan_id uuid;
BEGIN
  -- 1) Autenticación
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_pharmacy_id IS NULL THEN
    RAISE EXCEPTION 'pharmacy_id_required'
      USING ERRCODE = '23514';
  END IF;

  IF p_new_plan_key IS NULL OR length(trim(p_new_plan_key)) = 0 THEN
    RAISE EXCEPTION 'plan_key_required'
      USING ERRCODE = '23514';
  END IF;

  -- 084: planes comerciales solo vía ff_assign_commercial_plan_v1
  IF lower(btrim(p_new_plan_key)) IN (
    'general', 'personalizado', 'asistente_ia_personalizado',
    'personalized', 'ai_personalized', 'ia', 'pilot', 'piloto'
  ) THEN
    RAISE EXCEPTION
      'commercial_plan_requires_assign_rpc: use ff_assign_commercial_plan_v1 for %',
      btrim(p_new_plan_key)
      USING ERRCODE = '23514';
  END IF;

  -- 2) Farmacia (bloqueo de fila para evitar carreras)
  SELECT ph.id, ph.plan_id
    INTO v_pharmacy_id, v_old_plan_id
  FROM public.pharmacies ph
  WHERE ph.id = p_pharmacy_id
  FOR UPDATE;

  IF v_pharmacy_id IS NULL THEN
    RAISE EXCEPTION 'pharmacy_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- 3) Plan destino activo
  SELECT p.id, p.key
    INTO v_new_plan_id, v_new_plan_key
  FROM public.plans p
  WHERE p.key = trim(p_new_plan_key)
    AND p.is_active = true;

  IF v_new_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_not_found_or_inactive: %', p_new_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  -- 4) El plan destino debe tener al menos un módulo activo
  IF NOT EXISTS (
    SELECT 1
    FROM public.plan_modules pm
    INNER JOIN public.modules m ON m.id = pm.module_id
    WHERE pm.plan_id = v_new_plan_id
      AND m.is_active = true
  ) THEN
    RAISE EXCEPTION 'plan_has_no_active_modules: %', p_new_plan_key
      USING ERRCODE = 'P0002';
  END IF;

  -- 5) Suscripción corriente (como máximo una por índice único parcial)
  SELECT s.id, s.status, s.plan_id
    INTO v_subscription_id, v_subscription_status, v_subscription_plan_id
  FROM public.subscriptions s
  WHERE s.pharmacy_id = v_pharmacy_id
    AND s.status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused'])
  FOR UPDATE;

  IF v_subscription_id IS NULL THEN
    -- Incluye: sin suscripción, o solo cancelled/expired
    RAISE EXCEPTION 'current_subscription_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- 6) Solo trialing|active permiten cambio en V1
  IF v_subscription_status NOT IN ('trialing', 'active') THEN
    RAISE EXCEPTION 'subscription_status_not_changeable: %', v_subscription_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Fuente comercial de verdad para "plan actual"
  v_old_plan_id := COALESCE(v_subscription_plan_id, v_old_plan_id);

  SELECT p.key
    INTO v_old_plan_key
  FROM public.plans p
  WHERE p.id = v_old_plan_id;

  -- 7) Mismo plan → no-op controlado
  IF v_old_plan_id IS NOT NULL AND v_old_plan_id = v_new_plan_id THEN
    RAISE EXCEPTION 'plan_already_current: %', v_new_plan_key
      USING ERRCODE = 'P0001';
  END IF;

  -- 8) Actualizar farmacia
  UPDATE public.pharmacies
  SET
    plan_id = v_new_plan_id,
    updated_by = v_uid
  WHERE id = v_pharmacy_id;

  -- 9) Actualizar suscripción corriente (conserva status)
  UPDATE public.subscriptions
  SET
    plan_id = v_new_plan_id,
    updated_by = v_uid
  WHERE id = v_subscription_id;

  -- 10) Downgrade / limpieza: cancelar entitlements source='plan' que ya no
  --     pertenecen al nuevo plan (no toca addon/comp/internal)
  UPDATE public.pharmacy_entitlements pe
  SET
    status = 'cancelled',
    ends_at = v_now,
    updated_by = v_uid
  WHERE pe.pharmacy_id = v_pharmacy_id
    AND pe.source = 'plan'
    AND pe.status IS DISTINCT FROM 'cancelled'
    AND NOT EXISTS (
      SELECT 1
      FROM public.plan_modules pm
      INNER JOIN public.modules m ON m.id = pm.module_id
      WHERE pm.plan_id = v_new_plan_id
        AND pm.module_id = pe.module_id
        AND m.is_active = true
    );

  -- 11) Alta / reactivación / actualización de entitlements del nuevo plan
  --     ON CONFLICT: solo actualiza filas source='plan' (no toca addon/comp/internal)
  INSERT INTO public.pharmacy_entitlements (
    pharmacy_id,
    module_id,
    status,
    source,
    source_plan_id,
    limits,
    config,
    starts_at,
    ends_at,
    created_by,
    updated_by
  )
  SELECT
    v_pharmacy_id,
    pm.module_id,
    'active',
    'plan',
    v_new_plan_id,
    COALESCE(pm.default_limits, '{}'::jsonb),
    '{}'::jsonb,
    v_now,
    NULL,
    v_uid,
    v_uid
  FROM public.plan_modules pm
  INNER JOIN public.modules m ON m.id = pm.module_id
  WHERE pm.plan_id = v_new_plan_id
    AND m.is_active = true
  ON CONFLICT (pharmacy_id, module_id) DO UPDATE
  SET
    status = 'active',
    source_plan_id = EXCLUDED.source_plan_id,
    limits = EXCLUDED.limits,
    ends_at = NULL,
    updated_by = EXCLUDED.updated_by
  WHERE public.pharmacy_entitlements.source = 'plan';

  -- 12) Auditoría (helpers seguros existentes; sin INSERT directo a audit_logs)
  PERFORM public.ff_write_audit_log(
    'pharmacy.plan_changed',
    v_pharmacy_id,
    'pharmacy',
    v_pharmacy_id::text,
    jsonb_build_object(
      'pharmacy_id', v_pharmacy_id,
      'actor_profile_id', v_uid,
      'old_plan_id', v_old_plan_id,
      'old_plan_key', v_old_plan_key,
      'new_plan_id', v_new_plan_id,
      'new_plan_key', v_new_plan_key,
      'subscription_id', v_subscription_id,
      'subscription_status', v_subscription_status,
      'changed_at', v_now
    )
  );

  PERFORM public.ff_record_activity_event(
    v_pharmacy_id,
    'pharmacy.plan_changed',
    'Cambio de plan',
    format(
      'Plan actualizado de %s a %s',
      COALESCE(v_old_plan_key, '—'),
      v_new_plan_key
    ),
    jsonb_build_object(
      'old_plan_key', v_old_plan_key,
      'new_plan_key', v_new_plan_key,
      'subscription_status', v_subscription_status,
      'changed_at', v_now
    )
  );

  RETURN v_pharmacy_id;
END;
$$;

COMMENT ON FUNCTION public.ff_change_pharmacy_plan_v1(uuid, text) IS
  '084: cambio plan kernel/legacy. Rechaza comerciales (usar ff_assign_commercial_plan_v1).';

-- -----------------------------------------------------------------------------
-- B) Plazas launch_2027
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_launch_cohort_counters (
  cohort_key text PRIMARY KEY,
  max_slots integer NOT NULL CHECK (max_slots > 0),
  used_slots integer NOT NULL DEFAULT 0 CHECK (used_slots >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT commercial_launch_cohort_counters_used_le_max_chk CHECK (used_slots <= max_slots)
);

INSERT INTO public.commercial_launch_cohort_counters (cohort_key, max_slots, used_slots, notes)
VALUES (
  'launch_2027', 20, 0,
  'Dto. −60 % sobre lista → 39/69/99 €. Contador de plazas activas.'
)
ON CONFLICT (cohort_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.commercial_launch_seat_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key text NOT NULL DEFAULT 'launch_2027'
    REFERENCES public.commercial_launch_cohort_counters (cohort_key),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  commercial_sku_key text NOT NULL,
  list_monthly_cents integer NOT NULL CHECK (list_monthly_cents >= 0),
  promo_monthly_cents integer NOT NULL CHECK (promo_monthly_cents >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released')),
  reserved_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  reserved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  released_at timestamptz,
  release_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT commercial_launch_seat_pharmacy_uid UNIQUE (cohort_key, pharmacy_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_launch_seat_one_active_per_pharmacy
  ON public.commercial_launch_seat_reservations (cohort_key, pharmacy_id)
  WHERE status = 'active';

COMMENT ON TABLE public.commercial_launch_seat_reservations IS
  'Plaza promocional launch_2027 por farmacia. Una fila/farmacia; active|released. No es el plan contratado.';

CREATE OR REPLACE FUNCTION public.ff_launch_promo_cents_v1(p_sku text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(p_sku))
    WHEN 'general' THEN 3900
    WHEN 'personalized' THEN 6900
    WHEN 'ai_personalized' THEN 9900
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.ff_list_monthly_cents_v1(p_sku text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(p_sku))
    WHEN 'general' THEN 9750
    WHEN 'personalized' THEN 17250
    WHEN 'ai_personalized' THEN 24750
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.ff_release_launch_seat_v1(
  p_pharmacy_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_row public.commercial_launch_seat_reservations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'released', false, 'note', 'no_active_seat');
  END IF;

  UPDATE public.commercial_launch_seat_reservations
  SET status = 'released',
      released_at = v_now,
      release_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
      updated_at = v_now
  WHERE id = v_row.id;

  UPDATE public.commercial_launch_cohort_counters
  SET used_slots = GREATEST(used_slots - 1, 0),
      updated_at = v_now
  WHERE cohort_key = 'launch_2027';

  RETURN jsonb_build_object(
    'status', 'ok',
    'released', true,
    'reservation_id', v_row.id,
    'pharmacy_id', p_pharmacy_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ff_reserve_launch_2027_seat_v1(
  p_pharmacy_id uuid,
  p_commercial_sku_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_sku text := lower(btrim(coalesce(p_commercial_sku_key, '')));
  v_list integer;
  v_promo integer;
  v_counter public.commercial_launch_cohort_counters%ROWTYPE;
  v_existing public.commercial_launch_seat_reservations%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.subscriptions.manage') THEN
    RAISE EXCEPTION 'forbidden_subscriptions_manage' USING ERRCODE = '42501';
  END IF;

  v_list := public.ff_list_monthly_cents_v1(v_sku);
  v_promo := public.ff_launch_promo_cents_v1(v_sku);
  IF v_list IS NULL OR v_promo IS NULL THEN
    RAISE EXCEPTION 'launch_promo_sku_invalid: %', v_sku USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = p_pharmacy_id) THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Lock contador (serializa concurrencia)
  SELECT * INTO v_counter
  FROM public.commercial_launch_cohort_counters
  WHERE cohort_key = 'launch_2027'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'launch_counter_missing' USING ERRCODE = 'P0002';
  END IF;

  -- ¿Ya tiene plaza? (idempotente; actualiza SKU si cambia de plan con promo)
  SELECT * INTO v_existing
  FROM public.commercial_launch_seat_reservations
  WHERE cohort_key = 'launch_2027'
    AND pharmacy_id = p_pharmacy_id
  FOR UPDATE;

  IF FOUND AND v_existing.status = 'active' THEN
    UPDATE public.commercial_launch_seat_reservations
    SET commercial_sku_key = v_sku,
        list_monthly_cents = v_list,
        promo_monthly_cents = v_promo,
        updated_at = v_now,
        metadata = metadata || jsonb_build_object('last_sku_update', v_now)
    WHERE id = v_existing.id;
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'reservation_id', v_existing.id,
      'pharmacy_id', p_pharmacy_id,
      'promo_monthly_cents', v_promo,
      'list_monthly_cents', v_list
    );
  END IF;

  IF FOUND AND v_existing.status = 'released' THEN
    -- Re-activar plaza propia no consume una plaza nueva si aún hay hueco
    -- global: cuenta como used++ solo si estaba released (ya decrementada).
    IF v_counter.used_slots >= v_counter.max_slots THEN
      RAISE EXCEPTION 'launch_slots_exhausted'
        USING ERRCODE = '23514',
              MESSAGE = 'No quedan plazas de lanzamiento 2027 (máx. 20).';
    END IF;
    UPDATE public.commercial_launch_seat_reservations
    SET status = 'active',
        commercial_sku_key = v_sku,
        list_monthly_cents = v_list,
        promo_monthly_cents = v_promo,
        reserved_at = v_now,
        reserved_by = v_uid,
        released_at = NULL,
        release_reason = NULL,
        updated_at = v_now
    WHERE id = v_existing.id
    RETURNING id INTO v_id;

    UPDATE public.commercial_launch_cohort_counters
    SET used_slots = used_slots + 1, updated_at = v_now
    WHERE cohort_key = 'launch_2027';

    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', false,
      'reactivated', true,
      'reservation_id', v_id,
      'pharmacy_id', p_pharmacy_id,
      'promo_monthly_cents', v_promo,
      'list_monthly_cents', v_list
    );
  END IF;

  IF v_counter.used_slots >= v_counter.max_slots THEN
    RAISE EXCEPTION 'launch_slots_exhausted'
      USING ERRCODE = '23514',
            MESSAGE = 'No quedan plazas de lanzamiento 2027 (máx. 20).';
  END IF;

  INSERT INTO public.commercial_launch_seat_reservations (
    cohort_key, pharmacy_id, commercial_sku_key,
    list_monthly_cents, promo_monthly_cents, status,
    reserved_at, reserved_by
  ) VALUES (
    'launch_2027', p_pharmacy_id, v_sku,
    v_list, v_promo, 'active',
    v_now, v_uid
  )
  RETURNING id INTO v_id;

  UPDATE public.commercial_launch_cohort_counters
  SET used_slots = used_slots + 1, updated_at = v_now
  WHERE cohort_key = 'launch_2027';

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'reservation_id', v_id,
    'pharmacy_id', p_pharmacy_id,
    'promo_monthly_cents', v_promo,
    'list_monthly_cents', v_list,
    'slots_remaining', v_counter.max_slots - (v_counter.used_slots + 1)
  );
END;
$$;

ALTER TABLE public.commercial_launch_seat_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_launch_seat_reservations_select
  ON public.commercial_launch_seat_reservations;
CREATE POLICY commercial_launch_seat_reservations_select
  ON public.commercial_launch_seat_reservations
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
  );

DROP POLICY IF EXISTS commercial_launch_seat_reservations_write
  ON public.commercial_launch_seat_reservations;
CREATE POLICY commercial_launch_seat_reservations_write
  ON public.commercial_launch_seat_reservations
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );

GRANT SELECT ON public.commercial_launch_seat_reservations TO authenticated;
GRANT INSERT, UPDATE ON public.commercial_launch_seat_reservations TO authenticated;

REVOKE ALL ON FUNCTION public.ff_reserve_launch_2027_seat_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_reserve_launch_2027_seat_v1(uuid, text)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.ff_release_launch_seat_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_release_launch_seat_v1(uuid, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- C) Redefinir assign con p_use_launch_promo (DROP overload 4-arg)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ff_assign_commercial_plan_v1(uuid, text, text, boolean);

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

  -- Promo / release seats (atómico con el resto)
  IF coalesce(p_use_launch_promo, false) AND (v_effects->>'is_pilot')::boolean IS NOT TRUE THEN
    v_launch := public.ff_reserve_launch_2027_seat_v1(p_pharmacy_id, v_sku);
  ELSIF (v_effects->>'is_pilot')::boolean OR NOT coalesce(p_use_launch_promo, false) THEN
    -- Sin promo o destino piloto: liberar plaza si existía
    v_launch := public.ff_release_launch_seat_v1(
      p_pharmacy_id,
      CASE
        WHEN (v_effects->>'is_pilot')::boolean THEN 'assign_pilot'
        ELSE coalesce(v_reason, 'assign_without_launch_promo')
      END
    );
  END IF;

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
  '084: asigna plan comercial + entitlements + catalog_mode; opcional reserva plaza launch_2027. Atómico.';

REVOKE ALL ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean, boolean)
  TO authenticated, service_role;
