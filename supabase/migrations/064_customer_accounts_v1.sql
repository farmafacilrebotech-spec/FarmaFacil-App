-- =============================================================================
-- 064_customer_accounts_v1.sql
-- Cuentas de cliente FarmaFácil (globales) + direcciones + vínculo opcional a pedidos.
-- Reutiliza auth.users + profiles. NO concede roles de plataforma ni memberships.
-- Una visita al QR NO crea relación con la farmacia.
-- NO toca el cuerpo de ff_public_catalog_create_request_v1 (parche opcional en drafts).
-- NO APLICAR en producción sin autorización expresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Extensión de profiles para clientes
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'staff';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_kind_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_kind_chk CHECK (
    account_kind = ANY (ARRAY['staff', 'customer'])
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

COMMENT ON COLUMN public.profiles.account_kind IS
  'staff = panel/farmacia/plataforma · customer = cuenta cliente FarmaFácil (global).';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS
  'Aceptación obligatoria de condiciones/privacidad (clientes). NULL = no registrada.';
COMMENT ON COLUMN public.profiles.marketing_consent_at IS
  'Consentimiento comercial opcional. NULL = no otorgado.';

CREATE INDEX IF NOT EXISTS profiles_account_kind_idx
  ON public.profiles (account_kind);

CREATE INDEX IF NOT EXISTS profiles_phone_customer_idx
  ON public.profiles (phone)
  WHERE account_kind = 'customer' AND phone IS NOT NULL;

-- Impide que un usuario cambie su account_kind vía UPDATE propio (escalada).
CREATE OR REPLACE FUNCTION public.ff_profiles_protect_account_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.account_kind IS DISTINCT FROM OLD.account_kind
     AND NOT public.ff_has_platform_permission('platform.users.write')
  THEN
    NEW.account_kind := OLD.account_kind;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_account_kind ON public.profiles;
CREATE TRIGGER profiles_protect_account_kind
  BEFORE UPDATE OF account_kind ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_profiles_protect_account_kind();

-- Trigger: respetar account_kind / phone / consent desde raw_user_meta_data
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
  v_kind := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'account_kind', 'staff')));
  IF v_kind IS DISTINCT FROM 'customer' THEN
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
        WHEN p.account_kind = 'customer' OR EXCLUDED.account_kind = 'customer'
          THEN 'customer'
        ELSE p.account_kind
      END,
      privacy_accepted_at = COALESCE(p.privacy_accepted_at, EXCLUDED.privacy_accepted_at),
      marketing_consent_at = COALESCE(p.marketing_consent_at, EXCLUDED.marketing_consent_at),
      updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Direcciones del cliente (opcionales; solo envíos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  label text,
  recipient_name text,
  line1 text NOT NULL,
  line2 text,
  postal_code text NOT NULL,
  city text NOT NULL,
  province text,
  country_code text NOT NULL DEFAULT 'ES',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_line1_not_blank_chk CHECK (length(btrim(line1)) > 0),
  CONSTRAINT customer_addresses_city_not_blank_chk CHECK (length(btrim(city)) > 0),
  CONSTRAINT customer_addresses_postal_not_blank_chk CHECK (length(btrim(postal_code)) > 0),
  CONSTRAINT customer_addresses_country_chk CHECK (country_code ~ '^[A-Z]{2}$')
);

COMMENT ON TABLE public.customer_addresses IS
  'Direcciones del cliente FarmaFácil. Opcionales; no requeridas para crear cuenta.';

CREATE INDEX IF NOT EXISTS customer_addresses_profile_id_idx
  ON public.customer_addresses (profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_uidx
  ON public.customer_addresses (profile_id)
  WHERE is_default IS TRUE;

DROP TRIGGER IF EXISTS customer_addresses_set_updated_at ON public.customer_addresses;
CREATE TRIGGER customer_addresses_set_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_addresses_select_own ON public.customer_addresses;
CREATE POLICY customer_addresses_select_own ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS customer_addresses_insert_own ON public.customer_addresses;
CREATE POLICY customer_addresses_insert_own ON public.customer_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_kind = 'customer'
    )
  );

DROP POLICY IF EXISTS customer_addresses_update_own ON public.customer_addresses;
CREATE POLICY customer_addresses_update_own ON public.customer_addresses
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS customer_addresses_delete_own ON public.customer_addresses;
CREATE POLICY customer_addresses_delete_own ON public.customer_addresses
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Pedidos: vínculo opcional al cliente autenticado
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS customer_profile_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pharmacy_orders.customer_profile_id IS
  'Cliente FarmaFácil autenticado que originó el pedido (nullable para invitados QR).';

CREATE INDEX IF NOT EXISTS pharmacy_orders_customer_profile_id_idx
  ON public.pharmacy_orders (customer_profile_id, created_at DESC)
  WHERE customer_profile_id IS NOT NULL;

DROP POLICY IF EXISTS pharmacy_orders_select_own_customer ON public.pharmacy_orders;
CREATE POLICY pharmacy_orders_select_own_customer ON public.pharmacy_orders
  FOR SELECT TO authenticated
  USING (customer_profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS pharmacy_order_items_select_own_customer ON public.pharmacy_order_items;
CREATE POLICY pharmacy_order_items_select_own_customer ON public.pharmacy_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pharmacy_orders o
      WHERE o.id = pharmacy_order_items.order_id
        AND o.customer_profile_id = (SELECT auth.uid())
    )
  );

-- Reclamar pedido propio (mismo teléfono) si aún no está vinculado.
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
    WHERE p.id = v_uid AND p.account_kind = 'customer'
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

COMMENT ON FUNCTION public.ff_customer_claim_order_v1(uuid) IS
  'Permite a un cliente reclamar un pedido suyo (mismo teléfono) si aún no está vinculado.';

REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_customer_claim_order_v1(uuid)
  TO authenticated, service_role;

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_customer_claim_order_v1(uuid);
-- DROP POLICY IF EXISTS pharmacy_order_items_select_own_customer ON public.pharmacy_order_items;
-- DROP POLICY IF EXISTS pharmacy_orders_select_own_customer ON public.pharmacy_orders;
-- ALTER TABLE public.pharmacy_orders DROP COLUMN IF EXISTS customer_profile_id;
-- DROP TABLE IF EXISTS public.customer_addresses;
-- (restaurar ff_handle_new_user desde 003; quitar columnas account_kind/first_name/…)
