-- =============================================================================
-- 083_00_ff_assign_commercial_plan_from_056_v1.sql
-- Promoción a migraciones del draft 056 (idempotente).
-- Debe aplicarse ANTES de 083_commercial_plans_activation_v1 en entornos nuevos.
-- En staging (056 ya aplicado) es no-op seguro (CREATE IF NOT EXISTS / OR REPLACE).
-- NO backfill. NO migra suscripciones existentes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_commercial_assignments (
  pharmacy_id uuid PRIMARY KEY
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  commercial_sku_key text NOT NULL
    REFERENCES public.commercial_plan_skus (key),
  technical_plan_key text NOT NULL,
  catalog_mode text NOT NULL DEFAULT 'generic'
    CHECK (catalog_mode = ANY (ARRAY['generic', 'own'])),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles (id),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pharmacy_commercial_assignments IS
  'SKU comercial vigente por farmacia. Sin facturación; espejo operativo de 056.';

CREATE TRIGGER pharmacy_commercial_assignments_set_updated_at
  BEFORE UPDATE ON public.pharmacy_commercial_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.pharmacy_commercial_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharmacy_commercial_assignments_select
  ON public.pharmacy_commercial_assignments;
CREATE POLICY pharmacy_commercial_assignments_select
  ON public.pharmacy_commercial_assignments
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_trials.manage')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
  );

DROP POLICY IF EXISTS pharmacy_commercial_assignments_write
  ON public.pharmacy_commercial_assignments;
CREATE POLICY pharmacy_commercial_assignments_write
  ON public.pharmacy_commercial_assignments
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );

GRANT SELECT ON public.pharmacy_commercial_assignments TO authenticated;
GRANT INSERT, UPDATE ON public.pharmacy_commercial_assignments TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) Helper: mapa SKU → plan técnico + modalidad + perfil asistente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_sku_effects_v1(p_sku_key text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_key text := lower(btrim(coalesce(p_sku_key, '')));
BEGIN
  IF v_key = 'pilot' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'generic',
      'technical_plan_key', 'starter',
      'assistant_action', 'none',
      'profile', 'pilot_v1',
      'creates_paid_subscription', false,
      'attach_master', true,
      'is_pilot', true
    );
  ELSIF v_key = 'general' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'generic',
      -- 083+: plan técnico comercial `general` (no starter).
      'technical_plan_key', 'general',
      'assistant_action', 'none',
      'profile', 'general_v1',
      'creates_paid_subscription', true,
      'attach_master', true,
      'is_pilot', false
    );
  ELSIF v_key = 'personalized' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'own',
      'technical_plan_key', 'personalizado',
      'assistant_action', 'none',
      'profile', 'personalized_v1',
      'creates_paid_subscription', true,
      'attach_master', false,
      'is_pilot', false
    );
  ELSIF v_key = 'ai_personalized' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'own',
      'technical_plan_key', 'asistente_ia_personalizado',
      'assistant_action', 'activate_contracted',
      'profile', 'ai_personalized_v1',
      'creates_paid_subscription', true,
      'attach_master', false,
      'is_pilot', false
    );
  END IF;
  RAISE EXCEPTION 'unknown_commercial_sku: %', v_key USING ERRCODE = 'P0002';
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_sku_effects_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_sku_effects_v1(text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) RPC principal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_assign_commercial_plan_v1(
  p_pharmacy_id uuid,
  p_commercial_plan_key text,
  p_reason text DEFAULT NULL,
  p_end_open_pilot boolean DEFAULT false
  -- Sin parámetro de activación de piloto a propósito: el reloj solo arranca
  -- con ff_commercial_trial_activate_v1.
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

  -- Idempotencia
  IF FOUND AND v_prev.commercial_sku_key = v_sku
     AND v_prev.catalog_mode = v_mode
     AND v_prev.technical_plan_key = v_tech_key THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'pharmacy_id', p_pharmacy_id,
      'commercial_plan_key', v_sku,
      'catalog_mode', v_mode,
      'technical_plan_key', v_tech_key,
      'subscription_id', NULL,
      'note', 'Sin cambios'
    );
  END IF;

  -- Piloto abierto: no convertir automáticamente a plan de pago
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
    ELSIF v_open_trial.status = 'ready' AND (v_effects->>'is_pilot')::boolean IS NOT TRUE THEN
      -- ready sin reloj: marcar ended/cancelled sin activar
      UPDATE public.pharmacy_commercial_trials
      SET status = 'cancelled', ended_at = v_now, updated_by = v_uid
      WHERE id = v_open_trial.id;
    END IF;
  END IF;

  -- Destino piloto: preparar perfil SIN activar reloj / SIN subscription
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

    -- Asegurar fila trial ready si no hay abierta (no activate)
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
    -- Planes de pago / general: entitlements + modalidad + suscripción no duplicada
    UPDATE public.pharmacies
    SET plan_id = v_plan_id,
        status = CASE
          WHEN status IN ('suspended', 'archived') THEN status
          ELSE 'active'
        END,
        updated_by = v_uid
    WHERE id = p_pharmacy_id;

    -- Sincronizar entitlements source='plan' desde plan_modules (mismo patrón 017).
    -- No toca addons (kiosk addon, etc.). No INSERT/DELETE pharmacy_products.
    UPDATE public.pharmacy_entitlements pe
    SET
      status = 'cancelled',
      ends_at = v_now,
      updated_by = v_uid
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
      p_pharmacy_id,
      pm.module_id,
      'active',
      'plan',
      v_plan_id,
      COALESCE(pm.default_limits, '{}'::jsonb),
      '{}'::jsonb,
      v_now,
      NULL,
      v_uid,
      v_uid
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

    -- QR home: entrypoint_qr debe existir para General/Personalizado.
    PERFORM public.ff_ensure_pharmacy_home_entrypoint_v1(p_pharmacy_id);

    PERFORM public.ff_set_pharmacy_catalog_mode_v1(p_pharmacy_id, v_mode);
    IF (v_effects->>'attach_master')::boolean THEN
      v_attach := public.ff_attach_master_catalog_v1(p_pharmacy_id);
    END IF;

    -- Asistente: se aplica DESPUÉS del bloque piloto/pago (ver más abajo).
    -- Solo ai_personalized → activate_contracted. General/Personalizado → none
    -- (cancela addon assistant_ai usable; no activa demo).

    v_has_sub := public.ff_pharmacy_has_current_subscription(p_pharmacy_id);
    IF v_has_sub THEN
      UPDATE public.subscriptions s
      SET plan_id = v_plan_id,
          status = CASE
            WHEN s.status = 'trialing' THEN 'active'
            ELSE s.status
          END,
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

  -- Asistente IA (045): solo ai_personalized activa contracted.
  -- General / Personalizado / Piloto: assistant_action=none → no demo;
  -- si había addon usable, se cancela para no dejar IA accesible por error.
  IF v_effects->>'assistant_action' = 'activate_contracted' THEN
    v_assistant := public.ff_set_pharmacy_assistant_entitlement_v1(
      p_pharmacy_id, 'activate_contracted', 500, NULL, false,
      'commercial_plan_assign_v1'
    );
  ELSIF v_effects->>'assistant_action' = 'activate_demo' THEN
    -- Reservado por si un SKU futuro lo necesita; 056 no mapea ningún SKU a demo.
    v_assistant := public.ff_set_pharmacy_assistant_entitlement_v1(
      p_pharmacy_id, 'activate_demo', 50, NULL, false,
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
      'assistant', v_assistant
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
    'activated_pilot', false
  );
END;
$$;

COMMENT ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean) IS
  'Asigna/cambia plan comercial + técnico + entitlements + catalog_mode. Sin activate piloto ni cobros. Idempotente.';

REVOKE ALL ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_assign_commercial_plan_v1(uuid, text, text, boolean)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Validación estática (ejecutable en psql tras apply; aquí como checklist)
-- -----------------------------------------------------------------------------
-- ASSERT: no hay parámetro activate_pilot
-- ASSERT: pilot_must_end_first si trial active/extended y destino no pilot
-- ASSERT: ff_pharmacy_has_current_subscription evita INSERT duplicado
-- ASSERT: attach/sync no DELETE
-- ASSERT: ai_personalized → own + activate_contracted
-- ASSERT: general/personalized/pilot → assistant_action=none (sin activate_demo)
-- ASSERT: none cancela assistant_ai active|trial|suspended si existía
-- ASSERT: general → personalized → general: mode own→generic + attach; sin borrar products
-- ASSERT: Support sin .write no usa esta RPC (subscriptions.manage típico SuperAdmin)

-- DOWN (manual):
-- DROP FUNCTION IF EXISTS public.ff_assign_commercial_plan_v1(uuid, text, text, boolean);
-- DROP FUNCTION IF EXISTS public.ff_commercial_sku_effects_v1(text);
-- DROP TABLE IF EXISTS public.pharmacy_commercial_assignments;
