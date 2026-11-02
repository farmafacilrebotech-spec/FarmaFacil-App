-- =============================================================================
-- 071_dual_role_customer_staff_v1.sql
-- Doble rol: profiles.account_kind ∈ {staff, customer, both}.
--
-- - Un único auth.users / profiles.id puede ser personal de farmacia y cliente.
-- - Activación cliente: RPC ff_customer_enable_self_v1 (consentimiento en servidor).
-- - Panel farmacia/SA: memberships + permisos (no se pierde con both).
-- - Cliente puro (customer) sin memberships sigue sin panel.
--
-- Depende de: 064, 067.
-- NO APLICAR en producción sin autorización expresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) CHECK + comentario + índice teléfono
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_kind_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_kind_chk CHECK (
    account_kind = ANY (ARRAY['staff', 'customer', 'both'])
  );

COMMENT ON COLUMN public.profiles.account_kind IS
  'staff = panel/farmacia/plataforma · customer = solo cliente · both = panel + cliente (mismo auth.users).';

DROP INDEX IF EXISTS public.profiles_phone_customer_idx;
CREATE INDEX IF NOT EXISTS profiles_phone_customer_idx
  ON public.profiles (phone)
  WHERE account_kind = ANY (ARRAY['customer', 'both']) AND phone IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Helper: ¿puede usar área cliente?
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_profile_is_customer_kind(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(p_kind, '')) = ANY (ARRAY['customer', 'both']);
$$;

COMMENT ON FUNCTION public.ff_profile_is_customer_kind(text) IS
  'True si account_kind habilita área cliente (customer|both).';

REVOKE ALL ON FUNCTION public.ff_profile_is_customer_kind(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_profile_is_customer_kind(text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Protección account_kind: sin elevación directa desde el cliente.
--    GUC ff.allow_account_kind_change (local a la transacción):
--      enable_self_v1 | accept_membership_v1 | platform_admin_v1
--    platform.users.write sin GUC admin: solo upgrades no destructivos → both.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_profiles_protect_account_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_token text := coalesce(current_setting('ff.allow_account_kind_change', true), '');
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.account_kind IS DISTINCT FROM OLD.account_kind
  THEN
    -- RPCs de opt-in / aceptación de invitación (DEFINER + token).
    IF v_token IN ('enable_self_v1', 'accept_membership_v1') THEN
      RETURN NEW;
    END IF;

    -- Admin explícito: permiso + token platform_admin_v1 (degradaciones controladas).
    IF v_token = 'platform_admin_v1'
       AND public.ff_has_platform_permission('platform.users.write') THEN
      RETURN NEW;
    END IF;

    -- platform.users.write sin token admin: solo staff|customer → both.
    IF public.ff_has_platform_permission('platform.users.write')
       AND NEW.account_kind = 'both'
       AND OLD.account_kind IN ('staff', 'customer') THEN
      RETURN NEW;
    END IF;

    -- Bloquear elevación/degradación directa (PostgREST / SQL sin token).
    NEW.account_kind := OLD.account_kind;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) ff_handle_new_user: staff + customer → both (nunca degradar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_full_name text;
  v_first text;
  v_last text;
  v_phone text;
  v_kind text;
  v_privacy timestamptz;
  v_marketing timestamptz;
BEGIN
  v_first := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'first_name', '')), '');
  v_last := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')), '');
  v_full_name := NULLIF(
    trim(
      COALESCE(
        NULLIF(trim(COALESCE(v_first, '') || ' ' || COALESCE(v_last, '')), ''),
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  );
  v_phone := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '');
  -- Metadata de registro: SOLO staff|customer. Nunca both (ni farmacia/SA).
  v_kind := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'account_kind', 'staff')));
  IF v_kind = 'customer' THEN
    v_kind := 'customer';
  ELSE
    -- both / basura / vacío → staff (doble rol solo vía enable_self o invite accept)
    v_kind := 'staff';
  END IF;

  IF (NEW.raw_user_meta_data ->> 'privacy_accepted') IN ('true', '1', 'yes') THEN
    v_privacy := pg_catalog.now();
  ELSE
    v_privacy := NULL;
  END IF;

  IF (NEW.raw_user_meta_data ->> 'marketing_consent') IN ('true', '1', 'yes') THEN
    v_marketing := pg_catalog.now();
  ELSE
    v_marketing := NULL;
  END IF;

  INSERT INTO public.profiles AS p (
    id,
    email,
    full_name,
    first_name,
    last_name,
    phone,
    account_kind,
    privacy_accepted_at,
    marketing_consent_at
  )
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    v_full_name,
    v_first,
    v_last,
    v_phone,
    v_kind,
    v_privacy,
    v_marketing
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = COALESCE(p.full_name, EXCLUDED.full_name),
      first_name = COALESCE(p.first_name, EXCLUDED.first_name),
      last_name = COALESCE(p.last_name, EXCLUDED.last_name),
      phone = COALESCE(p.phone, EXCLUDED.phone),
      account_kind = CASE
        -- Dual por cruce staff↔customer (EXCLUDED nunca trae both desde metadata)
        WHEN p.account_kind = 'both' THEN 'both'
        WHEN p.account_kind = 'customer' AND EXCLUDED.account_kind = 'staff' THEN 'both'
        WHEN p.account_kind = 'staff' AND EXCLUDED.account_kind = 'customer' THEN 'both'
        WHEN p.account_kind = 'customer' OR EXCLUDED.account_kind = 'customer' THEN 'customer'
        ELSE p.account_kind
      END,
      privacy_accepted_at = COALESCE(p.privacy_accepted_at, EXCLUDED.privacy_accepted_at),
      marketing_consent_at = COALESCE(p.marketing_consent_at, EXCLUDED.marketing_consent_at),
      updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) Activación cliente (opt-in) — único camino self-service a both/customer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_customer_enable_self_v1(
  p_privacy_accepted boolean,
  p_marketing_consent boolean DEFAULT false,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old text;
  v_new text;
  v_first text;
  v_last text;
  v_phone text;
  v_full text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_privacy_accepted IS NOT TRUE THEN
    RETURN jsonb_build_object('status', 'privacy_required');
  END IF;

  SELECT account_kind INTO v_old
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  IF public.ff_profile_is_customer_kind(v_old) THEN
    -- Ya cliente o both: refrescar consent / datos opcionales sin degradar.
    v_new := v_old;
  ELSIF v_old = 'staff' THEN
    v_new := 'both';
  ELSE
    v_new := 'customer';
  END IF;

  v_first := NULLIF(trim(COALESCE(p_first_name, '')), '');
  v_last := NULLIF(trim(COALESCE(p_last_name, '')), '');
  v_phone := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_full := NULLIF(trim(COALESCE(v_first, '') || ' ' || COALESCE(v_last, '')), '');

  -- Token local de transacción (trigger protect).
  PERFORM set_config('ff.allow_account_kind_change', 'enable_self_v1', true);

  UPDATE public.profiles
  SET
    account_kind = v_new,
    privacy_accepted_at = COALESCE(privacy_accepted_at, pg_catalog.now()),
    marketing_consent_at = CASE
      WHEN p_marketing_consent IS TRUE THEN COALESCE(marketing_consent_at, pg_catalog.now())
      ELSE marketing_consent_at
    END,
    first_name = COALESCE(v_first, first_name),
    last_name = COALESCE(v_last, last_name),
    full_name = COALESCE(NULLIF(v_full, ''), full_name),
    phone = COALESCE(v_phone, phone),
    updated_at = pg_catalog.now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'status', 'ok',
    'account_kind', v_new,
    'previous_kind', v_old
  );
END;
$$;

COMMENT ON FUNCTION public.ff_customer_enable_self_v1(boolean, boolean, text, text, text) IS
  'Opt-in área cliente: staff→both (o ya customer/both). Requiere privacy_accepted. Sin elevar permisos de panel.';

REVOKE ALL ON FUNCTION public.ff_customer_enable_self_v1(boolean, boolean, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_customer_enable_self_v1(boolean, boolean, text, text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) RLS direcciones (064): INSERT admite customer|both
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS customer_addresses_insert_own ON public.customer_addresses;
CREATE POLICY customer_addresses_insert_own ON public.customer_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND public.ff_profile_is_customer_kind(p.account_kind)
    )
  );

-- -----------------------------------------------------------------------------
-- 7) Claim order (064): customer|both
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_customer_claim_order_v1(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.pharmacy_orders%ROWTYPE;
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND public.ff_profile_is_customer_kind(p.account_kind)
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_order.customer_profile_id IS NOT NULL THEN
    IF v_order.customer_profile_id = v_uid THEN
      RETURN jsonb_build_object('status', 'ok', 'already', true);
    END IF;
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT phone INTO v_phone FROM public.profiles WHERE id = v_uid;
  IF v_phone IS NULL OR v_order.customer_phone IS NULL
     OR regexp_replace(v_phone, '[^0-9]', '', 'g')
        IS DISTINCT FROM regexp_replace(v_order.customer_phone, '[^0-9]', '', 'g')
  THEN
    RETURN jsonb_build_object('status', 'phone_mismatch');
  END IF;

  UPDATE public.pharmacy_orders
  SET customer_profile_id = v_uid,
      updated_at = pg_catalog.now()
  WHERE id = p_order_id
    AND customer_profile_id IS NULL;

  RETURN jsonb_build_object('status', 'ok', 'order_id', p_order_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 8) Mis farmacias (067): RLS + RPC customer|both
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS customer_saved_pharmacies_select_own
  ON public.customer_saved_pharmacies;
CREATE POLICY customer_saved_pharmacies_select_own
  ON public.customer_saved_pharmacies
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND public.ff_profile_is_customer_kind(p.account_kind)
    )
  );

DROP POLICY IF EXISTS customer_saved_pharmacies_delete_own
  ON public.customer_saved_pharmacies;
CREATE POLICY customer_saved_pharmacies_delete_own
  ON public.customer_saved_pharmacies
  FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND public.ff_profile_is_customer_kind(p.account_kind)
    )
  );

CREATE OR REPLACE FUNCTION public.ff_customer_save_pharmacy_v1(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id text;
  v_ep public.public_entrypoints%ROWTYPE;
  v_name text;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND public.ff_profile_is_customer_kind(p.account_kind)
  ) THEN
    RETURN jsonb_build_object('status', 'not_customer');
  END IF;

  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
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

  SELECT p.name INTO v_name
  FROM public.pharmacies p
  WHERE p.id = v_ep.pharmacy_id;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  INSERT INTO public.customer_saved_pharmacies (
    profile_id, pharmacy_id, public_id
  )
  VALUES (v_uid, v_ep.pharmacy_id, v_ep.public_id)
  ON CONFLICT (profile_id, pharmacy_id) DO UPDATE
  SET public_id = EXCLUDED.public_id
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', v_row_id,
    'pharmacy_id', v_ep.pharmacy_id,
    'public_id', v_ep.public_id,
    'pharmacy_name', v_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ff_customer_unsave_pharmacy_v1(
  p_public_id text DEFAULT NULL,
  p_pharmacy_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND public.ff_profile_is_customer_kind(p.account_kind)
  ) THEN
    RETURN jsonb_build_object('status', 'not_customer');
  END IF;

  IF p_pharmacy_id IS NOT NULL THEN
    DELETE FROM public.customer_saved_pharmacies
    WHERE profile_id = v_uid AND pharmacy_id = p_pharmacy_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSIF p_public_id IS NOT NULL AND btrim(p_public_id) <> '' THEN
    DELETE FROM public.customer_saved_pharmacies
    WHERE profile_id = v_uid
      AND public_id = lower(btrim(p_public_id));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'removed', v_deleted > 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ff_customer_list_saved_pharmacies_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND public.ff_profile_is_customer_kind(p.account_kind)
  ) THEN
    RETURN jsonb_build_object('status', 'not_customer');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'pharmacy_id', s.pharmacy_id,
            'public_id', s.public_id,
            'pharmacy_name', p.name,
            'saved_at', s.saved_at
          )
          ORDER BY s.saved_at DESC
        )
        FROM public.customer_saved_pharmacies s
        INNER JOIN public.pharmacies p ON p.id = s.pharmacy_id
        WHERE s.profile_id = v_uid
      ),
      '[]'::jsonb
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9) Aceptar invitación: customer → both (preserva área cliente + panel)
--    No cambia el rol de la membership; solo invited→active del propio uid.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_accept_pharmacy_membership_v1(
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_now timestamptz := pg_catalog.now();
  v_membership_id uuid;
  v_pharmacy_id uuid;
  v_status text;
  v_kind text;
  v_new_kind text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_membership_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  SELECT m.id, m.pharmacy_id, m.status
    INTO v_membership_id, v_pharmacy_id, v_status
  FROM public.pharmacy_memberships m
  WHERE m.id = p_membership_id
    AND m.profile_id = v_uid
  FOR UPDATE OF m;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_status <> 'invited' THEN
    RETURN jsonb_build_object(
      'status', 'invalid_state',
      'current_status', v_status
    );
  END IF;

  UPDATE public.pharmacy_memberships m
  SET
    status = 'active',
    accepted_at = v_now,
    updated_by = v_uid,
    updated_at = v_now
  WHERE m.id = v_membership_id
    AND m.profile_id = v_uid
    AND m.status = 'invited';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_state');
  END IF;

  -- Dual role: cliente que entra en farmacia conserva área cliente.
  SELECT account_kind INTO v_kind
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF FOUND AND v_kind = 'customer' THEN
    v_new_kind := 'both';
    PERFORM set_config('ff.allow_account_kind_change', 'accept_membership_v1', true);
    UPDATE public.profiles
    SET account_kind = 'both',
        updated_at = pg_catalog.now()
    WHERE id = v_uid
      AND account_kind = 'customer';
  ELSE
    v_new_kind := v_kind;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'membership_id', v_membership_id,
    'pharmacy_id', v_pharmacy_id,
    'account_kind', v_new_kind
  );
END;
$$;

COMMENT ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid) IS
  'Acepta membership invited del auth.uid() (invited→active). Si account_kind=customer → both. No altera rol ni concede permisos extra.';

REVOKE ALL ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_accept_pharmacy_membership_v1(uuid)
  TO authenticated;

-- DOWN / recovery: ver docs/migrations/071_DOWN_recovery.sql (bloquea si hay both).
