-- =============================================================================
-- 029_ff_transition_pharmacy_subscription_v1.sql
-- Transiciones comerciales SuperAdmin: cancelar, impago, suspender, reactivar.
--
-- Acciones:
--   cancel_at_period_end — acceso hasta current_period_end (o trial_end)
--   cancel_now           — bloqueo inmediato; NO archiva farmacia
--   start_nonpayment_grace — past_due + gracia 7 días (sigue operable)
--   suspend_for_nonpayment — farmacia suspended (bloqueo); datos intactos
--   reactivate           — restaura acceso sin perder datos/memberships
--
-- RAISE: estilo 026 (USING ERRCODE + MESSAGE; sin literal duplicado).
-- NO hard-delete. NO toca auth.users ni memberships.
-- NO APLICAR automáticamente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_transition_pharmacy_subscription_v1(
  p_pharmacy_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');
  v_pharmacy_status text;
  v_subscription_id uuid;
  v_sub_status text;
  v_trial_end timestamptz;
  v_period_end timestamptz;
  v_grace_end timestamptz;
  v_plan_id uuid;
  v_cancel_at_period_end boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = '28000',
            MESSAGE = 'Debes iniciar sesión.';
  END IF;

  IF p_pharmacy_id IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = '22023',
            MESSAGE = 'Farmacia no válida.';
  END IF;

  IF v_action NOT IN (
    'cancel_at_period_end',
    'cancel_now',
    'start_nonpayment_grace',
    'suspend_for_nonpayment',
    'reactivate'
  ) THEN
    RAISE EXCEPTION
      USING ERRCODE = '22023',
            MESSAGE = 'Acción comercial no reconocida.';
  END IF;

  -- pharmacies.write es obligatorio: ff_write_audit_log / ff_record_activity_event
  -- lo exigen (subscriptions.manage solo no basta para auditar y haría ROLLBACK).
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso para gestionar la suscripción de esta farmacia.';
  END IF;

  -- Bloqueo de farmacia
  SELECT ph.status, ph.plan_id
    INTO v_pharmacy_status, v_plan_id
  FROM public.pharmacies ph
  WHERE ph.id = p_pharmacy_id
  FOR UPDATE;

  IF v_pharmacy_status IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0002',
            MESSAGE = 'La farmacia no existe.';
  END IF;

  -- Suscripción corriente (o la más reciente cancelled/expired para reactivar)
  IF v_action = 'reactivate' THEN
    SELECT s.id, s.status, s.trial_end, s.current_period_end,
           s.grace_period_ends_at, s.plan_id, s.cancel_at_period_end
      INTO v_subscription_id, v_sub_status, v_trial_end, v_period_end,
           v_grace_end, v_plan_id, v_cancel_at_period_end
    FROM public.subscriptions s
    WHERE s.pharmacy_id = p_pharmacy_id
    ORDER BY
      CASE
        WHEN s.status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused']) THEN 0
        ELSE 1
      END,
      s.updated_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT s.id, s.status, s.trial_end, s.current_period_end,
           s.grace_period_ends_at, s.plan_id, s.cancel_at_period_end
      INTO v_subscription_id, v_sub_status, v_trial_end, v_period_end,
           v_grace_end, v_plan_id, v_cancel_at_period_end
    FROM public.subscriptions s
    WHERE s.pharmacy_id = p_pharmacy_id
      AND s.status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused'])
    FOR UPDATE;
  END IF;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0002',
            MESSAGE = 'No hay suscripción para esta farmacia.';
  END IF;

  -- -------------------------------------------------------------------------
  -- cancel_at_period_end
  -- -------------------------------------------------------------------------
  IF v_action = 'cancel_at_period_end' THEN
    IF v_sub_status NOT IN ('trialing', 'active') THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede programar la cancelación con suscripción en prueba o activa.';
    END IF;

    -- Fecha de corte: periodo contratado o fin de trial
    IF v_sub_status = 'trialing' THEN
      v_period_end := coalesce(v_trial_end, v_period_end);
    END IF;

    IF v_period_end IS NULL OR v_period_end <= v_now THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'No hay fecha de fin de periodo válida. Usa cancelación inmediata o define el periodo.';
    END IF;

    UPDATE public.subscriptions s
    SET
      cancel_at_period_end = true,
      current_period_end = coalesce(s.current_period_end, v_period_end),
      commercial_reason = coalesce(v_reason, 'Cancelación al final del periodo'),
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.id = v_subscription_id;

  -- -------------------------------------------------------------------------
  -- cancel_now (NO archiva farmacia)
  -- -------------------------------------------------------------------------
  ELSIF v_action = 'cancel_now' THEN
    IF v_sub_status IN ('cancelled', 'expired') THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'La suscripción ya está finalizada.';
    END IF;

    UPDATE public.subscriptions s
    SET
      status = 'cancelled',
      cancelled_at = v_now,
      cancel_at_period_end = false,
      grace_period_ends_at = NULL,
      commercial_reason = coalesce(v_reason, 'Cancelación inmediata'),
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.id = v_subscription_id;

    UPDATE public.pharmacy_entitlements pe
    SET
      status = 'cancelled',
      ends_at = coalesce(pe.ends_at, v_now),
      updated_by = v_uid,
      updated_at = v_now
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND pe.status IS DISTINCT FROM 'cancelled';

    -- Farmacia: NO se archiva ni se cambia el status del tenant por cancelación.

  -- -------------------------------------------------------------------------
  -- start_nonpayment_grace (7 días; sigue operable)
  -- -------------------------------------------------------------------------
  ELSIF v_action = 'start_nonpayment_grace' THEN
    IF v_sub_status NOT IN ('trialing', 'active', 'past_due') THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'Solo se puede iniciar gracia desde prueba, activa o ya en past_due.';
    END IF;

    IF v_pharmacy_status = 'suspended' THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'La farmacia ya está suspendida. Usa reactivar o deja la suspensión.';
    END IF;

    v_grace_end := v_now + interval '7 days';

    UPDATE public.subscriptions s
    SET
      status = 'past_due',
      grace_period_ends_at = v_grace_end,
      cancel_at_period_end = false,
      commercial_reason = coalesce(v_reason, 'Impago: periodo de gracia'),
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.id = v_subscription_id;

  -- -------------------------------------------------------------------------
  -- suspend_for_nonpayment (bloqueo operativo; datos intactos)
  -- -------------------------------------------------------------------------
  ELSIF v_action = 'suspend_for_nonpayment' THEN
    IF v_pharmacy_status = 'archived' THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'No se puede suspender una farmacia archivada.';
    END IF;

    UPDATE public.subscriptions s
    SET
      status = CASE
        WHEN s.status IN ('cancelled', 'expired') THEN s.status
        ELSE 'past_due'
      END,
      grace_period_ends_at = least(coalesce(s.grace_period_ends_at, v_now), v_now),
      commercial_reason = coalesce(v_reason, 'Suspensión por impago'),
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.id = v_subscription_id
      AND s.status IS DISTINCT FROM 'cancelled'
      AND s.status IS DISTINCT FROM 'expired';

    -- Si quedó cancelled/expired, igual suspendemos la farmacia
    UPDATE public.subscriptions s
    SET
      commercial_reason = coalesce(v_reason, 'Suspensión por impago'),
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.id = v_subscription_id
      AND s.status IN ('cancelled', 'expired');

    UPDATE public.pharmacies ph
    SET
      status = 'suspended',
      suspended_at = coalesce(ph.suspended_at, v_now),
      suspension_reason = coalesce(v_reason, 'Impago'),
      updated_by = v_uid,
      updated_at = v_now
    WHERE ph.id = p_pharmacy_id;

    UPDATE public.pharmacy_entitlements pe
    SET
      status = 'suspended',
      updated_by = v_uid,
      updated_at = v_now
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND pe.status IN ('active', 'trial');

  -- -------------------------------------------------------------------------
  -- reactivate
  -- -------------------------------------------------------------------------
  ELSIF v_action = 'reactivate' THEN
    IF v_pharmacy_status = 'archived' THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'No se puede reactivar comercialmente una farmacia archivada.';
    END IF;

    IF v_sub_status NOT IN ('past_due', 'paused', 'cancelled', 'expired')
       AND v_pharmacy_status IS DISTINCT FROM 'suspended'
       AND v_cancel_at_period_end IS NOT TRUE THEN
      RAISE EXCEPTION
        USING ERRCODE = 'P0001',
              MESSAGE = 'No hay estado comercial o de farmacia que reactivar.';
    END IF;

    -- Una sola corriente: si reactivamos cancelled/expired y ya hubiera otra
    -- corriente, el índice único lo impediría; aquí asumimos la fila elegida.
    UPDATE public.subscriptions s
    SET
      status = 'active',
      cancel_at_period_end = false,
      cancelled_at = NULL,
      grace_period_ends_at = NULL,
      commercial_reason = coalesce(v_reason, 'Reactivación manual'),
      current_period_start = v_now,
      current_period_end = v_now + interval '30 days',
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.id = v_subscription_id;

    UPDATE public.pharmacies ph
    SET
      status = CASE
        WHEN ph.status = 'suspended' THEN 'active'
        ELSE ph.status
      END,
      suspended_at = NULL,
      suspension_reason = NULL,
      updated_by = v_uid,
      updated_at = v_now
    WHERE ph.id = p_pharmacy_id;

    -- Restaurar entitlements del plan (source=plan); no borra filas
    UPDATE public.pharmacy_entitlements pe
    SET
      status = 'active',
      ends_at = NULL,
      updated_by = v_uid,
      updated_at = v_now
    WHERE pe.pharmacy_id = p_pharmacy_id
      AND pe.source = 'plan'
      AND pe.status IN ('suspended', 'cancelled', 'trial');

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
  END IF;

  -- Auditoría
  PERFORM public.ff_write_audit_log(
    'pharmacy.subscription_' || v_action,
    p_pharmacy_id,
    'subscription',
    v_subscription_id::text,
    jsonb_build_object(
      'pharmacy_id', p_pharmacy_id,
      'subscription_id', v_subscription_id,
      'action', v_action,
      'reason', v_reason,
      'previous_subscription_status', v_sub_status,
      'previous_pharmacy_status', v_pharmacy_status,
      'actor_profile_id', v_uid,
      'at', v_now
    )
  );

  PERFORM public.ff_record_activity_event(
    p_pharmacy_id,
    'pharmacy.subscription_' || v_action,
    'Cambio comercial de suscripción',
    coalesce(v_reason, v_action),
    jsonb_build_object(
      'action', v_action,
      'subscription_id', v_subscription_id,
      'at', v_now
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'pharmacy_id', p_pharmacy_id,
    'subscription_id', v_subscription_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_transition_pharmacy_subscription_v1(uuid, text, text) IS
  'Transiciones comerciales: cancel_at_period_end|cancel_now|start_nonpayment_grace|suspend_for_nonpayment|reactivate. Requiere platform.pharmacies.write (auditoría). Sin hard-delete ni archived automático. RAISE estilo 026.';

REVOKE ALL ON FUNCTION public.ff_transition_pharmacy_subscription_v1(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_transition_pharmacy_subscription_v1(uuid, text, text)
  TO authenticated;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_transition_pharmacy_subscription_v1(uuid, text, text) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_transition_pharmacy_subscription_v1(uuid, text, text);
