-- =============================================================================
-- 045_assistant_ai_module_v1.sql
-- Módulo opcional Asistente IA (add-on, no incluido en planes base).
--
-- Reutiliza: modules, pharmacy_entitlements, ff_pharmacy_has_module,
--            ff_has_platform_permission, ff_has_pharmacy_permission,
--            ff_write_audit_log, ff_kiosk_validate_device_session_v1.
--
-- Estados comerciales (config.mode):
--   demo        → entitlement trial/active + mode=demo (autorizado expresamente)
--   contracted  → entitlement active + mode=contracted
--   off         → sin entitlement usable (cancelled/suspended/ausente)
--
-- NO APLICAR automáticamente. Depende de: 007, 011, 034–038, 041.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Catálogo de módulo (nunca en plan_modules)
-- -----------------------------------------------------------------------------
INSERT INTO public.modules (key, name, description, is_core, is_active)
VALUES (
  'assistant_ai',
  'Asistente IA',
  'Add-on de asistente conversacional en kiosko. No incluido en planes base; demo o contrato por farmacia.',
  false,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_core = false,
  is_active = true;

-- -----------------------------------------------------------------------------
-- 2) Configuración editable por farmacia (no comercial)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_assistant_settings (
  pharmacy_id uuid PRIMARY KEY
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  assistant_name text NOT NULL DEFAULT 'Asistente FarmaFácil',
  welcome_message text NOT NULL DEFAULT '',
  custom_instructions text NOT NULL DEFAULT '',
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  services_info text NOT NULL DEFAULT '',
  hours_info text NOT NULL DEFAULT '',
  pharmacist_consult_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_assistant_settings_name_len_chk
    CHECK (char_length(assistant_name) BETWEEN 1 AND 80),
  CONSTRAINT pharmacy_assistant_settings_welcome_len_chk
    CHECK (char_length(welcome_message) <= 800),
  CONSTRAINT pharmacy_assistant_settings_instructions_len_chk
    CHECK (char_length(custom_instructions) <= 2000),
  CONSTRAINT pharmacy_assistant_settings_services_len_chk
    CHECK (char_length(services_info) <= 2000),
  CONSTRAINT pharmacy_assistant_settings_hours_len_chk
    CHECK (char_length(hours_info) <= 1000),
  CONSTRAINT pharmacy_assistant_settings_faqs_array_chk
    CHECK (jsonb_typeof(faqs) = 'array')
);

COMMENT ON TABLE public.pharmacy_assistant_settings IS
  'Configuración de contenido del Asistente IA por farmacia. No altera modalidad comercial ni límites.';

CREATE TRIGGER pharmacy_assistant_settings_set_updated_at
  BEFORE UPDATE ON public.pharmacy_assistant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.pharmacy_assistant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharmacy_assistant_settings_select ON public.pharmacy_assistant_settings;
CREATE POLICY pharmacy_assistant_settings_select
  ON public.pharmacy_assistant_settings
  FOR SELECT TO authenticated
  USING (
    public.ff_can_read_pharmacy(pharmacy_id)
    OR public.ff_has_platform_permission('platform.entitlements.manage')
  );

DROP POLICY IF EXISTS pharmacy_assistant_settings_insert ON public.pharmacy_assistant_settings;
CREATE POLICY pharmacy_assistant_settings_insert
  ON public.pharmacy_assistant_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
    OR public.ff_has_platform_permission('platform.entitlements.manage')
  );

DROP POLICY IF EXISTS pharmacy_assistant_settings_update ON public.pharmacy_assistant_settings;
CREATE POLICY pharmacy_assistant_settings_update
  ON public.pharmacy_assistant_settings
  FOR UPDATE TO authenticated
  USING (
    public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
    OR public.ff_has_platform_permission('platform.entitlements.manage')
  )
  WITH CHECK (
    public.ff_has_pharmacy_permission(pharmacy_id, 'settings.update')
    OR public.ff_has_platform_permission('platform.entitlements.manage')
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_assistant_settings TO authenticated;

-- Permiso comercial: solo SuperAdmin (platform.entitlements.manage) puede
-- cambiar pharmacist_consult_enabled. La farmacia puede leerlo, no escribirlo.
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_settings_guard_commercial_()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pharmacist_consult_enabled IS DISTINCT FROM false
       AND NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
      NEW.pharmacist_consult_enabled := false;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.pharmacist_consult_enabled IS DISTINCT FROM OLD.pharmacist_consult_enabled
       AND NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'Solo FarmaFácil puede activar o desactivar las consultas al farmacéutico.';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pharmacy_assistant_settings_guard_commercial
  ON public.pharmacy_assistant_settings;
CREATE TRIGGER pharmacy_assistant_settings_guard_commercial
  BEFORE INSERT OR UPDATE ON public.pharmacy_assistant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_pharmacy_assistant_settings_guard_commercial_();

COMMENT ON FUNCTION public.ff_pharmacy_assistant_settings_guard_commercial_() IS
  'Impide que usuarios de farmacia activen pharmacist_consult_enabled; solo platform.entitlements.manage.';

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_settings_guard_commercial_() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_settings_guard_commercial_() FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) Consumo mensual persistente (serverless-safe)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_assistant_usage_monthly (
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  period_ym text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_cents numeric(12, 4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pharmacy_id, period_ym),
  CONSTRAINT pharmacy_assistant_usage_period_ym_chk
    CHECK (period_ym ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT pharmacy_assistant_usage_nonneg_chk
    CHECK (
      request_count >= 0
      AND prompt_tokens >= 0
      AND completion_tokens >= 0
      AND estimated_cost_cents >= 0
    )
);

COMMENT ON TABLE public.pharmacy_assistant_usage_monthly IS
  'Contadores mensuales de uso del Asistente IA por farmacia. Escritura solo vía RPC DEFINER.';

CREATE INDEX IF NOT EXISTS pharmacy_assistant_usage_monthly_period_idx
  ON public.pharmacy_assistant_usage_monthly (period_ym);

ALTER TABLE public.pharmacy_assistant_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharmacy_assistant_usage_select ON public.pharmacy_assistant_usage_monthly;
CREATE POLICY pharmacy_assistant_usage_select
  ON public.pharmacy_assistant_usage_monthly
  FOR SELECT TO authenticated
  USING (
    public.ff_can_read_pharmacy(pharmacy_id)
    OR public.ff_has_platform_permission('platform.entitlements.manage')
  );

-- Sin INSERT/UPDATE directos para authenticated: solo RPC.
GRANT SELECT ON TABLE public.pharmacy_assistant_usage_monthly TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) SuperAdmin: entitlement assistant_ai
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_set_pharmacy_assistant_entitlement_v1(
  p_pharmacy_id uuid,
  p_action text,
  p_monthly_request_limit integer DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_pharmacist_consult_enabled boolean DEFAULT NULL,
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
  v_prev_config jsonb;
  v_prev_limits jsonb;
  v_new_status text;
  v_new_source text;
  v_new_ends_at timestamptz;
  v_new_config jsonb;
  v_new_limits jsonb;
  v_mode text;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Debes iniciar sesión.';
  END IF;
  IF p_pharmacy_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Farmacia no válida.';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'No tienes permiso para gestionar entitlements de farmacia.';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'No tienes permiso de plataforma para auditar cambios de farmacia.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pharmacies ph WHERE ph.id = p_pharmacy_id) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Farmacia no encontrada.';
  END IF;

  SELECT m.id INTO v_module_id
  FROM public.modules m
  WHERE m.key = 'assistant_ai' AND m.is_active = true
  LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Módulo assistant_ai no encontrado.';
  END IF;

  SELECT pe.id, pe.status, pe.config, pe.limits
  INTO v_entitlement_id, v_prev_status, v_prev_config, v_prev_limits
  FROM public.pharmacy_entitlements pe
  WHERE pe.pharmacy_id = p_pharmacy_id AND pe.module_id = v_module_id
  LIMIT 1;

  v_prev_config := coalesce(v_prev_config, '{}'::jsonb);
  v_prev_limits := coalesce(v_prev_limits, '{}'::jsonb);

  IF v_action = 'activate_demo' THEN
    v_new_status := 'trial';
    v_new_source := 'addon';
    v_new_ends_at := coalesce(p_ends_at, v_now + interval '30 days');
    IF v_new_ends_at <= v_now THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'La demo requiere una fecha de vencimiento futura.';
    END IF;
    v_limit := coalesce(p_monthly_request_limit, 50);
    IF v_limit < 1 OR v_limit > 100000 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Límite mensual no válido.';
    END IF;
    v_mode := 'demo';
    v_new_config := jsonb_build_object(
      'mode', 'demo',
      'pharmacist_consult_enabled', false
    );
    v_new_limits := jsonb_build_object('monthly_request_limit', v_limit);

  ELSIF v_action = 'activate_contracted' THEN
    v_new_status := 'active';
    v_new_source := 'addon';
    v_new_ends_at := NULL;
    v_limit := coalesce(p_monthly_request_limit, 1000);
    IF v_limit < 1 OR v_limit > 1000000 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Límite mensual no válido.';
    END IF;
    v_mode := 'contracted';
    v_new_config := jsonb_build_object(
      'mode', 'contracted',
      'pharmacist_consult_enabled', coalesce(p_pharmacist_consult_enabled, false)
    );
    v_new_limits := jsonb_build_object('monthly_request_limit', v_limit);

  ELSIF v_action = 'update_limits' THEN
    IF v_entitlement_id IS NULL OR v_prev_status NOT IN ('active', 'trial') THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Solo se pueden actualizar límites de un asistente activo o en demo.';
    END IF;
    v_limit := coalesce(p_monthly_request_limit,
      nullif(v_prev_limits->>'monthly_request_limit', '')::integer);
    IF v_limit IS NULL OR v_limit < 1 OR v_limit > 1000000 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Límite mensual no válido.';
    END IF;
    v_new_status := v_prev_status;
    v_new_source := 'addon';
    v_new_ends_at := NULL; -- se conserva abajo
    v_new_config := v_prev_config;
    IF p_pharmacist_consult_enabled IS NOT NULL
       AND coalesce(v_prev_config->>'mode', '') = 'contracted' THEN
      v_new_config := v_new_config || jsonb_build_object(
        'pharmacist_consult_enabled', p_pharmacist_consult_enabled
      );
    END IF;
    v_new_limits := jsonb_build_object('monthly_request_limit', v_limit);
    v_mode := coalesce(v_prev_config->>'mode', 'demo');

  ELSIF v_action = 'suspend' THEN
    IF v_entitlement_id IS NULL OR v_prev_status NOT IN ('active', 'trial') THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Solo se puede suspender un asistente activo o en demo.';
    END IF;
    v_new_status := 'suspended';
    v_new_source := 'addon';
    v_new_ends_at := v_now;
    v_new_config := v_prev_config;
    v_new_limits := v_prev_limits;
    v_mode := coalesce(v_prev_config->>'mode', 'demo');

  ELSIF v_action = 'reactivate' THEN
    IF v_entitlement_id IS NULL OR v_prev_status IS DISTINCT FROM 'suspended' THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Solo se puede reactivar un asistente suspendido.';
    END IF;
    v_mode := coalesce(v_prev_config->>'mode', 'demo');
    IF v_mode = 'contracted' THEN
      v_new_status := 'active';
      v_new_ends_at := NULL;
    ELSE
      v_new_status := 'trial';
      v_new_ends_at := coalesce(p_ends_at, v_now + interval '30 days');
      IF v_new_ends_at <= v_now THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'La reactivación demo requiere vencimiento futuro.';
      END IF;
    END IF;
    v_new_source := 'addon';
    v_new_config := v_prev_config;
    v_new_limits := v_prev_limits;

  ELSIF v_action = 'cancel' THEN
    IF v_entitlement_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'No hay entitlement de asistente que cancelar.';
    END IF;
    IF v_prev_status = 'cancelled' THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'El asistente ya está cancelado.';
    END IF;
    v_new_status := 'cancelled';
    v_new_source := 'addon';
    v_new_ends_at := v_now;
    v_new_config := v_prev_config;
    v_new_limits := v_prev_limits;
    v_mode := coalesce(v_prev_config->>'mode', 'demo');

  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Acción de asistente no reconocida.';
  END IF;

  IF v_entitlement_id IS NULL THEN
    INSERT INTO public.pharmacy_entitlements (
      pharmacy_id, module_id, status, source, limits, config,
      starts_at, ends_at, created_by, updated_by
    ) VALUES (
      p_pharmacy_id, v_module_id, v_new_status, v_new_source,
      v_new_limits, v_new_config, v_now, v_new_ends_at, v_uid, v_uid
    )
    RETURNING id INTO v_entitlement_id;
  ELSE
    UPDATE public.pharmacy_entitlements pe
    SET
      status = v_new_status,
      source = v_new_source,
      limits = v_new_limits,
      config = v_new_config,
      ends_at = CASE
        WHEN v_action = 'update_limits' THEN pe.ends_at
        ELSE v_new_ends_at
      END,
      updated_by = v_uid,
      updated_at = v_now
    WHERE pe.id = v_entitlement_id;
  END IF;

  -- Asegura fila de settings (no inventa FAQs comerciales)
  INSERT INTO public.pharmacy_assistant_settings (pharmacy_id, updated_by)
  VALUES (p_pharmacy_id, v_uid)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  IF v_action IN ('activate_contracted', 'update_limits')
     AND p_pharmacist_consult_enabled IS NOT NULL THEN
    UPDATE public.pharmacy_assistant_settings s
    SET
      pharmacist_consult_enabled = CASE
        WHEN coalesce((SELECT config->>'mode' FROM public.pharmacy_entitlements WHERE id = v_entitlement_id), '') = 'contracted'
          THEN p_pharmacist_consult_enabled
        ELSE false
      END,
      updated_by = v_uid,
      updated_at = v_now
    WHERE s.pharmacy_id = p_pharmacy_id;
  END IF;

  IF v_action = 'activate_demo' THEN
    UPDATE public.pharmacy_assistant_settings s
    SET pharmacist_consult_enabled = false, updated_by = v_uid, updated_at = v_now
    WHERE s.pharmacy_id = p_pharmacy_id;
  END IF;

  -- Firma real: ff_write_audit_log(p_action, p_pharmacy_id uuid, p_entity_type, p_entity_id, p_metadata, ...)
  PERFORM public.ff_write_audit_log(
    'pharmacy.assistant_entitlement.' || v_action,
    p_pharmacy_id,
    'pharmacy_entitlement',
    v_entitlement_id::text,
    jsonb_build_object(
      'pharmacy_id', p_pharmacy_id,
      'mode', v_mode,
      'status', v_new_status,
      'limits', v_new_limits,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_new_status,
    'mode', v_mode,
    'ends_at', (
      SELECT ends_at FROM public.pharmacy_entitlements WHERE id = v_entitlement_id
    ),
    'limits', v_new_limits,
    'module_active_now', public.ff_pharmacy_has_module(p_pharmacy_id, 'assistant_ai')
  );
END;
$$;

COMMENT ON FUNCTION public.ff_set_pharmacy_assistant_entitlement_v1(uuid, text, integer, timestamptz, boolean, text) IS
  'SuperAdmin: demo | contratado | límites | suspender | reactivar | cancelar del módulo assistant_ai.';

REVOKE ALL ON FUNCTION public.ff_set_pharmacy_assistant_entitlement_v1(uuid, text, integer, timestamptz, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_set_pharmacy_assistant_entitlement_v1(uuid, text, integer, timestamptz, boolean, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) Runtime kiosko: estado (sin consumo) + reserva atómica + finalize tokens
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_resolve_session_(
  p_credential_hash text
)
RETURNS TABLE (
  out_status text,
  out_pharmacy_id uuid,
  out_device_id uuid,
  out_session_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hash text := btrim(coalesce(p_credential_hash, ''));
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
BEGIN
  IF v_hash = '' THEN
    out_status := 'session_invalid';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = v_hash
  LIMIT 1;

  IF NOT FOUND THEN
    out_status := 'session_invalid';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    out_status := 'session_invalid';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    out_status := 'session_invalid';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_device.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id THEN
    out_status := 'session_invalid';
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_session.pharmacy_id) THEN
    out_status := 'commercially_blocked';
    out_pharmacy_id := v_session.pharmacy_id;
    out_device_id := v_device.id;
    out_session_id := v_session.id;
    RETURN NEXT;
    RETURN;
  END IF;

  out_status := 'ok';
  out_pharmacy_id := v_session.pharmacy_id;
  out_device_id := v_device.id;
  out_session_id := v_session.id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_resolve_session_(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_runtime_status_v1(
  p_credential_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_ent record;
  v_settings public.pharmacy_assistant_settings%ROWTYPE;
  v_mode text;
  v_limit integer;
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_count integer := 0;
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status = 'commercially_blocked' THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;
  IF v_sess.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  SELECT pe.status, pe.ends_at, pe.limits, pe.config
  INTO v_ent
  FROM public.pharmacy_entitlements pe
  INNER JOIN public.modules m ON m.id = pe.module_id
  WHERE pe.pharmacy_id = v_sess.out_pharmacy_id
    AND m.key = 'assistant_ai'
  LIMIT 1;

  IF v_ent.status IS NULL
     OR v_ent.status NOT IN ('active', 'trial')
     OR (v_ent.ends_at IS NOT NULL AND v_ent.ends_at <= now())
     OR NOT public.ff_pharmacy_has_module(v_sess.out_pharmacy_id, 'assistant_ai') THEN
    RETURN jsonb_build_object(
      'status', 'module_disabled',
      'pharmacy_id', v_sess.out_pharmacy_id
    );
  END IF;

  v_mode := coalesce(nullif(v_ent.config->>'mode', ''), 'demo');
  IF v_mode NOT IN ('demo', 'contracted') THEN
    v_mode := 'demo';
  END IF;

  v_limit := coalesce(nullif(v_ent.limits->>'monthly_request_limit', '')::integer, 50);
  IF v_limit < 1 THEN
    v_limit := 50;
  END IF;

  SELECT coalesce(u.request_count, 0) INTO v_count
  FROM public.pharmacy_assistant_usage_monthly u
  WHERE u.pharmacy_id = v_sess.out_pharmacy_id AND u.period_ym = v_period;

  v_count := coalesce(v_count, 0);

  IF v_count >= v_limit THEN
    RETURN jsonb_build_object(
      'status', 'limit_exceeded',
      'pharmacy_id', v_sess.out_pharmacy_id,
      'mode', v_mode,
      'period_ym', v_period,
      'request_count', v_count,
      'monthly_request_limit', v_limit
    );
  END IF;

  SELECT * INTO v_settings
  FROM public.pharmacy_assistant_settings s
  WHERE s.pharmacy_id = v_sess.out_pharmacy_id;

  -- DEMO: no exponer configuración privada de la farmacia al kiosko.
  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_sess.out_pharmacy_id,
    'device_id', v_sess.out_device_id,
    'mode', v_mode,
    'catalog_access', (v_mode = 'contracted'),
    'pharmacist_consult_enabled',
      CASE
        WHEN v_mode = 'contracted' THEN coalesce(
          (v_ent.config->>'pharmacist_consult_enabled')::boolean,
          coalesce(v_settings.pharmacist_consult_enabled, false)
        )
        ELSE false
      END,
    'monthly_request_limit', v_limit,
    'request_count', v_count,
    'period_ym', v_period,
    'settings', CASE
      WHEN v_mode = 'demo' THEN jsonb_build_object(
        'assistant_name', 'Asistente FarmaFácil (demo)',
        'welcome_message', '',
        'custom_instructions', '',
        'faqs', '[]'::jsonb,
        'services_info', '',
        'hours_info', ''
      )
      WHEN v_settings.pharmacy_id IS NULL THEN jsonb_build_object(
        'assistant_name', 'Asistente FarmaFácil',
        'welcome_message', '',
        'custom_instructions', '',
        'faqs', '[]'::jsonb,
        'services_info', '',
        'hours_info', ''
      )
      ELSE jsonb_build_object(
        'assistant_name', v_settings.assistant_name,
        'welcome_message', v_settings.welcome_message,
        'custom_instructions', v_settings.custom_instructions,
        'faqs', v_settings.faqs,
        'services_info', v_settings.services_info,
        'hours_info', v_settings.hours_info
      )
    END
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_runtime_status_v1(text) IS
  'Kiosko: estado del módulo assistant_ai + settings. No incrementa consumo. Informa limit_exceeded.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_runtime_status_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_runtime_status_v1(text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_begin_turn_v1(
  p_credential_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_ent record;
  v_settings public.pharmacy_assistant_settings%ROWTYPE;
  v_mode text;
  v_limit integer;
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_usage public.pharmacy_assistant_usage_monthly%ROWTYPE;
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status = 'commercially_blocked' THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;
  IF v_sess.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  SELECT pe.status, pe.ends_at, pe.limits, pe.config
  INTO v_ent
  FROM public.pharmacy_entitlements pe
  INNER JOIN public.modules m ON m.id = pe.module_id
  WHERE pe.pharmacy_id = v_sess.out_pharmacy_id
    AND m.key = 'assistant_ai'
  LIMIT 1;

  IF v_ent.status IS NULL
     OR v_ent.status NOT IN ('active', 'trial')
     OR (v_ent.ends_at IS NOT NULL AND v_ent.ends_at <= now())
     OR NOT public.ff_pharmacy_has_module(v_sess.out_pharmacy_id, 'assistant_ai') THEN
    RETURN jsonb_build_object(
      'status', 'module_disabled',
      'pharmacy_id', v_sess.out_pharmacy_id
    );
  END IF;

  v_mode := coalesce(nullif(v_ent.config->>'mode', ''), 'demo');
  IF v_mode NOT IN ('demo', 'contracted') THEN
    v_mode := 'demo';
  END IF;

  v_limit := coalesce(nullif(v_ent.limits->>'monthly_request_limit', '')::integer, 50);
  IF v_limit < 1 THEN
    v_limit := 50;
  END IF;

  INSERT INTO public.pharmacy_assistant_usage_monthly AS u (
    pharmacy_id, period_ym, request_count, prompt_tokens, completion_tokens, estimated_cost_cents
  ) VALUES (
    v_sess.out_pharmacy_id, v_period, 0, 0, 0, 0
  )
  ON CONFLICT (pharmacy_id, period_ym) DO NOTHING;

  SELECT * INTO v_usage
  FROM public.pharmacy_assistant_usage_monthly u
  WHERE u.pharmacy_id = v_sess.out_pharmacy_id AND u.period_ym = v_period
  FOR UPDATE;

  IF v_usage.request_count >= v_limit THEN
    RETURN jsonb_build_object(
      'status', 'limit_exceeded',
      'pharmacy_id', v_sess.out_pharmacy_id,
      'mode', v_mode,
      'period_ym', v_period,
      'request_count', v_usage.request_count,
      'monthly_request_limit', v_limit
    );
  END IF;

  UPDATE public.pharmacy_assistant_usage_monthly u
  SET
    request_count = u.request_count + 1,
    updated_at = now()
  WHERE u.pharmacy_id = v_sess.out_pharmacy_id AND u.period_ym = v_period
  RETURNING * INTO v_usage;

  SELECT * INTO v_settings
  FROM public.pharmacy_assistant_settings s
  WHERE s.pharmacy_id = v_sess.out_pharmacy_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_sess.out_pharmacy_id,
    'device_id', v_sess.out_device_id,
    'mode', v_mode,
    'catalog_access', (v_mode = 'contracted'),
    'pharmacist_consult_enabled',
      CASE
        WHEN v_mode = 'contracted' THEN coalesce(
          (v_ent.config->>'pharmacist_consult_enabled')::boolean,
          coalesce(v_settings.pharmacist_consult_enabled, false)
        )
        ELSE false
      END,
    'monthly_request_limit', v_limit,
    'request_count', v_usage.request_count,
    'period_ym', v_period,
    'settings', CASE
      WHEN v_mode = 'demo' THEN jsonb_build_object(
        'assistant_name', 'Asistente FarmaFácil (demo)',
        'welcome_message', '',
        'custom_instructions', '',
        'faqs', '[]'::jsonb,
        'services_info', '',
        'hours_info', ''
      )
      WHEN v_settings.pharmacy_id IS NULL THEN jsonb_build_object(
        'assistant_name', 'Asistente FarmaFácil',
        'welcome_message', '',
        'custom_instructions', '',
        'faqs', '[]'::jsonb,
        'services_info', '',
        'hours_info', ''
      )
      ELSE jsonb_build_object(
        'assistant_name', v_settings.assistant_name,
        'welcome_message', v_settings.welcome_message,
        'custom_instructions', v_settings.custom_instructions,
        'faqs', v_settings.faqs,
        'services_info', v_settings.services_info,
        'hours_info', v_settings.hours_info
      )
    END
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_begin_turn_v1(text) IS
  'Kiosko: reserva 1 petición mensual (FOR UPDATE) y devuelve contexto del asistente. DEMO no expone settings privados.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_begin_turn_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_begin_turn_v1(text)
  TO anon, authenticated, service_role;

-- Compensa una reserva si la llamada al proveedor falla (no doble cobro).
CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_release_turn_v1(
  p_credential_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_usage public.pharmacy_assistant_usage_monthly%ROWTYPE;
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', coalesce(v_sess.out_status, 'session_invalid'));
  END IF;

  SELECT * INTO v_usage
  FROM public.pharmacy_assistant_usage_monthly u
  WHERE u.pharmacy_id = v_sess.out_pharmacy_id AND u.period_ym = v_period
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'usage_missing');
  END IF;

  IF v_usage.request_count < 1 THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'pharmacy_id', v_sess.out_pharmacy_id,
      'period_ym', v_period,
      'request_count', v_usage.request_count,
      'released', false
    );
  END IF;

  UPDATE public.pharmacy_assistant_usage_monthly u
  SET
    request_count = u.request_count - 1,
    updated_at = now()
  WHERE u.pharmacy_id = v_sess.out_pharmacy_id AND u.period_ym = v_period
  RETURNING * INTO v_usage;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_sess.out_pharmacy_id,
    'period_ym', v_period,
    'request_count', v_usage.request_count,
    'released', true
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_release_turn_v1(text) IS
  'Kiosko: libera 1 reserva mensual si la petición OpenAI falló. FOR UPDATE anti-carrera.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_release_turn_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_release_turn_v1(text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_finalize_turn_v1(
  p_credential_hash text,
  p_prompt_tokens integer DEFAULT 0,
  p_completion_tokens integer DEFAULT 0,
  p_estimated_cost_cents numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_prompt integer := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion integer := greatest(coalesce(p_completion_tokens, 0), 0);
  v_cost numeric := greatest(coalesce(p_estimated_cost_cents, 0), 0);
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', coalesce(v_sess.out_status, 'session_invalid'));
  END IF;

  UPDATE public.pharmacy_assistant_usage_monthly u
  SET
    prompt_tokens = u.prompt_tokens + v_prompt,
    completion_tokens = u.completion_tokens + v_completion,
    estimated_cost_cents = u.estimated_cost_cents + v_cost,
    updated_at = now()
  WHERE u.pharmacy_id = v_sess.out_pharmacy_id
    AND u.period_ym = v_period;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'usage_missing');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_sess.out_pharmacy_id,
    'period_ym', v_period
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_finalize_turn_v1(text, integer, integer, numeric) IS
  'Kiosko: suma tokens/coste al periodo mensual tras la llamada al proveedor. No incrementa request_count.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_finalize_turn_v1(text, integer, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_finalize_turn_v1(text, integer, integer, numeric)
  TO anon, authenticated, service_role;

-- DOWN (manual):
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_finalize_turn_v1(text, integer, integer, numeric);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_release_turn_v1(text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_begin_turn_v1(text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_runtime_status_v1(text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_resolve_session_(text);
-- DROP FUNCTION IF EXISTS public.ff_set_pharmacy_assistant_entitlement_v1(uuid, text, integer, timestamptz, boolean, text);
-- DROP TRIGGER IF EXISTS pharmacy_assistant_settings_guard_commercial ON public.pharmacy_assistant_settings;
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_settings_guard_commercial_();
-- DROP TABLE IF EXISTS public.pharmacy_assistant_usage_monthly;
-- DROP TABLE IF EXISTS public.pharmacy_assistant_settings;
-- DELETE FROM public.modules WHERE key = 'assistant_ai';
