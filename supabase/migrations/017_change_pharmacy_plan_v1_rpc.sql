-- =============================================================================
-- 017_change_pharmacy_plan_v1_rpc.sql
-- Cambio administrativo atómico de plan (V1) para PLATFORM_SUPERADMIN autenticado.
--
-- Por qué existe:
--   Actualizar pharmacies.plan_id + subscriptions.plan_id + pharmacy_entitlements
--   desde Next.js en llamadas separadas NO es una transacción PostgreSQL.
--   Esta función ejecuta todo en UNA llamada (una sola transacción del caller).
--
-- Seguridad:
--   SECURITY INVOKER → corre como el JWT autenticado.
--   RLS/policies existentes siguen aplicando en cada SELECT/UPDATE/INSERT.
--   NO usa service_role. NO bypasea RBAC.
--
-- Reglas de negocio V1:
--   - Permite cambio solo si la suscripción corriente está en trialing|active.
--   - Conserva el status de la suscripción (no promueve trialing→active).
--   - Rechaza past_due|paused|cancelled|expired (y ausencia de suscripción corriente).
--   - Downgrade: entitlements source='plan' fuera del nuevo plan → cancelled + ends_at.
--   - No toca entitlements source IN (addon, comp, internal).
--   - Sin facturación / prorrateos / pagos.
--
-- Auditoría:
--   Usa ff_write_audit_log y ff_record_activity_event (SECURITY DEFINER ya
--   existentes y con GRANT EXECUTE a authenticated). NO hace INSERT directo
--   en audit_logs.
--
-- NO APLICAR todavía desde este entorno: revisar y aplicar manualmente.
-- =============================================================================

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
  'Cambio administrativo atómico de plan V1 (pharmacies + subscription corriente + entitlements source=plan). SECURITY INVOKER (RLS aplica). Solo trialing|active.';

REVOKE ALL ON FUNCTION public.ff_change_pharmacy_plan_v1(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_change_pharmacy_plan_v1(uuid, text) TO authenticated;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_change_pharmacy_plan_v1(uuid, text) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_change_pharmacy_plan_v1(uuid, text);
