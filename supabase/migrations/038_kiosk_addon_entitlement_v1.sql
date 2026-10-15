-- =============================================================================
-- 038_kiosk_addon_entitlement_v1.sql
-- Kiosko como add-on independiente del plan base (starter/pro/business/enterprise).
--
-- Corrige efectos de 035:
--   - Quita kiosk de plan_modules (no se otorga al crear/cambiar plan).
--   - Cancela solo entitlements kiosk source='plan' (auto-concedidos por 035).
--     No toca source IN (addon, comp, internal).
--
-- Añade RPC SuperAdmin: ff_set_pharmacy_kiosk_entitlement_v1
--   activate_trial | activate_addon | suspend | reactivate | cancel
--   Requiere platform.entitlements.manage. Auditoría vía ff_write_audit_log.
--
-- NO modifica 034–037. NO APLICAR automáticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Catálogo: kiosk deja de formar parte de los planes base
-- -----------------------------------------------------------------------------
DELETE FROM public.plan_modules pm
USING public.modules m
WHERE pm.module_id = m.id
  AND m.key = 'kiosk';

UPDATE public.modules
SET
  description =
    'Add-on de dispositivos tablet / mostrador. No incluido en planes base; se contrata o prueba por farmacia.',
  is_core = false,
  is_active = true
WHERE key = 'kiosk';

-- -----------------------------------------------------------------------------
-- 2) Datos: cancelar solo entitlements kiosk heredados del plan (035)
-- -----------------------------------------------------------------------------
UPDATE public.pharmacy_entitlements pe
SET
  status = 'cancelled',
  ends_at = pg_catalog.now(),
  updated_at = pg_catalog.now()
FROM public.modules m
WHERE pe.module_id = m.id
  AND m.key = 'kiosk'
  AND pe.source = 'plan'
  AND pe.status IS DISTINCT FROM 'cancelled';

-- -----------------------------------------------------------------------------
-- 3) RPC: gestión comercial del add-on kiosk por farmacia
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_set_pharmacy_kiosk_entitlement_v1(
  p_pharmacy_id uuid,
  p_action text,
  p_ends_at timestamptz DEFAULT NULL,
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
  v_module_id uuid;
  v_entitlement_id uuid;
  v_prev_status text;
  v_prev_source text;
  v_prev_ends_at timestamptz;
  v_new_status text;
  v_new_source text;
  v_new_ends_at timestamptz;
  v_pharmacy_exists boolean;
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

  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso para gestionar entitlements de farmacia.';
  END IF;

  -- Auditoría con pharmacy_id exige también pharmacies.write (helper existente).
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION
      USING ERRCODE = '42501',
            MESSAGE = 'No tienes permiso de plataforma para auditar cambios de farmacia.';
  END IF;

  IF v_action NOT IN (
    'activate_trial',
    'activate_addon',
    'suspend',
    'reactivate',
    'cancel'
  ) THEN
    RAISE EXCEPTION
      USING ERRCODE = '22023',
            MESSAGE = 'Acción de kiosko no reconocida.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pharmacies ph WHERE ph.id = p_pharmacy_id
  )
  INTO v_pharmacy_exists;

  IF NOT v_pharmacy_exists THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0002',
            MESSAGE = 'Farmacia no encontrada.';
  END IF;

  SELECT m.id
  INTO v_module_id
  FROM public.modules m
  WHERE m.key = 'kiosk'
  LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0002',
            MESSAGE = 'Módulo kiosk no encontrado en catálogo.';
  END IF;

  SELECT
    pe.id,
    pe.status,
    pe.source,
    pe.ends_at
  INTO
    v_entitlement_id,
    v_prev_status,
    v_prev_source,
    v_prev_ends_at
  FROM public.pharmacy_entitlements pe
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND pe.module_id = v_module_id
  FOR UPDATE;

  IF v_action = 'activate_trial' THEN
    IF p_ends_at IS NULL OR p_ends_at <= v_now THEN
      RAISE EXCEPTION
        USING ERRCODE = '22023',
              MESSAGE = 'La prueba de kiosko requiere una fecha de vencimiento futura.';
    END IF;
    v_new_status := 'trial';
    v_new_source := 'addon';
    v_new_ends_at := p_ends_at;

  ELSIF v_action = 'activate_addon' THEN
    v_new_status := 'active';
    v_new_source := 'addon';
    v_new_ends_at := NULL;

  ELSIF v_action = 'suspend' THEN
    IF v_entitlement_id IS NULL OR v_prev_status NOT IN ('active', 'trial') THEN
      RAISE EXCEPTION
        USING ERRCODE = '22023',
              MESSAGE = 'Solo se puede suspender un kiosko activo o en prueba.';
    END IF;
    v_new_status := 'suspended';
    v_new_source := COALESCE(NULLIF(v_prev_source, 'plan'), 'addon');
    v_new_ends_at := v_prev_ends_at;

  ELSIF v_action = 'reactivate' THEN
    IF v_entitlement_id IS NULL OR v_prev_status IS DISTINCT FROM 'suspended' THEN
      RAISE EXCEPTION
        USING ERRCODE = '22023',
              MESSAGE = 'Solo se puede reactivar un kiosko suspendido.';
    END IF;
    IF v_prev_ends_at IS NOT NULL AND v_prev_ends_at > v_now THEN
      v_new_status := 'trial';
      v_new_ends_at := v_prev_ends_at;
    ELSIF v_prev_ends_at IS NOT NULL AND v_prev_ends_at <= v_now THEN
      RAISE EXCEPTION
        USING ERRCODE = '22023',
              MESSAGE = 'La prueba de kiosko ya ha vencido. Activa una prueba nueva o el add-on comercial.';
    ELSE
      v_new_status := 'active';
      v_new_ends_at := NULL;
    END IF;
    v_new_source := COALESCE(NULLIF(v_prev_source, 'plan'), 'addon');

  ELSIF v_action = 'cancel' THEN
    IF v_entitlement_id IS NULL THEN
      RAISE EXCEPTION
        USING ERRCODE = '22023',
              MESSAGE = 'No hay entitlement de kiosko que cancelar.';
    END IF;
    IF v_prev_status = 'cancelled' THEN
      RAISE EXCEPTION
        USING ERRCODE = '22023',
              MESSAGE = 'El kiosko ya está cancelado.';
    END IF;
    v_new_status := 'cancelled';
    v_new_source := COALESCE(NULLIF(v_prev_source, 'plan'), 'addon');
    v_new_ends_at := v_now;
  END IF;

  IF v_entitlement_id IS NULL THEN
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
    VALUES (
      p_pharmacy_id,
      v_module_id,
      v_new_status,
      v_new_source,
      NULL,
      '{}'::jsonb,
      '{}'::jsonb,
      v_now,
      v_new_ends_at,
      v_uid,
      v_uid
    )
    RETURNING id INTO v_entitlement_id;
  ELSE
    UPDATE public.pharmacy_entitlements
    SET
      status = v_new_status,
      source = v_new_source,
      source_plan_id = NULL,
      starts_at = CASE
        WHEN v_action IN ('activate_trial', 'activate_addon') THEN v_now
        ELSE starts_at
      END,
      ends_at = v_new_ends_at,
      updated_by = v_uid,
      updated_at = v_now
    WHERE id = v_entitlement_id;
  END IF;

  PERFORM public.ff_write_audit_log(
    'pharmacy.kiosk_entitlement.' || v_action,
    p_pharmacy_id,
    'pharmacy_entitlement',
    v_entitlement_id::text,
    jsonb_build_object(
      'pharmacy_id', p_pharmacy_id,
      'module_key', 'kiosk',
      'action', v_action,
      'reason', v_reason,
      'actor_profile_id', v_uid,
      'previous', jsonb_build_object(
        'status', v_prev_status,
        'source', v_prev_source,
        'ends_at', v_prev_ends_at
      ),
      'next', jsonb_build_object(
        'status', v_new_status,
        'source', v_new_source,
        'ends_at', v_new_ends_at
      )
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pharmacy_id', p_pharmacy_id,
    'entitlement_id', v_entitlement_id,
    'action', v_action,
    'status', v_new_status,
    'source', v_new_source,
    'ends_at', v_new_ends_at,
    'module_active_now', public.ff_pharmacy_has_module(p_pharmacy_id, 'kiosk')
  );
END;
$$;

COMMENT ON FUNCTION public.ff_set_pharmacy_kiosk_entitlement_v1(uuid, text, timestamptz, text) IS
  'SuperAdmin: trial/addon/suspend/reactivate/cancel del módulo kiosk (add-on). No factura.';

REVOKE ALL ON FUNCTION public.ff_set_pharmacy_kiosk_entitlement_v1(uuid, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_set_pharmacy_kiosk_entitlement_v1(uuid, text, timestamptz, text)
  TO authenticated, service_role;

-- DOWN (desarrollo):
-- REVOKE ALL ON FUNCTION public.ff_set_pharmacy_kiosk_entitlement_v1(uuid, text, timestamptz, text) FROM PUBLIC;
-- DROP FUNCTION IF EXISTS public.ff_set_pharmacy_kiosk_entitlement_v1(uuid, text, timestamptz, text);
-- (No reinserta plan_modules ni reactiva entitlements cancelados.)
