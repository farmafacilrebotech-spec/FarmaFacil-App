-- =============================================================================
-- 055_master_catalog_modes_public_v1.sql
-- Cablea el maestro 054 a readiness/prep comercial, kiosko y catálogo QR público.
--
-- NO APLICAR sin autorización. Depende de: 043, 044, 050, 051/053, 054.
-- =============================================================================

-- Mínimo genéricos activos para piloto (maestro = 100).
CREATE OR REPLACE FUNCTION public.ff_commercial_pilot_min_demo_products()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$ SELECT 100; $$;

COMMENT ON FUNCTION public.ff_commercial_pilot_min_demo_products() IS
  'Mínimo de productos genéricos activos (ff_master_v1 / legacy demo) para readiness piloto.';

CREATE OR REPLACE FUNCTION public.ff_pharmacy_generic_catalog_active_count(p_pharmacy_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT count(*)::integer
  FROM public.pharmacy_products pp
  WHERE pp.pharmacy_id = p_pharmacy_id
    AND pp.is_active = true
    AND (
      (pp.source = 'generic' AND pp.source_ref LIKE 'ff_master_v1:FF-GEN-%')
      OR (pp.source = 'demo' AND pp.source_ref LIKE 'farmafacil_demo_v1:%')
    );
$$;

GRANT EXECUTE ON FUNCTION public.ff_pharmacy_generic_catalog_active_count(uuid)
  TO authenticated, service_role;

-- Entitlements piloto: misma lógica 050, catalog_mode → generic.
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
  v_limits jsonb := jsonb_build_object(
    'max_users', 3,
    'max_products', 500,
    'commercial_profile', 'pilot_v1',
    'catalog_mode', 'generic'
  );
  v_allow text[] := ARRAY[
    'kernel', 'pharmacies', 'users', 'branding', 'entrypoint_qr', 'orders'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION 'forbidden_entitlements_manage' USING ERRCODE = '42501';
  END IF;

  SELECT plan_id INTO v_plan_id
  FROM public.pharmacies
  WHERE id = p_pharmacy_id;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'pharmacy_plan_required' USING ERRCODE = '23514';
  END IF;

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
      'catalog_mode', 'generic'
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
      'catalog_mode', 'generic'
    ),
    ends_at = NULL,
    updated_by = v_uid,
    updated_at = v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_pilot_apply_entitlement_profile_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_pilot_apply_entitlement_profile_v1(uuid)
  TO authenticated;

-- Readiness: exige 100 genéricos (maestro o legacy demo durante transición).
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

  v_demo_count := public.ff_pharmacy_generic_catalog_active_count(p_pharmacy_id);
  v_demo_ok := v_demo_count >= v_min;
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'generic_catalog',
      'ok', v_demo_ok,
      'detail', format('%s/%s productos genéricos activos (maestro o demo legacy)', v_demo_count, v_min)
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
    'min_generic_products', v_min,
    'checks', v_checks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_commercial_trial_readiness_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_commercial_trial_readiness_v1(uuid) TO authenticated;

-- Prep comercial: catalog_mode=generic + attach 100 (reemplaza cuerpo post-053).
CREATE OR REPLACE FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  p_name text,
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_plan_id uuid;
  v_pharmacy_id uuid;
  v_trial_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_ep jsonb;
  v_attach jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.commercial_trials.manage') THEN
    RAISE EXCEPTION 'forbidden_commercial_trials' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.entitlements.manage') THEN
    RAISE EXCEPTION 'forbidden_entitlements_manage' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'pharmacy_name_required' USING ERRCODE = '23514';
  END IF;

  SELECT p.id INTO v_plan_id
  FROM public.plans p
  WHERE p.key = 'starter' AND p.is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'starter_plan_missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.pharmacies (
    name, legal_name, cif, email, phone, web,
    address_line, postal_code, city, province, country,
    status, plan_id, logo_color, created_by, updated_by
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
    'pending_setup',
    v_plan_id,
    NULLIF(trim(p_logo_color), ''),
    v_uid,
    v_uid
  )
  RETURNING id INTO v_pharmacy_id;

  INSERT INTO public.pharmacy_branding (
    pharmacy_id, primary_color, secondary_color, welcome_message, updated_by
  ) VALUES (
    v_pharmacy_id,
    NULLIF(trim(p_primary_color), ''),
    NULLIF(trim(p_secondary_color), ''),
    NULLIF(trim(p_welcome_message), ''),
    v_uid
  );

  INSERT INTO public.pharmacy_settings (
    pharmacy_id, visible_name, schedule, phone, whatsapp, email,
    catalog_mode, updated_by
  ) VALUES (
    v_pharmacy_id,
    COALESCE(NULLIF(trim(p_visible_name), ''), trim(p_name)),
    NULLIF(trim(p_schedule), ''),
    COALESCE(NULLIF(trim(p_settings_phone), ''), NULLIF(trim(p_phone), '')),
    NULLIF(trim(p_whatsapp), ''),
    COALESCE(NULLIF(trim(p_settings_email), ''), NULLIF(trim(p_email), '')),
    'generic',
    v_uid
  );

  PERFORM public.ff_commercial_pilot_apply_entitlement_profile_v1(v_pharmacy_id);

  INSERT INTO public.pharmacy_assistant_settings (pharmacy_id, updated_by)
  VALUES (v_pharmacy_id, v_uid)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  INSERT INTO public.pharmacy_commercial_trials (
    pharmacy_id, program, status, prepared_at, created_by, updated_by
  ) VALUES (
    v_pharmacy_id, 'commercial_v1_15d', 'ready', v_now, v_uid, v_uid
  )
  RETURNING id INTO v_trial_id;

  v_ep := public.ff_ensure_pharmacy_home_entrypoint_v1(v_pharmacy_id);
  IF coalesce(v_ep->>'status', '') IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION
      USING ERRCODE = 'P0001',
            MESSAGE = 'No se pudo generar el QR / entrypoint de la farmacia.',
            DETAIL = coalesce(v_ep::text, 'null'),
            HINT = 'entrypoint_ensure_failed';
  END IF;

  -- Asignación automática del catálogo maestro (100), idempotente.
  v_attach := public.ff_attach_master_catalog_v1(v_pharmacy_id);

  PERFORM public.ff_write_audit_log(
    'commercial.pharmacy.prep_create',
    v_pharmacy_id,
    'pharmacy',
    v_pharmacy_id::text,
    jsonb_build_object(
      'trial_id', v_trial_id,
      'plan_key', 'starter',
      'commercial_profile', 'pilot_v1',
      'catalog_mode', 'generic',
      'master_catalog_attach', v_attach,
      'entrypoint', v_ep,
      'subscription', 'none',
      'next_steps', jsonb_build_array(
        'invite_owner_and_wait_active',
        'verify_readiness',
        'activate_trial'
      )
    ),
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_pharmacy_id,
    'trial_id', v_trial_id,
    'trial_status', 'ready',
    'pharmacy_status', 'pending_setup',
    'plan_key', 'starter',
    'catalog_mode', 'generic',
    'master_catalog_attach', v_attach,
    'entrypoint', v_ep,
    'subscription_id', NULL,
    'readiness', public.ff_commercial_trial_readiness_v1(v_pharmacy_id),
    'next_steps', jsonb_build_array(
      'invite_owner_and_wait_active',
      'ff_commercial_trial_readiness_v1',
      'ff_commercial_trial_activate_v1'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.ff_create_pharmacy_commercial_prep_v1(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Kiosko: filtrar por modalidad; no marcar available por stock en genéricos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_search_products_v1(
  p_credential_hash text,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.pharmacy_device_sessions%ROWTYPE;
  v_device public.pharmacy_devices%ROWTYPE;
  v_q text;
  v_q_like text;
  v_limit integer;
  v_items jsonb;
  v_mode text;
BEGIN
  IF p_credential_hash IS NULL OR length(btrim(p_credential_hash)) = 0 THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  v_limit := greatest(1, least(COALESCE(p_limit, 40), 80));
  v_q := nullif(btrim(COALESCE(p_query, '')), '');
  IF v_q IS NOT NULL AND length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  IF v_q IS NOT NULL THEN
    v_q_like := replace(
      replace(
        replace(v_q, E'\\', E'\\\\'),
        '%',
        E'\\%'
      ),
      '_',
      E'\\_'
    );
  END IF;

  SELECT * INTO v_session
  FROM public.pharmacy_device_sessions
  WHERE credential_hash = btrim(p_credential_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF v_session.revoked_at IS NOT NULL OR v_session.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  SELECT * INTO v_device
  FROM public.pharmacy_devices
  WHERE id = v_session.device_id;

  IF NOT FOUND OR v_device.status <> 'active' OR v_device.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'session_revoked');
  END IF;

  IF v_device.pharmacy_id IS DISTINCT FROM v_session.pharmacy_id THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF NOT public.ff_kiosk_pharmacy_runtime_allowed(v_session.pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;

  v_mode := public.ff_pharmacy_catalog_mode(v_session.pharmacy_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'brand', p.brand,
        'sku', p.sku,
        'ean', p.ean,
        'category', p.category,
        'subcategory', p.subcategory,
        'price', CASE
          WHEN p.source IN ('generic', 'demo') THEN NULL
          ELSE p.price
        END,
        'stock', CASE
          WHEN p.source IN ('generic', 'demo') THEN NULL
          ELSE p.stock
        END,
        'availability_status', COALESCE(p.availability_status, 'available'),
        'is_active', p.is_active,
        'source', p.source
      )
      ORDER BY p.name_sort, p.id
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT
      pr.id,
      pr.name,
      pr.brand,
      pr.sku,
      pr.ean,
      pr.category,
      pr.subcategory,
      pr.price,
      pr.stock,
      pr.availability_status,
      pr.is_active,
      pr.source,
      lower(pr.name) AS name_sort
    FROM public.pharmacy_products pr
    WHERE pr.pharmacy_id = v_session.pharmacy_id
      AND pr.is_active IS TRUE
      AND public.ff_pharmacy_product_visible_in_active_catalog(pr.source, v_mode)
      AND (
        v_q IS NULL
        OR pr.name ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.brand, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.sku, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.ean, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.category, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.subcategory, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
      )
    ORDER BY lower(pr.name), pr.id
    LIMIT v_limit
  ) p;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', v_session.pharmacy_id,
    'catalog_mode', v_mode,
    'query', v_q,
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_search_products_v1(text, text, integer) IS
  'Búsqueda kiosko filtrada por catalog_mode. Genéricos sin price/stock inventados en JSON.';

REVOKE ALL ON FUNCTION public.ff_kiosk_search_products_v1(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_search_products_v1(text, text, integer)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Catálogo público QR (anon): respeta modalidad; sin precios/stock ficticios
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_public_catalog_list_v1(
  p_public_id text,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id text;
  v_ep public.public_entrypoints%ROWTYPE;
  v_pharmacy_name text;
  v_mode text;
  v_q text;
  v_q_like text;
  v_limit integer;
  v_items jsonb;
BEGIN
  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id IS NULL OR v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_ep
  FROM public.public_entrypoints pe
  WHERE pe.public_id = v_id
    AND pe.purpose = 'pharmacy_home'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_ep.is_active IS NOT TRUE
     OR (v_ep.expires_at IS NOT NULL AND v_ep.expires_at <= pg_catalog.now()) THEN
    RETURN jsonb_build_object('status', 'inactive');
  END IF;

  SELECT p.name INTO v_pharmacy_name
  FROM public.pharmacies p
  WHERE p.id = v_ep.pharmacy_id;

  IF v_pharmacy_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_mode := public.ff_pharmacy_catalog_mode(v_ep.pharmacy_id);
  v_limit := greatest(1, least(COALESCE(p_limit, 60), 120));
  v_q := nullif(btrim(COALESCE(p_query, '')), '');
  IF v_q IS NOT NULL AND length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;
  IF v_q IS NOT NULL THEN
    v_q_like := replace(replace(replace(v_q, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'category', p.category,
        'subcategory', p.subcategory,
        'sku', p.sku,
        'availability_status', COALESCE(p.availability_status, 'available'),
        'source', p.source,
        'requestable', true
      )
      ORDER BY p.name_sort, p.id
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT
      pr.id,
      pr.name,
      pr.category,
      pr.subcategory,
      pr.sku,
      pr.availability_status,
      pr.source,
      lower(pr.name) AS name_sort
    FROM public.pharmacy_products pr
    WHERE pr.pharmacy_id = v_ep.pharmacy_id
      AND pr.is_active IS TRUE
      AND public.ff_pharmacy_product_visible_in_active_catalog(pr.source, v_mode)
      AND (
        v_q IS NULL
        OR pr.name ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.category, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.subcategory, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
        OR COALESCE(pr.sku, '') ILIKE '%' || v_q_like || '%' ESCAPE E'\\'
      )
    ORDER BY lower(pr.name), pr.id
    LIMIT v_limit
  ) p;

  -- No exponer pharmacy_id (mismo criterio que 044).
  RETURN jsonb_build_object(
    'status', 'ok',
    'public_id', v_ep.public_id,
    'pharmacy_name', v_pharmacy_name,
    'catalog_mode', v_mode,
    'query', v_q,
    'items', v_items,
    'note', CASE
      WHEN v_mode = 'generic' THEN
        'Tipos genéricos: disponibilidad pendiente de confirmación por la farmacia. Sin precios ni stock.'
      ELSE
        'Catálogo propio de la farmacia.'
    END
  );
END;
$$;

COMMENT ON FUNCTION public.ff_public_catalog_list_v1(text, text, integer) IS
  'Listado público QR por public_id. Filtra por catalog_mode. Sin pharmacy_id ni precios inventados.';

REVOKE ALL ON FUNCTION public.ff_public_catalog_list_v1(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_public_catalog_list_v1(text, text, integer)
  TO anon, authenticated, service_role;

-- =============================================================================
-- DOWN (manual): redeploy cuerpos 043/050/051/053 previos si hiciera falta.
-- DROP FUNCTION IF EXISTS public.ff_public_catalog_list_v1(text, text, integer);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_generic_catalog_active_count(uuid);
-- =============================================================================
