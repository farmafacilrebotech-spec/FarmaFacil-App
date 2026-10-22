-- =============================================================================
-- 050_commercial_trial_rpcs_v1.sql
-- RPCs comerciales: tarifas, readiness, prepare/activate/extend/end de piloto 15d.
--
-- Perfil piloto (igual para todos, independiente del plan interno elegido):
--   Módulos: kernel, pharmacies, users, branding, entrypoint_qr, orders
--   Límites: max_users=3, max_products=500 (perfil starter)
--   Asistente: SOLO mode=demo (genérico), obligatorio en activate
--   Kiosko: NUNCA
--   Asistente contracted / consult farmacéutico: NUNCA en piloto
--
-- Activate es atómico (una transacción INVOKER):
--   1) readiness obligatorio
--   2) assistant demo (si falla → ROLLBACK; no arrancan los 15 días)
--   3) subscription trialing + pharmacy active + trial active
--
-- Depende de: 028, 042, 045, 047, 048, 049.
-- NO APLICAR sin autorización expresa.
-- =============================================================================

-- Mínimo de productos demo activos (plantilla actual farmafacil_demo_v1 = 30).
-- Cuando la plantilla pase a 100, subir esta constante en una migración posterior.
CREATE OR REPLACE FUNCTION public.ff_commercial_pilot_min_demo_products()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$ SELECT 30; $$;

CREATE OR REPLACE FUNCTION public.ff_pharmacy_has_current_subscription(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.pharmacy_id = p_pharmacy_id
      AND s.status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused'])
  );
$$;

REVOKE ALL ON FUNCTION public.ff_pharmacy_has_current_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_has_current_subscription(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Aplica entitlements del perfil piloto (no hereda límites pro/business/enterprise)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_pilot_apply_entitlement_profile_v1(
  p_pharmacy_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_plan_id uuid;
  -- max_products es tope técnico jsonb (poco enforced hoy); NO habilita catálogo propio.
  -- catalog_mode=generic_demo_only: señal comercial para UI/gates (solo plantilla demo).
  v_limits jsonb := jsonb_build_object(
    'max_users', 3,
    'max_products', 500,
    'commercial_profile', 'pilot_v1',
    'catalog_mode', 'generic_demo_only'
  );
  v_allow text[] := ARRAY[
    'kernel', 'pharmacies', 'users', 'branding', 'entrypoint_qr', 'orders'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  -- RLS pharmacy_entitlements exige platform.entitlements.manage
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION 'forbidden_entitlements_manage' USING ERRCODE = '42501';
  END IF;

  SELECT plan_id INTO v_plan_id
  FROM public.pharmacies
  WHERE id = p_pharmacy_id;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'pharmacy_plan_required' USING ERRCODE = '23514';
  END IF;

  -- Cancelar entitlements de plan fuera del allowlist (p.ej. futuros módulos premium)
  UPDATE public.pharmacy_entitlements pe
  SET
    status = 'cancelled',
    ends_at = v_now,
    updated_by = v_uid,
    updated_at = v_now
  FROM public.modules m
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.module_id = m.id
    AND pe.source = 'plan'
    AND pe.status IS DISTINCT FROM 'cancelled'
    AND m.key <> ALL (v_allow);

  -- Nunca dejar kiosk usable en piloto
  UPDATE public.pharmacy_entitlements pe
  SET
    status = 'cancelled',
    ends_at = v_now,
    updated_by = v_uid,
    updated_at = v_now
  FROM public.modules m
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.module_id = m.id
    AND m.key = 'kiosk'
    AND pe.status IS DISTINCT FROM 'cancelled';

  -- Nunca dejar assistant contracted en piloto (demo se gestiona en activate)
  UPDATE public.pharmacy_entitlements pe
  SET
    status = 'cancelled',
    ends_at = v_now,
    config = coalesce(pe.config, '{}'::jsonb) || jsonb_build_object('mode', 'off'),
    updated_by = v_uid,
    updated_at = v_now
  FROM public.modules m
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.module_id = m.id
    AND m.key = 'assistant_ai'
    AND pe.status IS DISTINCT FROM 'cancelled'
    AND coalesce(pe.config->>'mode', '') = 'contracted';

  -- Upsert allowlist con límites piloto fijos
  INSERT INTO public.pharmacy_entitlements (
    pharmacy_id, module_id, status, source, source_plan_id,
    limits, config, starts_at, created_by, updated_by
  )
  SELECT
    p_pharmacy_id,
    m.id,
    'active',
    'plan',
    v_plan_id,
    v_limits,
    jsonb_build_object(
      'commercial_profile', 'pilot_v1',
      'catalog_mode', 'generic_demo_only'
    ),
    v_now,
    v_uid,
    v_uid
  FROM public.modules m
  WHERE m.key = ANY (v_allow)
    AND m.is_active = true
  ON CONFLICT (pharmacy_id, module_id) DO UPDATE
  SET
    status = 'active',
    source = 'plan',
    source_plan_id = EXCLUDED.source_plan_id,
    limits = v_limits,
    config = jsonb_build_object(
      'commercial_profile', 'pilot_v1',
      'catalog_mode', 'generic_demo_only'
    ),
    ends_at = NULL,
    updated_by = v_uid,
    updated_at = v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_pilot_apply_entitlement_profile_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_pilot_apply_entitlement_profile_v1(uuid)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- Readiness: condiciones obligatorias antes de activar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_trial_readiness_v1(
  p_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ph public.pharmacies%ROWTYPE;
  v_trial public.pharmacy_commercial_trials%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_ok boolean := true;
  v_ep_ok boolean;
  v_owner_ok boolean;
  v_demo_count integer;
  v_demo_ok boolean;
  v_orders_ok boolean;
  v_assistant_module_ok boolean;
  v_assistant_settings_ok boolean;
  v_min integer := public.ff_commercial_pilot_min_demo_products();
BEGIN
  SELECT * INTO v_ph FROM public.pharmacies WHERE id = p_pharmacy_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ready', false,
      'checks', jsonb_build_array(
        jsonb_build_object('key', 'pharmacy', 'ok', false, 'detail', 'not_found')
      )
    );
  END IF;

  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'pharmacy_status',
      'ok', v_ph.status = 'pending_setup',
      'detail', v_ph.status,
      'required', 'pending_setup'
    )
  );
  IF v_ph.status IS DISTINCT FROM 'pending_setup' THEN
    v_ok := false;
  END IF;

  SELECT * INTO v_trial
  FROM public.pharmacy_commercial_trials t
  WHERE t.pharmacy_id = p_pharmacy_id
    AND t.status = ANY (ARRAY['draft', 'ready', 'active', 'extended'])
  ORDER BY t.created_at DESC
  LIMIT 1;

  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'trial_ready',
      'ok', FOUND AND v_trial.status = 'ready',
      'detail', CASE WHEN FOUND THEN v_trial.status ELSE 'missing' END
    )
  );
  IF NOT (FOUND AND v_trial.status = 'ready') THEN
    v_ok := false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.public_entrypoints pe
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND pe.purpose = 'pharmacy_home'
      AND pe.is_active = true
      AND pe.public_id IS NOT NULL
  ) INTO v_ep_ok;

  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object('key', 'qr_entrypoint', 'ok', v_ep_ok)
  );
  IF NOT v_ep_ok THEN v_ok := false; END IF;

  -- Acceso dashboard tenant: solo membership status=active (invited NO autoriza).
  -- Espejo de requireActivePharmacyMembership / resolveTenantRouteDecision.
  SELECT EXISTS (
    SELECT 1
    FROM public.pharmacy_memberships pm
    INNER JOIN public.roles r ON r.id = pm.role_id
    WHERE pm.pharmacy_id = p_pharmacy_id
      AND r.key = 'PHARMACY_OWNER'
      AND pm.status = 'active'
  ) INTO v_owner_ok;

  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'owner_active',
      'ok', v_owner_ok,
      'detail', 'Requiere titular OWNER con membership active (no basta invited)'
    )
  );
  IF NOT v_owner_ok THEN v_ok := false; END IF;

  SELECT count(*)::integer INTO v_demo_count
  FROM public.pharmacy_products pp
  WHERE pp.pharmacy_id = p_pharmacy_id
    AND pp.source = 'demo'
    AND pp.is_active = true
    AND pp.source_ref LIKE 'farmafacil_demo_v1:%';

  v_demo_ok := v_demo_count >= v_min;
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'generic_catalog',
      'ok', v_demo_ok,
      'detail', format('%s/%s productos demo activos', v_demo_count, v_min)
    )
  );
  IF NOT v_demo_ok THEN v_ok := false; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pharmacy_entitlements pe
    INNER JOIN public.modules m ON m.id = pe.module_id
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND m.key = 'orders'
      AND m.is_active = true
      AND pe.status = 'active'
  ) INTO v_orders_ok;

  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object('key', 'orders_entitlement', 'ok', v_orders_ok)
  );
  IF NOT v_orders_ok THEN v_ok := false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.key = 'assistant_ai' AND m.is_active = true
  ) INTO v_assistant_module_ok;

  SELECT EXISTS (
    SELECT 1 FROM public.pharmacy_assistant_settings s
    WHERE s.pharmacy_id = p_pharmacy_id
  ) INTO v_assistant_settings_ok;

  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object('key', 'assistant_module', 'ok', v_assistant_module_ok),
    jsonb_build_object(
      'key', 'assistant_settings_prepared',
      'ok', v_assistant_settings_ok,
      'detail', 'Fila settings sin entitlement contracted; demo se activa en activate'
    )
  );
  IF NOT v_assistant_module_ok OR NOT v_assistant_settings_ok THEN
    v_ok := false;
  END IF;

  -- No debe haber suscripción corriente ni kiosk activo ni assistant contracted
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'no_current_subscription',
      'ok', NOT public.ff_pharmacy_has_current_subscription(p_pharmacy_id)
    ),
    jsonb_build_object(
      'key', 'no_kiosk_entitlement',
      'ok', NOT EXISTS (
        SELECT 1
        FROM public.pharmacy_entitlements pe
        INNER JOIN public.modules m ON m.id = pe.module_id
        WHERE pe.pharmacy_id = p_pharmacy_id
          AND m.key = 'kiosk'
          AND pe.status IN ('active', 'trial')
      )
    ),
    jsonb_build_object(
      'key', 'no_assistant_contracted',
      'ok', NOT EXISTS (
        SELECT 1
        FROM public.pharmacy_entitlements pe
        INNER JOIN public.modules m ON m.id = pe.module_id
        WHERE pe.pharmacy_id = p_pharmacy_id
          AND m.key = 'assistant_ai'
          AND pe.status IN ('active', 'trial')
          AND coalesce(pe.config->>'mode', '') = 'contracted'
      )
    )
  );

  IF public.ff_pharmacy_has_current_subscription(p_pharmacy_id) THEN
    v_ok := false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.pharmacy_entitlements pe
    INNER JOIN public.modules m ON m.id = pe.module_id
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND m.key = 'kiosk'
      AND pe.status IN ('active', 'trial')
  ) THEN
    v_ok := false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.pharmacy_entitlements pe
    INNER JOIN public.modules m ON m.id = pe.module_id
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND m.key = 'assistant_ai'
      AND pe.status IN ('active', 'trial')
      AND coalesce(pe.config->>'mode', '') = 'contracted'
  ) THEN
    v_ok := false;
  END IF;

  RETURN jsonb_build_object(
    'ready', v_ok,
    'pharmacy_id', p_pharmacy_id,
    'min_demo_products', v_min,
    'checks', v_checks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_trial_readiness_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_readiness_v1(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Publicar versión de tarifa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_publish_commercial_tariff_version_v1(
  p_version_label text,
  p_vat_bps integer,
  p_saas_annual_discount_bps integer,
  p_kiosk_license_annual_discount_bps integer,
  p_kiosk_hardware_unit_cents bigint,
  p_kiosk_license_monthly_cents bigint,
  p_kiosk_internal_cost_cents bigint,
  p_plan_prices jsonb,
  p_notes text DEFAULT NULL,
  p_kiosk_cost_personalization_cents bigint DEFAULT 0,
  p_kiosk_cost_shipping_cents bigint DEFAULT 0,
  p_kiosk_cost_configuration_cents bigint DEFAULT 0,
  p_kiosk_cost_other_cents bigint DEFAULT 0,
  p_default_onsite_install_cents bigint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_version_id uuid;
  v_item jsonb;
  v_sku_id uuid;
  v_monthly bigint;
  v_annual bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_tariffs.write') THEN
    RAISE EXCEPTION 'forbidden_commercial_tariffs_write' USING ERRCODE = '42501';
  END IF;
  -- Necesario para ff_write_audit_log sin pharmacy_id
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;

  UPDATE public.commercial_tariff_versions
  SET is_current = false
  WHERE is_current = true;

  INSERT INTO public.commercial_tariff_versions (
    version_label, is_current, vat_bps, saas_annual_discount_bps,
    kiosk_license_annual_discount_bps, kiosk_hardware_unit_cents,
    kiosk_license_monthly_cents, kiosk_internal_cost_cents,
    kiosk_cost_personalization_cents, kiosk_cost_shipping_cents,
    kiosk_cost_configuration_cents, kiosk_cost_other_cents,
    default_onsite_install_cents, snapshot, notes, created_by
  )
  VALUES (
    trim(p_version_label), true, p_vat_bps, p_saas_annual_discount_bps,
    p_kiosk_license_annual_discount_bps, p_kiosk_hardware_unit_cents,
    p_kiosk_license_monthly_cents, p_kiosk_internal_cost_cents,
    coalesce(p_kiosk_cost_personalization_cents, 0),
    coalesce(p_kiosk_cost_shipping_cents, 0),
    coalesce(p_kiosk_cost_configuration_cents, 0),
    coalesce(p_kiosk_cost_other_cents, 0),
    coalesce(p_default_onsite_install_cents, 0),
    jsonb_build_object(
      'vat_bps', p_vat_bps,
      'saas_annual_discount_bps', p_saas_annual_discount_bps,
      'kiosk_license_annual_discount_bps', p_kiosk_license_annual_discount_bps,
      'kiosk_hardware_unit_cents', p_kiosk_hardware_unit_cents,
      'kiosk_license_monthly_cents', p_kiosk_license_monthly_cents,
      'kiosk_internal_cost_cents', p_kiosk_internal_cost_cents,
      'plan_prices', coalesce(p_plan_prices, '[]'::jsonb)
    ),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    v_uid
  )
  RETURNING id INTO v_version_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_plan_prices, '[]'::jsonb))
  LOOP
    SELECT s.id INTO v_sku_id
    FROM public.commercial_plan_skus s
    WHERE s.key = trim(v_item->>'key');
    IF v_sku_id IS NULL THEN
      RAISE EXCEPTION 'unknown_commercial_sku: %', v_item->>'key' USING ERRCODE = 'P0002';
    END IF;
    v_monthly := coalesce((v_item->>'monthly_cents')::bigint, 0);
    v_annual := coalesce((v_item->>'annual_cents')::bigint, 0);
    INSERT INTO public.commercial_plan_price_versions (
      tariff_version_id, sku_id, monthly_cents, annual_cents, trial_days, extension_days
    ) VALUES (
      v_version_id, v_sku_id, v_monthly, v_annual,
      NULLIF((v_item->>'trial_days')::integer, 0),
      NULLIF((v_item->>'extension_days')::integer, 0)
    );
  END LOOP;

  PERFORM public.ff_write_audit_log(
    'commercial.tariff.publish', NULL, 'commercial_tariff_version',
    v_version_id::text,
    jsonb_build_object('version_label', trim(p_version_label)),
    NULL, NULL
  );
  RETURN v_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_publish_commercial_tariff_version_v1(
  text, integer, integer, integer, bigint, bigint, bigint, jsonb, text,
  bigint, bigint, bigint, bigint, bigint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_publish_commercial_tariff_version_v1(
  text, integer, integer, integer, bigint, bigint, bigint, jsonb, text,
  bigint, bigint, bigint, bigint, bigint
) TO authenticated;

-- -----------------------------------------------------------------------------
-- Prepare trial (ready) + perfil entitlements + settings assistant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_trial_prepare_v1(
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
  v_ph public.pharmacies%ROWTYPE;
  v_trial public.pharmacy_commercial_trials%ROWTYPE;
  v_starter_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_trials.manage') THEN
    RAISE EXCEPTION 'forbidden_commercial_trials' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION 'forbidden_entitlements_manage' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ph FROM public.pharmacies WHERE id = p_pharmacy_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_ph.status IN ('suspended', 'archived') THEN
    RAISE EXCEPTION 'pharmacy_not_preparable_status' USING ERRCODE = '23514';
  END IF;
  IF public.ff_pharmacy_has_current_subscription(p_pharmacy_id) THEN
    RAISE EXCEPTION 'pharmacy_has_current_subscription' USING ERRCODE = '23505';
  END IF;

  -- Forzar plan interno starter (mismos módulos; evita límites enterprise)
  SELECT id INTO v_starter_id FROM public.plans WHERE key = 'starter' AND is_active;
  IF v_starter_id IS NULL THEN
    RAISE EXCEPTION 'starter_plan_missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_ph.plan_id IS DISTINCT FROM v_starter_id THEN
    UPDATE public.pharmacies
    SET plan_id = v_starter_id, updated_by = v_uid
    WHERE id = p_pharmacy_id;
  END IF;

  PERFORM public.ff_commercial_pilot_apply_entitlement_profile_v1(p_pharmacy_id);

  INSERT INTO public.pharmacy_assistant_settings (pharmacy_id, updated_by)
  VALUES (p_pharmacy_id, v_uid)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  SELECT * INTO v_trial
  FROM public.pharmacy_commercial_trials t
  WHERE t.pharmacy_id = p_pharmacy_id
    AND t.status = ANY (ARRAY['draft', 'ready', 'active', 'extended'])
  FOR UPDATE;

  IF FOUND AND v_trial.status IN ('active', 'extended') THEN
    RAISE EXCEPTION 'commercial_trial_already_running' USING ERRCODE = '23505';
  END IF;

  IF FOUND AND v_trial.status IN ('draft', 'ready') THEN
    UPDATE public.pharmacy_commercial_trials
    SET status = 'ready', prepared_at = coalesce(prepared_at, v_now), updated_by = v_uid
    WHERE id = v_trial.id
    RETURNING * INTO v_trial;
  ELSE
    INSERT INTO public.pharmacy_commercial_trials (
      pharmacy_id, program, status, prepared_at, created_by, updated_by
    ) VALUES (
      p_pharmacy_id, 'commercial_v1_15d', 'ready', v_now, v_uid, v_uid
    )
    RETURNING * INTO v_trial;
  END IF;

  UPDATE public.pharmacies
  SET status = 'pending_setup', updated_by = v_uid
  WHERE id = p_pharmacy_id
    AND status IS DISTINCT FROM 'pending_setup'
    AND status NOT IN ('suspended', 'archived');

  PERFORM public.ff_write_audit_log(
    'commercial.trial.prepare', p_pharmacy_id, 'pharmacy_commercial_trial',
    v_trial.id::text,
    jsonb_build_object('status', 'ready', 'plan_forced', 'starter'),
    NULL, NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'trial_id', v_trial.id,
    'trial_status', 'ready',
    'readiness', public.ff_commercial_trial_readiness_v1(p_pharmacy_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_trial_prepare_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_prepare_v1(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Activate (atómico en UNA transacción PostgreSQL del caller):
--   readiness → assistant demo (DEFINER, mismos writes en esta TX) → subscription
--   Cualquier RAISE revierte entitlement demo + subscription + pharmacy/trial.
--   activate_demo NO exige suscripción ni ff_pharmacy_is_operable (solo permisos
--   platform + INSERT/UPDATE entitlements/settings). Sin side-effects externos
--   (email/HTTP): rollback completo es efectivo.
-- -----------------------------------------------------------------------------
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
  -- Obligatorio: sin este permiso no hay activate_demo → fallar antes de contar días
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION 'forbidden_entitlements_manage'
      USING ERRCODE = '42501',
            MESSAGE = 'Se requiere platform.entitlements.manage para activar el asistente genérico del piloto.';
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

  -- Reaplicar perfil piloto (idempotente) antes de readiness
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
    RAISE EXCEPTION 'commercial_trial_not_ready_checklist'
      USING ERRCODE = '23514',
            MESSAGE = 'Faltan condiciones obligatorias para activar el piloto.',
            DETAIL = v_ready::text;
  END IF;

  v_end := v_now + interval '15 days';

  -- 1) Asistente genérico PRIMERO (si falla, no hay subscription ni días)
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
    RAISE EXCEPTION 'commercial_trial_assistant_demo_failed'
      USING ERRCODE = 'P0001',
            MESSAGE = 'No se pudo habilitar el asistente genérico; el piloto no se activa.',
            DETAIL = coalesce(v_assistant::text, 'null');
  END IF;

  IF NOT public.ff_pharmacy_has_module(p_pharmacy_id, 'assistant_ai') THEN
    RAISE EXCEPTION 'commercial_trial_assistant_not_usable'
      USING ERRCODE = 'P0001',
            MESSAGE = 'El módulo assistant_ai no quedó usable tras activate_demo.';
  END IF;

  -- 2) Suscripción 15d (arranca el reloj comercial)
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
    RAISE EXCEPTION 'pharmacy_has_current_subscription'
      USING ERRCODE = '23505',
            MESSAGE = 'Conflicto de concurrencia: ya existe suscripción corriente.';
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_activate_v1(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Extend +15d (una sola vez; vencido → now()+15d)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_trial_extend_v1(
  p_pharmacy_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');
  v_trial public.pharmacy_commercial_trials%ROWTYPE;
  v_new_end timestamptz;
  v_was_expired boolean;
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
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'extension_reason_required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_trial
  FROM public.pharmacy_commercial_trials t
  WHERE t.pharmacy_id = p_pharmacy_id
    AND t.program = 'commercial_v1_15d'
    AND t.status = ANY (ARRAY['active', 'extended', 'ended'])
  ORDER BY t.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commercial_trial_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_trial.extension_used THEN
    RAISE EXCEPTION 'commercial_trial_extension_already_used' USING ERRCODE = '23514';
  END IF;

  v_was_expired := (v_trial.ends_at IS NULL OR v_trial.ends_at <= v_now);
  IF v_was_expired THEN
    v_new_end := v_now + interval '15 days';
  ELSE
    v_new_end := v_trial.ends_at + interval '15 days';
  END IF;

  UPDATE public.pharmacy_commercial_trials
  SET
    status = 'extended',
    ends_at = v_new_end,
    extension_used = true,
    extended_at = v_now,
    extended_by = v_uid,
    extension_reason = v_reason,
    ended_at = NULL,
    updated_by = v_uid
  WHERE id = v_trial.id
  RETURNING * INTO v_trial;

  IF v_trial.subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET status = 'trialing', trial_end = v_new_end, current_period_end = v_new_end, updated_by = v_uid
    WHERE id = v_trial.subscription_id;
  END IF;

  UPDATE public.pharmacies
  SET status = 'active', updated_by = v_uid
  WHERE id = p_pharmacy_id
    AND status NOT IN ('suspended', 'archived');

  -- Alinear demo assistant (no contracted)
  UPDATE public.pharmacy_entitlements pe
  SET ends_at = v_new_end, status = 'trial', updated_by = v_uid
  FROM public.modules m
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.module_id = m.id
    AND m.key = 'assistant_ai'
    AND pe.source = 'addon'
    AND coalesce(pe.config->>'mode', '') = 'demo';

  PERFORM public.ff_write_audit_log(
    'commercial.trial.extend', p_pharmacy_id, 'pharmacy_commercial_trial',
    v_trial.id::text,
    jsonb_build_object(
      'reason', v_reason, 'was_expired', v_was_expired, 'new_ends_at', v_new_end
    ),
    NULL, NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'trial_id', v_trial.id,
    'trial_status', 'extended',
    'was_expired', v_was_expired,
    'ends_at', v_new_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_trial_extend_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_extend_v1(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- End trial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_trial_end_v1(
  p_pharmacy_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_trial public.pharmacy_commercial_trials%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_trials.manage') THEN
    RAISE EXCEPTION 'forbidden_commercial_trials' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_trial
  FROM public.pharmacy_commercial_trials t
  WHERE t.pharmacy_id = p_pharmacy_id
    AND t.status = ANY (ARRAY['active', 'extended'])
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commercial_trial_not_running' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.pharmacy_commercial_trials
  SET status = 'ended', ended_at = v_now, updated_by = v_uid
  WHERE id = v_trial.id
  RETURNING * INTO v_trial;

  IF v_trial.subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET status = 'expired', updated_by = v_uid
    WHERE id = v_trial.subscription_id AND status = 'trialing';
  END IF;

  PERFORM public.ff_write_audit_log(
    'commercial.trial.end', p_pharmacy_id, 'pharmacy_commercial_trial',
    v_trial.id::text,
    jsonb_build_object('reason', NULLIF(btrim(coalesce(p_reason, '')), '')),
    NULL, NULL
  );

  RETURN jsonb_build_object('status', 'ok', 'trial_id', v_trial.id, 'trial_status', 'ended');
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_trial_end_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_end_v1(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.ff_commercial_pilot_min_demo_products() TO authenticated;

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_commercial_trial_end_v1(uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_commercial_trial_extend_v1(uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_commercial_trial_activate_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_commercial_trial_prepare_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_publish_commercial_tariff_version_v1(text, integer, integer, integer, bigint, bigint, bigint, jsonb, text, bigint, bigint, bigint, bigint, bigint);
-- DROP FUNCTION IF EXISTS public.ff_commercial_trial_readiness_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_commercial_pilot_apply_entitlement_profile_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_has_current_subscription(uuid);
-- DROP FUNCTION IF EXISTS public.ff_commercial_pilot_min_demo_products();
